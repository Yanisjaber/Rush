import { useSyncExternalStore } from 'react';

// Un numéro de version qui change à chaque création, modification ou suppression de cycle, pour que le calendrier recharge ses cycles.
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

/** Le numéro de version des cycles : change dès qu'un cycle est créé, modifié ou supprimé. */
export const useVersionCycles = (): number => useSyncExternalStore(abonner, () => version, () => version);

/** Dit à tout le monde que les cycles ont changé (après une écriture sur le compte). */
export const cyclesChanges = (): void => prevenir();
