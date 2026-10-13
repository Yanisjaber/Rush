// Routeur minimal à base de hash (#/course/calendrier/2026-09). Suffisant pour GitHub Pages, sans configuration serveur.
// L'adresse est la source de vérité : page, sport choisi et détail (mois, année, vue) y sont écrits (voir data/adresses.js).
import { analyserAdresse, construireAdresse, estPageSport } from './data/adresses.js';
import { menu } from './stores/menu.svelte.js';

function lire() {
  return analyserAdresse(typeof location === 'undefined' ? '' : location.hash);
}

// route.chemin : la page SANS le sport ('/', '/calendrier', '/parametres/zones'…) ; route.sport : celui de l'adresse (ou null) ;
// route.sous : le détail (mois « 2026-09 », année « 2025 », vue « journal »…).
const depart = lire();
export const route = $state({ chemin: depart.chemin, sport: depart.sport, sous: depart.sous });

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
  // Une page qui suit le sport lit son choix dans l'adresse (sans sport = tous) ; Sommeil, Paramètres… gardent le dernier choix
  if (estPageSport(a.chemin)) menu.filtre = a.sport || 'tout';
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', appliquer);
  appliquer();
}

export function aller(chemin) {
  location.hash = chemin;
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
    aller(construireAdresse({ sport: cible, page: route.chemin, sous: garde }));
  } else {
    menu.filtre = cible;
  }
}

/** Le mode démo (?demo dans l'adresse) affiche l'app avec des données d'exemple, sans connexion. */
export function modeDemo() {
  return new URLSearchParams(location.search).has('demo');
}
