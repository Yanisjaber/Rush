// Aperçu d'une séance réalisée : une petite fenêtre de résumé, ouverte depuis le calendrier ou les widgets.
// Un seul état partagé : la fenêtre (PanneauSeance) est montée une fois dans App.svelte.
// Il est dans l'adresse (?apercu=<id>) : après un rechargement, App.svelte rouvre la même séance (voir hydraterApercu).
import { ouvrirPanneau, fermerPanneau } from '../routeur.svelte.js';
import { chargerSeance } from '../data/api.js';
import { donneesDemo } from '../data/demo.js';

export const apercu = $state({ ouvert: false, seance: null });

/** Ouvre le résumé de cette séance (ligne de la table activities, colonnes légères). */
export function ouvrirApercu(seance) {
  apercu.seance = seance;
  apercu.ouvert = true;
  ouvrirPanneau({ apercu: seance.id });
}

export function fermerApercu() {
  apercu.ouvert = false;
  fermerPanneau('apercu');
}

/** Met à jour la séance affichée (ex. après l'avoir marquée comme compétition). */
export function majApercu(champs) {
  if (apercu.seance) apercu.seance = { ...apercu.seance, ...champs };
}

/**
 * L'adresse dit quelle séance est ouverte (id, ou rien) : on aligne le panneau dessus (arrivée sur la page, retour du navigateur).
 * Une séance introuvable referme proprement l'adresse.
 */
export async function hydraterApercu(id, userId, demo) {
  if (!id) {
    apercu.ouvert = false;
    return;
  }
  if (apercu.seance?.id === id) {
    apercu.ouvert = true;
    return;
  }
  if (!demo && !userId) return; // la connexion n'est pas encore prête : on réessaiera
  const ligne = demo ? donneesDemo().seances.find((s) => s.id === id) : (await chargerSeance(userId, id)).data;
  if (!ligne) return fermerPanneau('apercu');
  apercu.seance = ligne;
  apercu.ouvert = true;
}
