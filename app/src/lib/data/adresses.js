// Adresses de l'app (#/…) : lecture et construction. Fonctions pures, sans navigateur.
//
// Forme générale : #/<sport>/<page>/<détail>
//   #/                       Accueil, tous sports        #/course              Accueil Course
//   #/calendrier             Calendrier, tous sports     #/velo/calendrier/2026-09   Calendrier Vélo, mois de septembre 2026
//   #/plan  #/competitions   (idem, avec ou sans sport)  #/muscu/bilan/2025          Bilan Muscu 2025
//   #/muscu/programmes|journal|exercices   Accueil Muscu, vue détaillée           #/hyrox/tests   Accueil Hyrox, tests et objectif
//   #/sommeil  #/parametres/…  #/seance/<id>  #/force/seance/…   pages sans sport : inchangées
// Complément après « ? » : ce qui est ouvert sur la page (panneaux, mode édition…), pour retrouver la même vue après un rechargement.
//   #/course/calendrier/2026-09?prevue=nouvelle&date=2026-09-14     nouvelle séance prévue le 14 septembre
//   #/velo/plan?prevue=<id>   #/course?apercu=<id>   #/course/competitions?competition=nouvelle   #/bilan?objectif=<id>   #/?edition=1
// Anciennes adresses : #/force, #/force/journal, #/force/exercices sont renvoyées vers l'accueil Muscu (champ `redirection`).
import { SPORTS } from '../sports.js';

/** Pages qui dépendent du sport choisi (le reste, comme Sommeil ou Paramètres, l'ignore). */
export const PAGES_SPORT = ['calendrier', 'plan', 'competitions', 'bilan'];

/** Vues détaillées de l'accueil des sports qui en ont une. */
export const SOUS_ACCUEIL = { muscu: ['programmes', 'journal', 'exercices'], hyrox: ['tests'] };

/**
 * Compléments d'adresse autorisés (liste fermée) et leur forme : 'id' (identifiant, ou « nouvelle » / « nouveau »), 'date' (AAAA-MM-JJ),
 * 'mot' (valeur courte en minuscules) ou 'drapeau' (présent = actif, écrit « 1 »). Tout le reste est ignoré.
 */
export const CLES_Q = {
  prevue: 'id', sortie: 'id', apercu: 'id', competition: 'id', marquage: 'id', modele: 'id', objectif: 'id', programme: 'id', test: 'id',
  date: 'date', metrique: 'mot',
  modeles: 'drapeau', objectifhyrox: 'drapeau', licence: 'drapeau', edition: 'drapeau', fc: 'drapeau',
};
const FORMES = { id: /^[A-Za-z0-9_-]{1,64}$/, date: /^\d{4}-\d{2}-\d{2}$/, mot: /^[a-z_]{1,30}$/, drapeau: /^1?$/ };

/** Lit un complément d'adresse (« a=1&b=x » ou un objet) et ne garde que les clés connues aux valeurs bien formées. */
export function nettoyerQ(brut) {
  const sortie = {};
  const source = typeof brut === 'string' ? [...new URLSearchParams(brut).entries()] : Object.entries(brut || {});
  for (const [cle, valeur] of source) {
    if (!Object.hasOwn(CLES_Q, cle) || Object.hasOwn(sortie, cle)) continue;
    const v = String(valeur ?? '');
    if (!FORMES[CLES_Q[cle]].test(v)) continue;
    sortie[cle] = CLES_Q[cle] === 'drapeau' ? '1' : v;
  }
  return sortie;
}

/** Un mot de l'adresse est-il un sport (course, velo, muscu…) ? « autre » ne compte pas. */
export function estSport(mot) {
  return typeof mot === 'string' && mot !== 'autre' && Object.hasOwn(SPORTS, mot);
}

/** Cette page (chemin sans sport, ex. '/bilan') suit-elle le sport choisi ? */
export function estPageSport(chemin) {
  return chemin === '/' || PAGES_SPORT.includes(String(chemin).replace(/^\//, ''));
}

/**
 * Construit une adresse. page : '/', '/calendrier', '/sommeil'… (avec ou sans « / » devant) ; sous : détail éventuel.
 * Le sport n'est écrit que pour les pages qui le suivent ; 'tout' ou absent : pas de préfixe.
 */
export function construireAdresse({ sport = 'tout', page = '/', sous = '', q = null } = {}) {
  const chemin = '/' + String(page).replace(/^\//, '');
  const parties = [];
  if (estPageSport(chemin) && estSport(sport)) parties.push(sport);
  if (chemin !== '/') parties.push(chemin.slice(1));
  if (sous) parties.push(String(sous));
  const propre = nettoyerQ(q);
  const complement = new URLSearchParams(propre).toString();
  return '#/' + parties.join('/') + (complement ? '?' + complement : '');
}

/**
 * Lit une adresse (avec ou sans « # »).
 * Renvoie { chemin, sport, sous, q, redirection } :
 *  - chemin : la page, sans le sport ('/' pour l'accueil, '/calendrier', '/parametres/connexions'…) ;
 *  - sport : celui de l'adresse, ou null s'il n'y en a pas ;
 *  - sous : le détail (mois, année, vue détaillée…), '' sinon ;
 *  - q : les compléments d'adresse valides (panneau ouvert, mode édition…), objet vide sinon ;
 *  - redirection : adresse à utiliser à la place (anciennes adresses), sinon null.
 */
export function analyserAdresse(brut) {
  const [texte, complement = ''] = String(brut || '').replace(/^#/, '').split(/\?(.*)/s);
  const q = nettoyerQ(complement);
  const seg = texte.split('/').filter(Boolean);

  // Anciennes adresses de l'écran Muscu : maintenant, l'accueil Muscu
  if (seg[0] === 'force' && (seg.length === 1 || (seg.length === 2 && ['journal', 'exercices'].includes(seg[1])))) {
    const sous = seg[1] || 'programmes';
    return { chemin: '/', sport: 'muscu', sous, q, redirection: construireAdresse({ sport: 'muscu', sous, q }) };
  }

  let sport = null;
  if (estSport(seg[0])) sport = seg.shift();
  if (!seg.length) return { chemin: '/', sport, sous: '', q, redirection: null };

  // Vue détaillée de l'accueil d'un sport (#/muscu/journal, #/hyrox/tests)
  if (sport && seg.length === 1 && SOUS_ACCUEIL[sport]?.includes(seg[0])) return { chemin: '/', sport, sous: seg[0], q, redirection: null };

  // Page qui suit le sport, avec son détail (mois du calendrier, année du bilan)
  if (PAGES_SPORT.includes(seg[0]) && seg.length <= 2) return { chemin: '/' + seg[0], sport, sous: seg[1] || '', q, redirection: null };

  // Tout le reste : adresse inchangée (sport éventuel conservé)
  return { chemin: '/' + seg.join('/'), sport, sous: '', q, redirection: null };
}

/** Mois d'un calendrier écrit dans l'adresse (« 2026-09 ») → { annee, mois (0 à 11) }, ou null si invalide. */
export function moisDepuisAdresse(sous) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(sous || ''));
  if (!m) return null;
  const annee = Number(m[1]);
  return annee >= 2000 && annee <= 2100 ? { annee, mois: Number(m[2]) - 1 } : null;
}

/** { annee, mois (0 à 11) } → « 2026-09 ». */
export function moisVersAdresse({ annee, mois }) {
  return `${annee}-${String(mois + 1).padStart(2, '0')}`;
}

/** Année d'un bilan écrite dans l'adresse (« 2025 ») → nombre, ou null si invalide. */
export function anneeDepuisAdresse(sous) {
  const m = /^(\d{4})$/.exec(String(sous || ''));
  const a = m ? Number(m[1]) : 0;
  return a >= 2000 && a <= 2100 ? a : null;
}
