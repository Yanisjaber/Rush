// Édition d'une sortie réalisée (panneau PanneauReel, monté une fois dans App.svelte) et signal de rafraîchissement des pages.
export const edition = $state({ ouvert: false, sortie: null, date: '' });

/** Ouvre le panneau pour saisir une nouvelle sortie à la main. */
export function ouvrirCreation(date) {
  edition.sortie = null;
  edition.date = date;
  edition.ouvert = true;
}

/** Ouvre le panneau pour modifier une sortie (saisie à la main : modification ; Strava : retouches). */
export function ouvrirModification(sortie) {
  edition.sortie = sortie;
  edition.date = '';
  edition.ouvert = true;
}

export function fermerEdition() {
  edition.ouvert = false;
}

// Les pages lisent `donnees.version` dans leur chargement : quand elle change (sortie enregistrée, retouchée, supprimée), elles se rechargent.
export const donnees = $state({ version: 0 });
export function rafraichir() {
  donnees.version++;
}
