import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerCompteurSynchro, traiterLotSynchro } from '@/data/acces/api';
import { SECONDES_PAR_SORTIE_DEFAUT } from '@/data/synchro/estimation';
import { useAuth } from '@/stores/auth';

// La synchro des flux et des courbes (puissance, cardio, vitesse…), tant que l'écran est ouvert : elle importe les sorties par lots, le plus vite que Strava le permet,
// et mesure le temps réel d'une sortie pour que « il reste environ… » soit juste. Pas de pause automatique : quand Strava atteint sa limite (100 demandes par quart
// d'heure), le calcul s'arrête et on le relance à la main. Fermer l'écran l'arrête aussi ; le rouvrir reprend là où il en était (tout est écrit au fur et à mesure).
// Les durées sont calculées dans data/synchro/estimation.ts. Voir docs/native/SYNCHRO_STRAVA.md.

export type PhaseSynchro = 'chargement' | 'vide' | 'repos' | 'calcul' | 'fini' | 'erreur' | 'demo';

export interface EtatSynchro {
  phase: PhaseSynchro;
  total: number;
  faites: number;
  /** Le temps moyen d'une sortie, mesuré sur les lots déjà faits (une valeur de départ avant le premier). */
  secParSortie: number;
  /** Le moment (ms) où le lot en cours est parti : l'écran en déduit les sorties à montrer une par une pendant qu'il se calcule. */
  debutLot: number;
  /** Pourquoi le calcul s'est arrêté (limite Strava, erreur), sinon vide. */
  message: string;
}

/** Sorties demandées au serveur à chaque lot. */
export const TAILLE_LOT = 20;
const ESSAIS_MAX = 3;

const INITIAL: EtatSynchro = { phase: 'chargement', total: 0, faites: 0, secParSortie: SECONDES_PAR_SORTIE_DEFAUT, debutLot: Date.now(), message: '' };
const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function useSynchroStrava(): EtatSynchro & { demarrer: () => void; arreter: () => void } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const [etat, setEtat] = useState<EtatSynchro>(demo ? { ...INITIAL, phase: 'demo' } : INITIAL);
  const etatRef = useRef(etat);
  etatRef.current = etat;
  // Chaque lancement a son numéro : relancer ou arrêter rend l'ancienne boucle caduque
  const boucle = useRef(0);

  const maj = useCallback((m: Partial<EtatSynchro>) => setEtat((e) => ({ ...e, ...m })), []);

  const lancer = useCallback(() => {
    const mon = ++boucle.current;
    const vivant = (): boolean => boucle.current === mon;
    void (async () => {
      maj({ phase: 'calcul', message: '' });
      let echecs = 0;
      let stagnation = 0;
      let mesures = 0;
      while (vivant()) {
        const avant = etatRef.current;
        const t0 = Date.now();
        maj({ debutLot: t0 });
        const r = await traiterLotSynchro(TAILLE_LOT);
        if (!vivant()) return;
        if (!r.data) {
          if (++echecs >= ESSAIS_MAX) {
            maj({ phase: 'erreur', message: r.erreur });
            return;
          }
          await attendre(2000 * echecs);
          continue;
        }
        echecs = 0;
        const { restantes, limiteAtteinte } = r.data;
        const nouvelles = Math.max(0, avant.total - avant.faites - restantes);
        // Le temps d'une sortie : la moyenne glisse vers les mesures récentes (le premier lot remplace la valeur de départ)
        let sec = avant.secParSortie;
        if (nouvelles > 0 && !limiteAtteinte) {
          const mesure = (Date.now() - t0) / 1000 / nouvelles;
          sec = mesures === 0 ? mesure : sec * 0.7 + mesure * 0.3;
          mesures++;
        }
        maj({ faites: Math.max(avant.faites, avant.total - restantes), secParSortie: sec });
        if (restantes === 0) {
          maj({ phase: 'fini' });
          return;
        }
        if (limiteAtteinte) {
          maj({ phase: 'repos', message: 'Strava a atteint sa limite de demandes. Reprends dans quelques minutes.' });
          return;
        }
        if (nouvelles === 0 && ++stagnation >= ESSAIS_MAX) {
          // Rien n'avance sans que Strava refuse : on s'arrête plutôt que de tourner dans le vide
          maj({ phase: 'erreur', message: 'Le calcul n\'avance plus. Réessaie dans un moment.' });
          return;
        }
        if (nouvelles > 0) stagnation = 0;
      }
    })();
  }, [maj]);

  const arreter = useCallback(() => {
    boucle.current++;
    maj({ phase: 'repos', message: '' });
  }, [maj]);

  // À l'ouverture de l'écran : on lit où on en est, et on repart s'il reste des sorties
  useEffect(() => {
    if (demo || !userId) return;
    let annule = false;
    void chargerCompteurSynchro(userId).then((r) => {
      if (annule) return;
      if (!r.data) {
        maj({ phase: 'erreur', message: r.erreur });
        return;
      }
      const { total, faites } = r.data;
      maj({ total, faites });
      if (total === 0) maj({ phase: 'vide' });
      else if (faites >= total) maj({ phase: 'fini' });
      else lancer();
    });
    return () => {
      annule = true;
      boucle.current++; // fermer l'écran arrête le calcul
    };
  }, [demo, userId, lancer, maj]);

  return { ...etat, demarrer: lancer, arreter };
}
