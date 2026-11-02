import { useSyncExternalStore } from 'react';

// Les données écartées d'une activité changent tous les calculs (charge, records, niveau, totaux) : dès qu'on en écarte ou en remet une,
// les écrans qui les affichent doivent relire leurs données, et les caches (records, niveau global, courbes) doivent se vider.
// Chaque module qui garde un cache s'inscrit avec `auChangementDEcarts` ; chaque écran qui lit des activités suit `useVersionEcarts`.
let version = 0;
const ecouteurs = new Set<() => void>();
const viderLesCaches = new Set<() => void>();

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

/** Le numéro de version des données écartées : change à chaque écart ou remise. À mettre dans les dépendances d'un chargement. */
export const useVersionEcarts = (): number => useSyncExternalStore(abonner, () => version, () => version);

/** Inscrit une fonction qui vide un cache à chaque changement (à appeler une fois, au chargement du module qui a le cache). */
export const auChangementDEcarts = (viderLeCache: () => void): void => {
  viderLesCaches.add(viderLeCache);
};

/** Dit que des données ont été écartées ou remises : vide les caches, puis réveille les écrans. */
export const ecartsChanges = (): void => {
  version += 1;
  viderLesCaches.forEach((fn) => fn());
  ecouteurs.forEach((fn) => fn());
};
