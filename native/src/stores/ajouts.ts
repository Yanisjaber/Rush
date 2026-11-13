import { useSyncExternalStore } from 'react';

// Un numéro de version change à chaque ajout, modification ou suppression au calendrier (séance prévue, compétition, note, repos, sortie)
// pour que le calendrier, la fiche d'une séance et les autres écrans rechargent leurs données.
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

/** Le numéro de version des ajouts : change dès qu'une séance prévue, une compétition ou une note est ajoutée. */
export const useVersionAjouts = (): number => useSyncExternalStore(abonner, () => version, () => version);

/** Dit à tout le monde que le calendrier a changé (après une écriture sur le compte). */
export const ajoutsChanges = (): void => prevenir();
