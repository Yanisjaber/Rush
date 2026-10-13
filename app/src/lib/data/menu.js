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
 * Barre du bas du téléphone : Accueil, Calendrier, Plan, « Sports » (la feuille pour choisir le sport, seulement si l'on en a)
 * puis « Plus » (le reste, réglages compris). Renvoie { items, plus } : `items` pour la barre, `plus` pour la feuille « Plus ».
 */
export function barreBas(familles = []) {
  const items = [page('accueil'), page('calendrier'), page('plan')];
  if ((familles || []).length) items.push({ cle: 'sports', nom: 'Sports', ouvre: 'sports' });
  items.push({ cle: 'plus', nom: 'Plus', ouvre: 'plus' });
  return { items, plus: ['competitions', 'bilan', 'sommeil', 'parametres'].map(page) };
}

/** Quelle page correspond au chemin courant (sans le sport) pour surligner le bon bouton ? null si aucune. */
export function cleDePage(chemin) {
  const c = String(chemin || '/');
  if (c === '/' || c === '') return 'accueil';
  const premier = c.split('/')[1];
  if (premier === 'force' || premier === 'analyse') return 'accueil'; // la séance de force en direct et les analyses se rattachent à l'accueil
  if (Object.hasOwn(PAGES, premier)) return premier;
  return null;
}

/** La page courante est-elle l'une de celles qu'on cache derrière « Plus » ? Sert à surligner ce bouton. */
export function ouvertureActive(cle) {
  return cle && barreBas([]).plus.some((p) => p.cle === cle) ? 'plus' : null;
}
