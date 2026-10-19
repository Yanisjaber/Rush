import { useSyncExternalStore } from 'react';
import { filtreApres, filtreValide } from '@/data/menu';
import { fusionnerFamilles } from '@/data/sports-choisis';

// État du menu des sports : les sports proposés et le filtre choisi. Partagé par tous les écrans
// (on choisit « Course » sur l'Accueil, le Calendrier reste sur « Course »).
// Les sports viennent des données chargées : les sports choisis dans le compte (user_preferences) plus ceux que les séances
// révèlent (une séance de muscu, un programme, un test Hyrox…). Voir famillesDe (data/accueil.ts).
interface EtatMenu {
  familles: string[];
  filtre: string;
}

// Les deux sources de la liste : les sports que les données révèlent, et les sports que l'utilisateur a cochés.
// On les garde pour pouvoir recomposer la barre tout de suite quand il coche un sport, sans attendre un rechargement.
let deDonnees: string[] = [];
let choisis: string[] | null = null;
let etat: EtatMenu = { familles: [], filtre: 'tout' };
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

/** Après le chargement des données : mémorise les deux sources et recompose la barre. */
export function definirSources(donnees: string[], coches: string[] | null) {
  deDonnees = donnees;
  choisis = coches;
  definirFamilles(fusionnerFamilles(deDonnees, choisis));
}

/** L'utilisateur vient de cocher ou décocher un sport : la barre se recompose immédiatement. */
export function definirSportsCoches(coches: string[]) {
  choisis = coches;
  definirFamilles(fusionnerFamilles(deDonnees, choisis));
}

/** Choisit le sport affiché ; recliquer sur le sport déjà choisi revient à « Tous ». */
export function choisirFiltre(famille: string) {
  const filtre = filtreApres(etat.filtre, famille);
  if (filtre === etat.filtre) return;
  etat = { ...etat, filtre };
  ecouteurs.forEach((fn) => fn());
}

/** Le menu courant ; le filtre est déjà vérifié (un sport retiré du menu donne « tout »). */
export function useMenu(): EtatMenu {
  const e = useSyncExternalStore(abonner, () => etat, () => etat);
  return { familles: e.familles, filtre: filtreValide(e.filtre, e.familles) };
}
