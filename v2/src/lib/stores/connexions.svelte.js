// Retour de Strava après l'autorisation : Strava renvoie vers l'app avec ?strava_connected=1 ou ?strava_error=…
// On lit ça une fois au démarrage, on nettoie l'adresse, et on envoie l'utilisateur sur l'onglet Connexions.
import { lireRetourOAuth } from '../data/connexions.js';
import { route } from '../routeur.svelte.js';

export const retourStrava = $state({ connecte: false, erreur: '' });

/** À appeler une fois au démarrage de l'app (hors démo). */
export function lireRetourDansAdresse() {
  const r = lireRetourOAuth(location.search);
  if (!r.connecte && !r.erreur) return;
  retourStrava.connecte = r.connecte;
  retourStrava.erreur = r.erreur;
  // Adresse propre (sans les paramètres de retour), puis direction l'onglet Connexions
  const u = new URL(location.href);
  u.searchParams.delete('strava_connected');
  u.searchParams.delete('strava_error');
  u.hash = '#/parametres/connexions';
  history.replaceState({}, '', u.toString());
  route.chemin = '/parametres/connexions'; // replaceState ne déclenche pas le routeur : on le met à jour
}

/** L'onglet Connexions a pris en compte le retour : on l'efface pour ne pas le rejouer. */
export function effacerRetour() {
  retourStrava.connecte = false;
  retourStrava.erreur = '';
}
