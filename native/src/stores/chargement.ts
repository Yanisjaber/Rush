import { useSyncExternalStore } from 'react';

// L'Accueil a-t-il reçu ses données ? L'écran de chargement du démarrage (ou d'après la connexion) attend ce signal
// pour s'effacer : derrière lui, l'Accueil est déjà rempli, sans petit spinner de « chargement de tes données ».
let accueilCharge = false;
const ecouteurs = new Set<() => void>();

export function marquerAccueilCharge(valeur: boolean): void {
  if (valeur === accueilCharge) return;
  accueilCharge = valeur;
  ecouteurs.forEach((fn) => fn());
}

export const useAccueilCharge = (): boolean =>
  useSyncExternalStore(
    (suite) => {
      ecouteurs.add(suite);
      return () => {
        ecouteurs.delete(suite);
      };
    },
    () => accueilCharge,
    () => accueilCharge,
  );
