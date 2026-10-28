import { useSyncExternalStore } from 'react';
import { mesuresDemo } from '@/data/demo/demo';
import { remplacerSaisie, type LigneMesure } from '@/data/sante/sante-catalogue';

// Les mesures de santé du mode démo : des données d'exemple au départ, puis ce que tu saisis, gardé en mémoire seulement (rien n'est écrit nulle part).
let lignes: LigneMesure[] | null = null;
const ecouteurs = new Set<() => void>();

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};
const lire = (): LigneMesure[] => (lignes ??= mesuresDemo(new Date(), 120));

/** Saisit (ou, avec null, efface) une mesure en démo. */
export function saisirMesureDemo(date: string, metric: string, valeur: number | null) {
  lignes = remplacerSaisie(lire(), date, metric, valeur);
  ecouteurs.forEach((fn) => fn());
}

export const useMesuresDemo = (): LigneMesure[] => useSyncExternalStore(abonner, lire, lire);
