import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerCompteurSynchro, compterCourbesObsoletes, recalculerLotCourbes, traiterLotSynchro } from '@/data/acces/api';
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
  /** Pourquoi le calcul s'est arrêté (limite Strava, erreur), sinon vide. */
  message: string;
  /** Sorties dont la courbe est recalculée parce que la formule a changé (0 hors de cette étape). Quand tout est importé, l'écran continue tant qu'il en reste. */
  courbes: number;
}

/** Sorties demandées au serveur à chaque lot. */
export const TAILLE_LOT = 20;
const ESSAIS_MAX = 3;

const INITIAL: EtatSynchro = { phase: 'chargement', total: 0, faites: 0, secParSortie: SECONDES_PAR_SORTIE_DEFAUT, message: '', courbes: 0 };
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
  // L'étape en cours (importer les flux, puis recalculer les courbes obsolètes) : « Réessayer » reprend la bonne. Pendant la 2e, le compteur de sorties est déjà plein :
  // le relevé du compteur ne doit pas conclure « fini » avant la fin du recalcul.
  const etape = useRef<'import' | 'courbes'>('import');
  const courbesEnCours = useRef(false);

  // Les sorties dont la courbe date d'une ancienne formule (version des courbes) : recalculées par lots depuis leurs flux déjà stockés, sans Strava, jusqu'à la fin.
  const rattraperCourbes = useCallback(async (mon: number): Promise<void> => {
    const vivant = (): boolean => boucle.current === mon;
    etape.current = 'courbes';
    courbesEnCours.current = true;
    const termine = (m: Partial<EtatSynchro>): void => {
      courbesEnCours.current = false;
      maj({ courbes: 0, ...m });
    };
    const depart = await compterCourbesObsoletes();
    if (!vivant()) return;
    if (depart.data === null) {
      termine({ phase: 'erreur', message: depart.erreur });
      return;
    }
    let reste = depart.data;
    if (reste === 0) {
      etape.current = 'import';
      termine({ phase: 'fini', message: '' });
      return;
    }
    maj({ phase: 'calcul', message: '', courbes: reste });
    let echecs = 0;
    let stagnation = 0;
    while (vivant() && reste > 0) {
      const r = await recalculerLotCourbes();
      if (!vivant()) return;
      if (r.data === null) {
        if (++echecs >= ESSAIS_MAX) {
          termine({ phase: 'erreur', message: r.erreur });
          return;
        }
        await attendre(2000 * echecs);
        continue;
      }
      echecs = 0;
      if (r.data >= reste && ++stagnation >= ESSAIS_MAX) {
        termine({ phase: 'erreur', message: 'Le recalcul des courbes n\'avance plus. Réessaie dans un moment.' });
        return;
      }
      if (r.data < reste) stagnation = 0;
      reste = r.data;
      maj({ courbes: reste });
    }
    if (vivant()) {
      etape.current = 'import';
      termine({ phase: 'fini', message: '' });
    }
  }, [maj]);

  const lancer = useCallback(() => {
    const mon = ++boucle.current;
    const vivant = (): boolean => boucle.current === mon;
    etape.current = 'import';
    courbesEnCours.current = false;
    void (async () => {
      maj({ phase: 'calcul', message: '', courbes: 0 });
      let echecs = 0;
      let stagnation = 0;
      let cumulSecondes = 0;
      let cumulSorties = 0;
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
        const { restantes, limiteAtteinte } = r.data;
        const nouvelles = Math.max(0, avant.total - avant.faites - restantes);
        // Le temps d'une sortie : la moyenne depuis le début du calcul (temps total des lots ÷ sorties faites), stable d'un lot à l'autre,
        // sinon le compteur de l'écran accélérerait et ralentirait à chaque lot. Avant le premier lot, la valeur de départ.
        let sec = avant.secParSortie;
        if (nouvelles > 0 && !limiteAtteinte) {
          cumulSecondes += (Date.now() - t0) / 1000;
          cumulSorties += nouvelles;
          sec = cumulSecondes / cumulSorties;
        }
        maj({ faites: Math.max(avant.faites, avant.total - restantes), secParSortie: sec });
        if (restantes === 0) {
          // Tout est importé : reste à recalculer les courbes d'une ancienne formule (s'il y en a)
          void rattraperCourbes(mon);
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
  }, [maj, rattraperCourbes]);

  const arreter = useCallback(() => {
    boucle.current++;
    courbesEnCours.current = false;
    maj({ phase: 'repos', message: '' });
  }, [maj]);

  /** Lancer ou reprendre : l'étape où on s'était arrêté (importer les flux, ou recalculer les courbes). */
  const demarrer = useCallback(() => {
    if (etape.current === 'courbes') void rattraperCourbes(++boucle.current);
    else lancer();
  }, [lancer, rattraperCourbes]);

  // La base fait foi : tant que l'écran est en calcul, à l'arrêt ou en erreur, on relit le compteur toutes les 4 s. L'écran suit même si un lot tarde,
  // ou si un autre appareil (le même compte sur un autre téléphone) fait avancer la synchro ; à 100 %, la boucle s'arrête.
  useEffect(() => {
    if (!userId || (etat.phase !== 'calcul' && etat.phase !== 'repos' && etat.phase !== 'erreur')) return;
    let annule = false;
    const t = setInterval(() => {
      void chargerCompteurSynchro(userId).then((r) => {
        if (annule || !r.data) return;
        const { total, faites } = r.data;
        setEtat((e) => {
          if (e.phase !== 'calcul' && e.phase !== 'repos' && e.phase !== 'erreur') return e;
          const plusHaut = Math.max(e.faites, faites);
          if (total > 0 && plusHaut >= total && !courbesEnCours.current) {
            boucle.current++;
            return { ...e, total, faites: total, phase: 'fini', message: '' };
          }
          return plusHaut === e.faites && total === e.total ? e : { ...e, total, faites: plusHaut };
        });
      });
    }, 4000);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [userId, etat.phase]);

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
      else if (faites >= total) void rattraperCourbes(++boucle.current); // tout est importé : « fini » seulement si aucune courbe n'est d'une ancienne formule
      else lancer();
    });
    return () => {
      annule = true;
      boucle.current++; // fermer l'écran arrête le calcul
    };
  }, [demo, userId, lancer, rattraperCourbes, maj]);

  return { ...etat, demarrer, arreter };
}
