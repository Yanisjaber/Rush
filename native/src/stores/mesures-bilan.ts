import { useSyncExternalStore } from 'react';
import type { MetriqueCumul } from '@/data/bilan/bilan';

// Les mesures choisies dans les menus du Bilan (« Distance ⌄ »), gardées tant que l'app n'est pas fermée : on change d'onglet ou d'écran, elles restent.
// `null` pour le mois et la semaine : la distance (ou le temps si le sport n'a pas de distance, comme la musculation).
export interface MesuresBilan {
  cumul: MetriqueCumul;
  repartition: MetriqueCumul;
  mois: MetriqueCumul | null;
  semaine: MetriqueCumul | null;
}

let etat: MesuresBilan = { cumul: 'distance_km', repartition: 'heures', mois: null, semaine: null };
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
