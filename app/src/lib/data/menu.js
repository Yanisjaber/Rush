// Le menu de l'app : les pages et leurs adresses. Fonctions pures, sans réseau.
// Les sports (Course, Vélo, Muscu, Hyrox…) ne sont pas des pages : ce sont des filtres, écrits dans l'adresse (voir adresses.js).
import { construireAdresse } from './adresses.js';

export const PAGES = {
  accueil: { nom: 'Accueil', chemin: '/' },
  calendrier: { nom: 'Calendrier', chemin: '/calendrier' },
  plan: { nom: 'Plan', chemin: '/plan' },
  competitions: { nom: 'Compétitions', chemin: '/competitions' },
  bilan: { nom: 'Bilan', chemin: '/bilan' },
  sommeil: { nom: 'Sommeil', chemin: '/sommeil' },
  sante: { nom: 'Santé', chemin: '/sommeil' }, // même page que Sommeil : seul le nom change, dans la barre du bas du téléphone
  parametres: { nom: 'Paramètres', chemin: '/parametres' },
};

/** Adresse d'une page du menu pour le sport choisi : lienPage('bilan', 'course') → « #/course/bilan » (Sommeil et Paramètres : sans sport). */
export function lienPage(cle, sport = 'tout') {
  const p = PAGES[cle];
  return p ? construireAdresse({ sport, page: p.chemin }) : '#/';
}

export const page = (cle) => ({ cle, ...PAGES[cle] });

/** Menu de l'ordinateur : les pages, dans l'ordre. */
export function pagesMenu() {
  return ['accueil', 'calendrier', 'plan', 'competitions', 'bilan', 'sommeil'].map(page);
}

/**
 * Barre du bas du téléphone : Accueil, Calendrier, Bilan, Santé, Paramètres.
 * Le Plan s'ouvre depuis le Calendrier ; les Compétitions ne sont plus au menu du téléphone.
 * Le choix du sport n'est plus ici : c'est la barre fixe du haut (SelecteurSport).
 * Renvoie { items } : les boutons de la barre.
 */
export function barreBas() {
  return { items: ['accueil', 'calendrier', 'bilan', 'sante', 'parametres'].map(page) };
}

/** Quelle page correspond au chemin courant (sans le sport) pour surligner le bon bouton ? null si aucune. */
export function cleDePage(chemin) {
  const c = String(chemin || '/');
  if (c === '/' || c === '') return 'accueil';
  const premier = c.split('/')[1];
  if (premier === 'force' || premier === 'analyse') return 'accueil'; // la séance de force en direct et les analyses se rattachent à l'accueil
  if (premier === 'plan') return 'calendrier'; // le Plan s'ouvre depuis le Calendrier
  if (premier === 'sommeil') return 'sante';
  if (Object.hasOwn(PAGES, premier)) return premier;
  return null;
}
