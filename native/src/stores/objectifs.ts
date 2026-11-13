import { useSyncExternalStore } from 'react';

// Un numéro de version qui change à chaque création, modification ou suppression d'objectif, pour que le Bilan recharge ses objectifs.
let version = 0;
const ecouteurs = new Set<() => void>();
const prevenir = () => {
  version += 1;
  ecouteurs.forEach((fn) => fn());
};
const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

/** Le numéro de version des objectifs : change dès qu'un objectif est créé, modifié ou supprimé. */
export const useVersionObjectifs = (): number => useSyncExternalStore(abonner, () => version, () => version);

/** Dit à tout le monde que les objectifs ont changé (après une écriture sur le compte). */
export const objectifsChanges = (): void => prevenir();
