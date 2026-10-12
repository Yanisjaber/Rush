// Aperçu d'une séance réalisée : une petite fenêtre de résumé, ouverte depuis le calendrier ou les widgets.
// Un seul état partagé : la fenêtre (PanneauSeance) est montée une fois dans App.svelte.
export const apercu = $state({ ouvert: false, seance: null });

/** Ouvre le résumé de cette séance (ligne de la table activities, colonnes légères). */
export function ouvrirApercu(seance) {
  apercu.seance = seance;
  apercu.ouvert = true;
}

export function fermerApercu() {
  apercu.ouvert = false;
}

/** Met à jour la séance affichée (ex. après l'avoir marquée comme compétition). */
export function majApercu(champs) {
  if (apercu.seance) apercu.seance = { ...apercu.seance, ...champs };
}
