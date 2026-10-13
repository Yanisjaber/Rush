// Connexions Strava : appels réseau (Edge Functions Supabase et tables). Aucun jeton ne passe ici :
// les jetons Strava restent côté serveur, masqués au navigateur par la base.
// Chaque fonction renvoie { data, erreur } (message court en français) ou un objet de résultat décrit ci-dessous.
import { sb } from '../supabase.js';
import { SUPABASE_URL, STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI } from '../config.js';
import { urlAutorisationStrava } from './connexions.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Appelle une Edge Function avec le jeton de la session. Renvoie { ok, statut, data, abandon }. */
export async function appeler(fonction, corps, signal) {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { ok: false, statut: 401, data: null, abandon: false };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fonction}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps || {}),
      signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, statut: res.status, data, abandon: false };
  } catch (e) {
    return { ok: false, statut: 0, data: null, abandon: e?.name === 'AbortError' };
  }
}

// ---------------------------------------------------------------------------
// Statut des connexions (colonnes « sûres » : jamais les jetons)
// ---------------------------------------------------------------------------

/** Statut Strava + compteurs (activités, nuits de sommeil déjà importées). */
export async function chargerConnexions(userId) {
  const base = sb.from('connexions_app');
  const [strava, activites, nuits] = await Promise.all([
    base.select('external_id,athlete_name,last_sync_at,last_sync_status,first_connected_at').eq('user_id', userId).eq('app', 'strava').maybeSingle(),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('garmin_sleep').select('date', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (strava.error) {
    console.error('[app/connexions]', strava.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes connexions.' };
  }
  return { data: { strava: strava.data, nbActivites: activites.count || 0, nbNuits: nuits.count || 0 }, erreur: '' };
}

// ---------------------------------------------------------------------------
// Strava : connexion, import, déconnexion
// ---------------------------------------------------------------------------

/**
 * Prépare la connexion Strava : demande un jeton à usage unique au serveur, puis renvoie l'adresse d'autorisation.
 * Le serveur n'accepte que des adresses de retour d'une liste blanche (oauth-start) : sinon `refusee` vaut true.
 */
export async function preparerConnexionStrava() {
  const returnUrl = `${location.origin}${location.pathname}`;
  const { data, error } = await sb.functions.invoke('oauth-start', { body: { provider: 'strava', returnUrl } });
  if (error || !data?.state) {
    console.error('[app/strava] oauth-start', error?.message || '');
    return { url: '', refusee: true, erreur: "Impossible de démarrer la connexion Strava : cette adresse n'est pas encore autorisée côté serveur, ou le serveur est indisponible." };
  }
  return { url: urlAutorisationStrava({ clientId: STRAVA_CLIENT_ID, redirectUri: STRAVA_REDIRECT_URI, state: data.state }), refusee: false, erreur: '' };
}

/** Importe les activités Strava (un seul appel serveur, ~30 s). Renvoie { importees, recues, erreur, aucuneConnexion }. */
export async function importerActivitesStrava(signal) {
  const r = await appeler('strava-ingest', {}, signal);
  if (r.abandon) return { importees: 0, recues: 0, erreur: '', aucuneConnexion: false, abandon: true };
  if (!r.ok) {
    if (r.data?.error === 'no_strava_connection') return { importees: 0, recues: 0, erreur: '', aucuneConnexion: true };
    return { importees: 0, recues: 0, erreur: "L'import des activités a échoué. Réessaie dans un instant.", aucuneConnexion: false };
  }
  if (r.data.activities_inserted === 0 && r.data.activities_errored > 0) {
    return { importees: 0, recues: r.data.activities_received || 0, erreur: "Aucune activité n'a pu être enregistrée.", aucuneConnexion: false };
  }
  return { importees: r.data.activities_inserted || 0, recues: r.data.activities_received || 0, erreur: '', aucuneConnexion: false };
}

/**
 * Traite les courbes (streams) et le profil de puissance par lots de 40 activités, jusqu'à la fin.
 * onProgres(traitees, total) est appelé à chaque lot. Renvoie { fini, limite, erreur }.
 *  - limite : Strava a limité le débit (on reprendra plus tard ; le serveur sait reprendre là où il s'est arrêté)
 */
export async function traiterStreamsStrava(userId, onProgres, signal) {
  const [{ count: total }, { count: sansCourbes }] = await Promise.all([
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('streams_synced_at', null),
  ]);
  const nb = total || 0;
  onProgres?.(Math.max(0, nb - (sansCourbes || 0)), nb);

  let echecs = 0;
  for (let passe = 0; passe < 300; passe++) {
    if (signal?.aborted) return { fini: false, limite: false, erreur: '' };
    // Un lot, avec jusqu'à 4 essais en cas d'erreur passagère (délai croissant)
    let data = null;
    for (let essai = 1; essai <= 4 && !data; essai++) {
      const r = await appeler('strava-streams', { limit: 40 }, signal);
      if (r.abandon) return { fini: false, limite: false, erreur: '' };
      if (r.ok) data = r.data;
      else await pause(1200 * essai);
    }
    if (!data) {
      echecs++;
      if (echecs >= 5) return { fini: false, limite: false, erreur: 'Interruption du traitement. Relance la synchro pour reprendre là où elle s’est arrêtée.' };
      continue;
    }
    echecs = 0;
    const restantes = data.remaining || 0;
    onProgres?.(Math.max(0, nb - restantes), nb);
    if (data.rate_limited) return { fini: false, limite: true, erreur: '' };
    if (!restantes && !data.power_curve_remaining) return { fini: true, limite: false, erreur: '' };
  }
  return { fini: false, limite: false, erreur: '' };
}

/** Déconnecte Strava. wipe=true efface aussi les données importées (irréversible). */
export async function deconnecterStrava(wipe) {
  const r = await appeler('disconnect-integration', { provider: 'strava', wipe: wipe === true });
  if (!r.ok) return { ok: false, erreur: 'Impossible de déconnecter Strava. Réessaie dans un instant.' };
  return { ok: true, erreur: '' };
}

