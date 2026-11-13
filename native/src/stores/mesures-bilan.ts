import { useSyncExternalStore } from 'react';
import type { MetriqueCumul } from '@/data/bilan/bilan';

// Les mesures choisies dans les menus du Bilan (« Distance ⌄ »), gardées tant que l'app n'est pas fermée : on change d'onglet ou d'écran, elles restent.
// `null` pour le cumul, le mois, la semaine, le jour et les records : la distance (ou le temps quand elle n'a pas de sens : musculation, « Tous les sports », plusieurs sports cochés).
// Le Bilan choisit ce défaut ; une mesure choisie dans un menu reste, elle.
export interface MesuresBilan {
  cumul: MetriqueCumul | null;
  repartition: MetriqueCumul;
  mois: MetriqueCumul | null;
  semaine: MetriqueCumul | null;
  /** La semaine type (les 7 jours de la semaine). */
  jour: MetriqueCumul | null;
  /** Les records de période (meilleur jour, semaine, mois). */
  records: MetriqueCumul | null;
}

let etat: MesuresBilan = { cumul: null, repartition: 'heures', mois: null, semaine: null, jour: null, records: null };
const abonnes = new Set<() => void>();

export function choisirMesure(quoi: keyof MesuresBilan, mesure: MetriqueCumul): void {
  if (etat[quoi] === mesure) return;
  etat = { ...etat, [quoi]: mesure };
  abonnes.forEach((f) => f());
}

export function useMesuresBilan(): MesuresBilan {
  return useSyncExternalStore(
    (rappel) => {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
    () => etat,
    () => etat,
  );
}
