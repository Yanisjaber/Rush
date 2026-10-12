// Connexions (Strava, Garmin) : fonctions pures (statuts, textes, adresse d'autorisation, retour de Strava).
// Aucun appel réseau ici : voir integrations.js.

export const SCOPES_STRAVA = 'read,activity:read_all,profile:read_all';
const URL_AUTORISATION_STRAVA = 'https://www.strava.com/oauth/authorize';

/** Statut d'une connexion : { cle: 'non' | 'ok' | 'erreur', texte }. `conn` est la ligne de connexions_app (ou null). */
export function statutConnexion(conn) {
  if (!conn) return { cle: 'non', texte: 'Non connecté' };
  if (conn.last_sync_status === 'error') return { cle: 'erreur', texte: 'Erreur de synchro' };
  return { cle: 'ok', texte: 'Connecté' };
}

/** « 12 oct., 14:30 » à partir d'une date ISO, ou '' si absente ou invalide. */
export function texteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Ligne de détail de la carte Strava. */
export function detailStrava(conn, nbActivites = 0) {
  if (!conn) return 'Importe automatiquement tes activités, puissances et courbes.';
  const morceaux = [];
  if (conn.athlete_name) morceaux.push(String(conn.athlete_name));
  morceaux.push(pluriel(nbActivites, 'activité'));
  const date = texteDate(conn.last_sync_at);
  if (date) morceaux.push(`synchro ${date}`);
  return morceaux.join(' · ');
}

/** Ligne de détail de la carte Garmin. */
export function detailGarmin(conn, nbNuits = 0) {
  if (!conn) return 'Importe ton sommeil (phases, score, HRV, SpO2, stress).';
  const morceaux = [pluriel(nbNuits, 'nuit') + ' de sommeil'];
  const date = texteDate(conn.last_sync_at);
  if (date) morceaux.push(`synchro ${date}`);
  return morceaux.join(' · ');
}

/** Adresse d'autorisation Strava. `state` : jeton à usage unique fourni par le serveur (oauth-start), jamais un JWT. */
export function urlAutorisationStrava({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'force', // redemande l'écran d'autorisation à chaque connexion
    scope: SCOPES_STRAVA,
    state,
  });
  return `${URL_AUTORISATION_STRAVA}?${params.toString()}`;
}

/**
 * Lit le retour de Strava dans l'adresse (?strava_connected=1 ou ?strava_error=...).
 * Renvoie { connecte, erreur } ; l'erreur est nettoyée (lettres, chiffres, _ et - seulement, 60 caractères max)
 * parce qu'elle vient de l'adresse, donc d'une source qu'on ne maîtrise pas.
 */
export function lireRetourOAuth(recherche) {
  const p = new URLSearchParams(recherche || '');
  const brut = p.get('strava_error');
  const erreur = brut ? brut.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'erreur' : '';
  return { connecte: p.get('strava_connected') === '1', erreur };
}

/** Message lisible pour un code d'erreur de connexion Strava. */
export function messageErreurOAuth(code) {
  if (!code) return '';
  if (code === 'access_denied') return "Tu as refusé l'accès à Strava. Réessaie en acceptant les autorisations.";
  if (code === 'invalid_state') return 'La demande de connexion a expiré. Relance la connexion.';
  return `La connexion à Strava a échoué (${code}).`;
}

/**
 * Progression de l'import Strava. Phase 1 (activités) = 0 à 28 %, phase 2 (courbes) = 28 à 100 %.
 * total : nombre d'activités ; restantes : activités dont les courbes ne sont pas encore traitées.
 */
export function progressionStreams(total, restantes, base = 28) {
  const t = Math.max(0, Number(total) || 0);
  const r = Math.min(t, Math.max(0, Number(restantes) || 0));
  if (!t) return { traitees: 0, pct: base };
  const traitees = t - r;
  return { traitees, pct: Math.min(99, base + Math.round((traitees / t) * (100 - base))) };
}

/** Texte et état d'une demande de synchro Garmin (table garmin_sync_requests). */
export function etatSyncGarmin(ligne) {
  const s = ligne?.status;
  if (s === 'done') return { fini: true, erreur: false, texte: `Sommeil synchronisé : ${pluriel(Number(ligne.nights) || 0, 'nuit')}.` };
  if (s === 'error') return { fini: true, erreur: true, texte: `Synchro échouée : ${String(ligne.error || 'erreur inconnue').slice(0, 120)}` };
  if (s === 'running') return { fini: false, erreur: false, texte: 'Synchro Garmin en cours…' };
  return { fini: false, erreur: false, texte: 'Demande envoyée, en attente du Raspberry Pi…' };
}
