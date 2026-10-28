import { useSyncExternalStore } from 'react';
import type { PeriodeProgression } from '@/data/bilan/progression';

// La période choisie pour comparer (4 semaines, 3 mois, 1 an) : la même pour toutes les tailles du widget Progression, le temps de la session.
let periode: PeriodeProgression = 91;
const abonnes = new Set<() => void>();

export function choisirPeriodeProgression(jours: PeriodeProgression): void {
  if (jours === periode) return;
  periode = jours;
  abonnes.forEach((f) => f());
}

export function usePeriodeProgression(): PeriodeProgression {
  return useSyncExternalStore(
    (rappel) => {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
    () => periode,
    () => periode,
  );
}
