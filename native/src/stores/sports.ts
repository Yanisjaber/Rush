import { useSyncExternalStore } from 'react';

// Quand les sports changent (bouton « + », Mes sports, onboarding), l'Accueil doit se recomposer.
// Ce petit état partagé sert de signal : `version` augmente à chaque changement, l'Accueil recharge ses données.
// En démo il n'y a pas de base : les sports choisis sont gardés ici, en mémoire.
interface EtatSports {
  version: number;
  demo: string[] | null;
  demoDisciplines: Record<string, string[]>;
}

let etat: EtatSports = { version: 0, demo: null, demoDisciplines: {} };
const ecouteurs = new Set<() => void>();

function abonner(fn: () => void) {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}

function changer(suite: Partial<EtatSports>) {
  etat = { ...etat, ...suite };
  ecouteurs.forEach((fn) => fn());
}

/** Signale que les sports du compte ont changé : l'Accueil recharge. */
export const sportsModifies = () => changer({ version: etat.version + 1 });

/** Démo : mémorise les sports choisis (rien n'est écrit nulle part). */
export const definirSportsDemo = (liste: string[], disciplines: Record<string, string[]> = {}) => changer({ demo: liste, demoDisciplines: disciplines, version: etat.version + 1 });

export const useSportsEtat = (): EtatSports => useSyncExternalStore(abonner, () => etat, () => etat);
