// Édition d'une sortie réalisée (panneau PanneauReel, monté une fois dans App.svelte) et signal de rafraîchissement des pages.
// Elle est dans l'adresse (?sortie=nouvelle&date=… ou ?sortie=<id>) : après un rechargement, App.svelte la rouvre (voir hydraterEdition).
import { ouvrirPanneau, fermerPanneau } from '../routeur.svelte.js';
import { chargerSeance } from '../data/api.js';
import { donneesDemo } from '../data/demo.js';
import { dateIsoLocale } from '../utils/format.js';

export const edition = $state({ ouvert: false, sortie: null, date: '' });

/** Ouvre le panneau pour saisir une nouvelle sortie à la main. */
export function ouvrirCreation(date) {
  edition.sortie = null;
  edition.date = date;
  edition.ouvert = true;
  ouvrirPanneau({ sortie: 'nouvelle', date });
}

/** Ouvre le panneau pour modifier une sortie (saisie à la main : modification ; Strava : retouches). */
export function ouvrirModification(sortie) {
  edition.sortie = sortie;
  edition.date = '';
  edition.ouvert = true;
  ouvrirPanneau({ sortie: sortie.id });
}

export function fermerEdition() {
  edition.ouvert = false;
  fermerPanneau('sortie', 'date');
}

/** L'adresse dit si une sortie est ouverte (« nouvelle », un id, ou rien) : on aligne le panneau dessus. */
export async function hydraterEdition(id, jour, userId, demo) {
  if (!id) {
    edition.ouvert = false;
    return;
  }
  if (id === 'nouvelle') {
    if (edition.ouvert && !edition.sortie) return; // déjà ouvert en création : on ne touche pas à la saisie en cours
    edition.sortie = null;
    edition.date = jour || dateIsoLocale();
    edition.ouvert = true;
    return;
  }
  if (edition.sortie?.id === id) {
    edition.ouvert = true;
    return;
  }
  if (!demo && !userId) return;
  const ligne = demo ? donneesDemo().seances.find((s) => s.id === id) : (await chargerSeance(userId, id)).data;
  if (!ligne) return fermerPanneau('sortie', 'date');
  edition.sortie = ligne;
  edition.date = '';
  edition.ouvert = true;
}

// Les pages lisent `donnees.version` dans leur chargement : quand elle change (sortie enregistrée, retouchée, supprimée), elles se rechargent.
export const donnees = $state({ version: 0 });
export function rafraichir() {
  donnees.version++;
}
