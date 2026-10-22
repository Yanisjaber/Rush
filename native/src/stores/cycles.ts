import { useSyncExternalStore } from 'react';
import type { FormulaireCycle } from '@/data/cycles';
import { dateIsoLocale } from '@/data/format';
import type { Cycle } from '@/data/types';

// Les cycles de la démo (en mémoire seulement : ils survivent à la navigation, pas à un relancement), et un numéro de version qui change à chaque
// création, modification ou suppression (démo ou compte), pour que le calendrier recharge ses cycles.
const jour = (delta: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return dateIsoLocale(d);
};

let demoCycles: Cycle[] = [
  { id: 'demo-cycle-force', name: 'Bloc force', from_date: jour(-20), to_date: jour(2), color: '#9b6b9e' },
  { id: 'demo-cycle-hyrox', name: 'Prépa Hyrox', from_date: jour(-6), to_date: jour(27), color: '#e0a458' },
  { id: 'demo-cycle-affutage', name: 'Affûtage', from_date: jour(20), to_date: jour(27), color: '#5ec2b7' },
  { id: 'demo-cycle-recup', name: 'Récupération', from_date: jour(28), to_date: jour(34), color: '#7fb069' },
];
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

export const cyclesDemo = (): Cycle[] => demoCycles;

export function creerCycleDemo(v: FormulaireCycle): Cycle {
  const c: Cycle = { id: `demo-cycle-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...v };
  demoCycles = [...demoCycles, c];
  prevenir();
  return c;
}

export function modifierCycleDemo(id: string, v: FormulaireCycle): Cycle | null {
  const existant = demoCycles.find((c) => c.id === id);
  if (!existant) return null;
  const c = { ...existant, ...v };
  demoCycles = demoCycles.map((x) => (x.id === id ? c : x));
  prevenir();
  return c;
}

export function supprimerCycleDemo(id: string): void {
  demoCycles = demoCycles.filter((c) => c.id !== id);
  prevenir();
}
