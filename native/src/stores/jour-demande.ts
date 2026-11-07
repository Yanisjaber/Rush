import { useSyncExternalStore } from 'react';

// Un jour que le coach demande d'afficher dans le Calendrier (« montre-moi jeudi »). Le Calendrier le lit, saute à ce jour, puis le consomme.
let jour: string | null = null;
const ecouteurs = new Set<() => void>();
const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

export const useJourDemande = (): string | null => useSyncExternalStore(abonner, () => jour, () => null);

export function demanderJour(iso: string): void {
  jour = iso;
  ecouteurs.forEach((fn) => fn());
}

/** Le Calendrier a sauté au jour demandé : on n'y revient pas */
export function consommerJour(): void {
  if (jour === null) return;
  jour = null;
  ecouteurs.forEach((fn) => fn());
}
