import { SUPABASE_URL } from '@/config';
import { sb } from '../supabase';
import { supprimerCompteAvec, type AppelFonction, type Progres, type ResultatSuppression } from '../suppression-compte';
import type { Resultat } from './commun';

/** Appelle une fonction serveur « delete-account » avec le jeton de la session (jamais de clé secrète dans l'app). */
export async function supprimerMonCompte(confirmation: string, onProgres?: Progres): Promise<ResultatSuppression> {
  const appeler: AppelFonction = async (corps) => {
    const { data: s } = await sb.auth.getSession();
    const jeton = s.session?.access_token;
    if (!jeton) return { ok: false, statut: 401, data: null };
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      return { ok: res.ok, statut: res.status, data: (await res.json().catch(() => null)) as Record<string, unknown> | null };
    } catch {
      return { ok: false, statut: 0, data: null };
    }
  };
  return supprimerCompteAvec(appeler, confirmation, onProgres);
}

// ---------------------------------------------------------------------------
// Connexions (statut seulement : les jetons restent dans le Vault, lus par les Edge Functions)
// ---------------------------------------------------------------------------

export interface ConnexionStrava {
  external_id: string | null;
  athlete_name: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  first_connected_at: string | null;
}

/** Statut Strava + compteurs (activités, nuits de sommeil déjà importées). */
export async function chargerConnexions(userId: string): Promise<Resultat<{ strava: ConnexionStrava | null; nbActivites: number; nbNuits: number }>> {
  const [strava, activites, nuits] = await Promise.all([
    sb.from('connexions_app').select('external_id,athlete_name,last_sync_at,last_sync_status,first_connected_at').eq('user_id', userId).eq('app', 'strava').maybeSingle(),
    sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('garmin_sleep').select('date', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (strava.error) {
    console.error('[app/api] connexions', strava.error.code || '');
    return { data: null, erreur: 'Impossible de charger tes connexions.' };
  }
  return { data: { strava: strava.data as ConnexionStrava | null, nbActivites: activites.count || 0, nbNuits: nuits.count || 0 }, erreur: '' };
}

/** Le compte a-t-il au moins une connexion (Strava ou autre) ? `null` si on n'a pas pu le savoir (on ne suppose alors rien). */
export async function aUneConnexion(userId: string): Promise<boolean | null> {
  const r = await sb.from('connexions_app').select('app').eq('user_id', userId).limit(1);
  if (r.error) {
    console.error('[app/api] connexion', r.error.code || '');
    return null;
  }
  return (r.data ?? []).length > 0;
}
