import { useSyncExternalStore } from 'react';
import type { ObjectifAnnuel } from '@/data/bilan';
import { objectifsAnnuelsDemo } from '@/data/demo';

// Les objectifs annuels de la démo (en mémoire seulement : ils survivent à la navigation, pas à un relancement), et un numéro de version qui change à chaque
// création, modification ou suppression (démo ou compte), pour que le Bilan recharge ses objectifs.
let demoObjectifs: ObjectifAnnuel[] = objectifsAnnuelsDemo(new Date());
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

export const objectifsDemo = (): ObjectifAnnuel[] => demoObjectifs;

export function creerObjectifDemo(annee: number, v: { sport: string; template: string; target: number; current_manual: number | null }): ObjectifAnnuel {
  const o: ObjectifAnnuel = { id: `demo-g-${Date.now()}-${Math.floor(Math.random() * 1000)}`, annee, sport: v.sport, template: v.template, target: v.target, currentManual: v.current_manual ?? undefined };
  demoObjectifs = [...demoObjectifs, o];
  prevenir();
  return o;
}

export function modifierObjectifDemo(id: string, v: { target: number; current_manual: number | null }): boolean {
  if (!demoObjectifs.some((o) => o.id === id)) return false;
  demoObjectifs = demoObjectifs.map((o) => (o.id === id ? { ...o, target: v.target, currentManual: v.current_manual ?? undefined } : o));
  prevenir();
  return true;
}

export function supprimerObjectifDemo(id: string): void {
  demoObjectifs = demoObjectifs.filter((o) => o.id !== id);
  prevenir();
}
