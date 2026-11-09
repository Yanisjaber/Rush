import { useSyncExternalStore } from 'react';
import { filtreDeSelection } from '@/data/sports/filtre';
import { fusionnerFamilles } from '@/data/sports/sports-choisis';

// État du menu des sports : les sports proposés et ceux qui sont cochés (un, plusieurs ou aucun = « Tous »). Partagé par tous les écrans
// (on coche « Course » sur l'Accueil, le Calendrier reste sur « Course »).
// Les sports viennent des données chargées : les sports choisis dans le compte (user_preferences) plus ceux que les séances
// révèlent (une séance de muscu, un programme, un test Hyrox…). Voir famillesDe (data/accueil.ts).
interface EtatMenu {
  familles: string[];
  /** Les sports cochés dans le menu ; vide = « Tous ». */
  selection: string[];
  /** Le filtre qui en découle, utilisé par tous les écrans : « tout », « course » ou « course+velo » (voir data/sports/filtre.ts). */
  filtre: string;
}

// Les deux sources de la liste : les sports que les données révèlent, et les sports que l'utilisateur a cochés.
// On les garde pour pouvoir recomposer la barre tout de suite quand il coche un sport, sans attendre un rechargement.
let deDonnees: string[] = [];
let choisis: string[] | null = null;
let etat: { familles: string[]; selection: string[] } = { familles: [], selection: [] };
const ecouteurs = new Set<() => void>();

function abonner(fn: () => void) {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}

/** Remplace la liste des sports du menu (après chargement des données). Sans changement réel, rien ne se redessine. */
export function definirFamilles(familles: string[]) {
  if (familles.length === etat.familles.length && familles.every((f, i) => f === etat.familles[i])) return;
  etat = { ...etat, familles };
  ecouteurs.forEach((fn) => fn());
}

// Règle : si l'utilisateur a choisi des sports, SA liste décide (ce qui est coché = ce qui est affiché, il peut tout décocher).
// Ses séances ne décident que tant qu'il n'a rien choisi (compte jamais configuré, ou « Passer »).
function composer(): string[] {
  return choisis && choisis.length ? fusionnerFamilles([], choisis) : fusionnerFamilles(deDonnees, choisis);
}

/** Après le chargement des données : mémorise les deux sources et recompose la barre. */
export function definirSources(donnees: string[], coches: string[] | null) {
  deDonnees = donnees;
  choisis = coches;
  definirFamilles(composer());
}

/** L'utilisateur vient de cocher ou décocher un sport : la barre se recompose immédiatement. */
export function definirSportsCoches(coches: string[]) {
  choisis = coches;
  definirFamilles(composer());
}

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
