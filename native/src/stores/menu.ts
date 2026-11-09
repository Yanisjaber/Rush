import { useSyncExternalStore } from 'react';
import { filtreDeSelection } from '@/data/sports/filtre';

// État du menu des sports : les sports proposés et ceux qui sont cochés (un, plusieurs ou aucun = « Tous »). Partagé par tous les écrans
// (on coche « Course » sur l'Accueil, le Calendrier reste sur « Course »).
interface EtatMenu {
  familles: string[];
  /** Les sports cochés dans le menu ; vide = « Tous ». */
  selection: string[];
  /** Le filtre qui en découle, utilisé par tous les écrans : « tout », « course » ou « course+velo » (voir data/sports/filtre.ts). */
  filtre: string;
}

// Les sports du menu sont fixes (décision du 9 nov. 2026) : Course, Vélo, Natation, Musculation et Autres (ski, rando, tennis…), pour tout le monde.
// Plus de « + » pour en ajouter ou en retirer. Les sports cochés dans le compte et ceux que les séances révèlent ne changent plus le menu.
export const SPORTS_DU_MENU: readonly string[] = ['course', 'velo', 'natation', 'muscu', 'autre'];

let etat: { familles: string[]; selection: string[] } = { familles: [...SPORTS_DU_MENU], selection: [] };
const ecouteurs = new Set<() => void>();

function abonner(fn: () => void) {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}

/** Après le chargement des données : le menu reste le même (ses sports sont fixes). Gardée pour les appelants existants. */
export function definirSources(_donnees: string[], _coches: string[] | null) {}

/** L'utilisateur vient de cocher ou décocher un sport dans ses préférences : le menu ne change pas (ses sports sont fixes). */
export function definirSportsCoches(_coches: string[]) {}

/** Applique la sélection de sports cochés dans le menu (liste vide ou tout coché = « Tous »). Un sport absent de la barre est ignoré. */
export function definirSelection(selection: string[]) {
  const propre = etat.familles.filter((f) => selection.includes(f));
  if (propre.length === etat.selection.length && propre.every((f, i) => f === etat.selection[i])) return;
  etat = { ...etat, selection: propre };
  ecouteurs.forEach((fn) => fn());
}

/** Impose ce seul sport comme filtre (depuis le Coach, par exemple). Un sport absent du menu est ignoré. */
export function imposerFiltre(famille: string) {
  if (!etat.familles.includes(famille)) return;
  definirSelection([famille]);
}

/** Le menu courant : les sports de la barre, la sélection cochée et le filtre qui en découle (« tout », « course » ou « course+velo »). Un sport retiré de la barre sort de la sélection. */
export function useMenu(): EtatMenu {
  const e = useSyncExternalStore(abonner, () => etat, () => etat);
  const selection = e.familles.filter((f) => e.selection.includes(f));
  return { familles: e.familles, selection, filtre: filtreDeSelection(selection, e.familles) };
}
