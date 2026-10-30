import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerCompteurSynchro, traiterLotSynchro } from '@/data/acces/api';
import { QUOTA_DEFAUT, SECONDES_PAR_SORTIE_DEFAUT, secondesAvantReprise, type QuotaStrava } from '@/data/synchro/estimation';
import { useAuth } from '@/stores/auth';

// La synchro des courbes de puissance, tant que l'écran est ouvert : elle calcule les sorties avec capteur par lots, le plus vite que Strava le permet,
// se met en pause toute seule quand Strava dit stop (100 demandes par quart d'heure), reprend à la remise à zéro, et mesure le temps réel d'une sortie
// pour que « il reste environ… » soit juste. Fermer l'écran l'arrête ; la rouvrir reprend là où elle s'est arrêtée (tout est écrit au fur et à mesure).
// Les durées sont calculées dans data/synchro/estimation.ts. Voir docs/native/SYNCHRO_STRAVA.md.

export type PhaseSynchro = 'chargement' | 'vide' | 'repos' | 'calcul' | 'pause' | 'fini' | 'erreur' | 'demo';

export interface EtatSynchro {
  phase: PhaseSynchro;
  total: number;
  faites: number;
  /** Le temps moyen d'une sortie, mesuré sur les lots déjà faits (une valeur de départ avant le premier). */
  secParSortie: number;
  quota: QuotaStrava;
  /** La fin de la pause en cours (ms), sinon null. */
  reprise: number | null;
  /** L'heure, mise à jour chaque seconde pendant une pause (pour le compte à rebours). */
  maintenant: number;
  message: string;
}

const TAILLE_LOT = 20;
const ESSAIS_MAX = 3;

const INITIAL: EtatSynchro = { phase: 'chargement', total: 0, faites: 0, secParSortie: SECONDES_PAR_SORTIE_DEFAUT, quota: QUOTA_DEFAUT, reprise: null, maintenant: Date.now(), message: '' };
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
      maj({ phase: 'calcul', message: '', reprise: null });
      let echecs = 0;
      let stagnation = 0;
      let mesures = 0;
      while (vivant()) {
        const avant = etatRef.current;
        const t0 = Date.now();
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
        const { restantes, limiteAtteinte, quota } = r.data;
        const nouvelles = Math.max(0, avant.total - avant.faites - restantes);
        // Le temps d'une sortie : la moyenne glisse vers les mesures récentes (les premières lots remplacent la valeur de départ)
        let sec = avant.secParSortie;
        if (nouvelles > 0 && !limiteAtteinte) {
          const mesure = (Date.now() - t0) / 1000 / nouvelles;
          sec = mesures === 0 ? mesure : sec * 0.7 + mesure * 0.3;
          mesures++;
        }
        const faites = Math.max(avant.faites, avant.total - restantes);
        maj({ faites, secParSortie: sec, quota: quota ?? avant.quota });
        if (restantes === 0) {
          maj({ phase: 'fini', reprise: null });
          return;
        }
        if (limiteAtteinte) {
          stagnation = 0;
          const fin = Date.now() + secondesAvantReprise(quota ?? avant.quota, Date.now()) * 1000;
          maj({ phase: 'pause', reprise: fin, maintenant: Date.now() });
          while (vivant() && Date.now() < fin) {
            await attendre(1000);
            if (vivant()) maj({ maintenant: Date.now() });
          }
          if (!vivant()) return;
          maj({ phase: 'calcul', reprise: null });
        } else if (nouvelles === 0 && ++stagnation >= ESSAIS_MAX) {
          // Rien n'avance sans que Strava refuse : on s'arrête plutôt que de tourner dans le vide
          maj({ phase: 'erreur', message: 'Le calcul n\'avance plus. Réessaie dans un moment.' });
          return;
        } else if (nouvelles > 0) {
          stagnation = 0;
        }
      }
    })();
  }, [maj]);

  const arreter = useCallback(() => {
    boucle.current++;
    maj({ phase: 'repos', reprise: null });
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
