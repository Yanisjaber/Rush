// Routeur minimal à base de hash (#/course/calendrier/2026-09). Suffisant pour GitHub Pages, sans configuration serveur.
// L'adresse est la source de vérité : page, sport choisi et détail (mois, année, vue) y sont écrits (voir data/adresses.js).
import { analyserAdresse, construireAdresse, estPageSport } from './data/adresses.js';
import { menu } from './stores/menu.svelte.js';

function lire() {
  return analyserAdresse(typeof location === 'undefined' ? '' : location.hash);
}

// route.chemin : la page SANS le sport ('/', '/calendrier', '/parametres/zones'…) ; route.sport : celui de l'adresse (ou null) ;
// route.sous : le détail (mois « 2026-09 », année « 2025 », vue « journal »…) ;
// route.q : ce qui est ouvert sur la page (panneau, mode édition… voir CLES_Q dans data/adresses.js).
const depart = lire();
export const route = $state({ chemin: depart.chemin, sport: depart.sport, sous: depart.sous, q: depart.q });

function appliquer() {
  const a = lire();
  if (a.redirection) {
    // ancienne adresse : on la remplace (sans ajouter d'entrée à l'historique), l'événement hashchange relira la bonne
    location.replace(location.pathname + location.search + a.redirection);
    return;
  }
  route.chemin = a.chemin;
  route.sport = a.sport;
  route.sous = a.sous;
  if (JSON.stringify(a.q) !== JSON.stringify(route.q)) route.q = a.q; // inchangé : on ne réveille personne
  // Une page qui suit le sport lit son choix dans l'adresse (sans sport = tous) ; Sommeil, Paramètres… gardent le dernier choix
  if (estPageSport(a.chemin)) menu.filtre = a.sport || 'tout';
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', appliquer);
  window.addEventListener('popstate', appliquer); // retour / avance du navigateur (aussi après nos pushState)
  appliquer();
}

export function aller(chemin) {
  location.hash = chemin;
}

// Change seulement ce qui est ouvert sur la page (le reste de l'adresse est gardé).
// pushState n'envoie pas d'événement : on relit nous-mêmes l'adresse.
function majQ(modifier, remplacer) {
  const a = analyserAdresse(location.hash);
  const q = modifier({ ...a.q });
  const adresse = construireAdresse({ sport: a.sport || 'tout', page: a.chemin, sous: a.sous, q });
  if (adresse === (location.hash || '#/')) return;
  const url = location.pathname + location.search + adresse;
  if (remplacer) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  appliquer();
}

/** Ouvre un panneau (ou un mode) : ajoute ces compléments à l'adresse, ex. ouvrirPanneau({ prevue: 'nouvelle', date: '2026-09-14' }). Le bouton Retour le referme. */
export function ouvrirPanneau(params, retirer = []) {
  majQ((q) => {
    for (const c of retirer) delete q[c];
    return { ...q, ...params };
  }, false);
}

/** Referme : retire ces clés de l'adresse (sans ajouter d'entrée à l'historique). */
export function fermerPanneau(...cles) {
  majQ((q) => {
    for (const c of cles) delete q[c];
    return q;
  }, true);
}

/** Adresse d'une page avec le sport choisi (celui du menu), ex. adresseDe('/bilan') → « #/course/bilan ». */
export function adresseDe(page, sous = '', sport = menu.filtre) {
  return construireAdresse({ sport, page, sous });
}

/**
 * Change le sport choisi. Sur une page qui suit le sport, on va à la même page pour ce sport (le mois du calendrier et
 * l'année du bilan sont gardés) ; sur Sommeil, Paramètres…, on retient seulement le choix.
 */
export function changerSport(sport) {
  const cible = sport || 'tout';
  if (estPageSport(route.chemin)) {
    const garde = route.chemin === '/calendrier' || route.chemin === '/bilan' ? route.sous : '';
    aller(construireAdresse({ sport: cible, page: route.chemin, sous: garde })); // les panneaux ouverts se referment : on change de vue
  } else {
    menu.filtre = cible;
  }
}

/** Le mode démo (?demo dans l'adresse) affiche l'app avec des données d'exemple, sans connexion. */
export function modeDemo() {
  return new URLSearchParams(location.search).has('demo');
}
