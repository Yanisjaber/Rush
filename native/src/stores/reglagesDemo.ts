import { useSyncExternalStore } from 'react';

// Les réglages du mode démo (en mémoire, jamais enregistrés) : de quoi montrer chaque cas de l'interface sans changer les données à la main.
// Pour l'instant : combien de séances sont prévues aujourd'hui (0 : rien de prévu, 1, 2 ou 3).
export const PREVUES_AUJOURDHUI = [0, 1, 2, 3] as const;
export type NbPrevues = (typeof PREVUES_AUJOURDHUI)[number];

interface EtatReglagesDemo {
  prevuesAujourdhui: NbPrevues;
}

let etat: EtatReglagesDemo = { prevuesAujourdhui: 3 };
const ecouteurs = new Set<() => void>();

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

export const useReglagesDemo = (): EtatReglagesDemo => useSyncExternalStore(abonner, () => etat, () => etat);

/** Choisit le nombre de séances prévues aujourd'hui dans la démo (toute autre valeur est ignorée). */
export function definirPrevuesAujourdhui(n: number) {
  if (!PREVUES_AUJOURDHUI.includes(n as NbPrevues) || n === etat.prevuesAujourdhui) return;
  etat = { ...etat, prevuesAujourdhui: n as NbPrevues };
  ecouteurs.forEach((fn) => fn());
}
