import { SUPABASE_URL } from '@/config';
import { sb } from '../supabase';
import { UUID, type Resultat } from './commun';

// La synchro des flux : combien de sorties ont leur flux seconde par seconde (watts, cardio, vitesse, altitude…) et leurs courbes, et le calcul d'un lot de sorties par la
// fonction « strava-streams » (elle seule parle à Strava : aucun jeton ne passe par l'app). Toutes les sorties comptent, avec ou sans capteur de puissance
// (décision de Yanis : on importe tout, même la vitesse). Voir docs/native/SYNCHRO_STRAVA.md.

export interface CompteurSynchro {
  /** Toutes les sorties du compte. */
  total: number;
  /** Celles dont le flux est déjà importé. */
  faites: number;
}

export async function chargerCompteurSynchro(userId: string): Promise<Resultat<CompteurSynchro>> {
  if (!UUID.test(String(userId))) return { data: null, erreur: 'Compte introuvable.' };
  const base = () => sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const [total, sansCourbe] = await Promise.all([base(), base().is('streams_synced_at', null)]);
  const erreur = total.error ?? sansCourbe.error;
  if (erreur) {
    console.error('[app/api] compteur de synchro', erreur.code || '');
    return { data: null, erreur: 'Impossible de lire l\'avancement de la synchro.' };
  }
  const t = total.count ?? 0;
  return { data: { total: t, faites: Math.max(0, t - (sansCourbe.count ?? 0)) }, erreur: '' };
}

export interface LotSynchro {
  /** Sorties dont le flux n'est pas encore importé, après ce lot. */
  restantes: number;
  /** Strava a refusé une demande (limite atteinte) : il faut attendre. */
  limiteAtteinte: boolean;
}

/** Sorties que le serveur télécharge à la fois pendant un lot : le calcul reste sur un seul fil, mais les attentes de Strava et de la base se recouvrent. */
const PARALLELE = 4;

/** Le délai maximum d'un lot : la fonction serveur s'arrête d'elle-même vers 150 s, 100 s laissent largement le temps à 20 sorties. */
const DELAI_LOT_MS = 100_000;

const entierPositif = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

const messageLot = (statut: number, code: unknown): string => {
  if (code === 'no_strava_connection') return 'Strava n\'est pas connecté à ce compte.';
  if (statut === 401) return 'Reconnecte-toi pour continuer la synchro.';
  if (statut === 0) return 'Pas de connexion : la synchro reprendra dès que le réseau revient.';
  return 'Le calcul s\'est interrompu. Rien n\'est perdu : il reprend là où il s\'est arrêté.';
};

/** Appelle strava-streams avec la session de l'utilisateur et rend le corps de la réponse (null si la réponse n'est pas lisible). */
async function appelerStreams(corps: Record<string, unknown>): Promise<Resultat<Record<string, unknown>>> {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: messageLot(401, null) };
  const coupure = new AbortController();
  const minuteur = setTimeout(() => coupure.abort(), DELAI_LOT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-streams`, {
      method: 'POST',
      signal: coupure.signal,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const reponse = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !reponse) return { data: null, erreur: messageLot(res.ok ? 500 : res.status, reponse?.error) };
    return { data: reponse, erreur: '' };
  } catch {
    return { data: null, erreur: messageLot(0, null) };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Combien de sorties ont une courbe obsolète (calculée avec une ancienne formule) : la fonction compte seulement, sans rien calculer ni appeler Strava. */
export async function compterCourbesObsoletes(): Promise<Resultat<number>> {
  const r = await appelerStreams({ compter_courbes: true });
  if (!r.data) return { data: null, erreur: r.erreur };
  const n = entierPositif(r.data.power_curve_remaining);
  return n === null ? { data: null, erreur: messageLot(500, null) } : { data: n, erreur: '' };
}

/** Recalcule les courbes obsolètes d'un lot de sorties depuis leurs flux déjà stockés (aucun appel à Strava). Rend combien il en reste. */
export async function recalculerLotCourbes(): Promise<Resultat<number>> {
  const r = await appelerStreams({ courbes_seulement: true, limit: 1 });
  if (!r.data) return { data: null, erreur: r.erreur };
  const n = entierPositif(r.data.power_curve_remaining);
  return n === null ? { data: null, erreur: messageLot(500, null) } : { data: n, erreur: '' };
}

/** Importe le flux et calcule les courbes d'un lot de sorties (les plus récentes d'abord). */
export async function traiterLotSynchro(limite: number): Promise<Resultat<LotSynchro>> {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: messageLot(401, null) };
  // Un délai maximum : un appel qui ne revient jamais gèlerait l'écran. Passé ce délai, on le compte comme une erreur (le calcul est retenté).
  const coupure = new AbortController();
  const minuteur = setTimeout(() => coupure.abort(), DELAI_LOT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-streams`, {
      method: 'POST',
      signal: coupure.signal,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      // profil_a_la_fin : le profil de puissance ne se recalcule qu'au dernier lot ; parallele : quatre sorties téléchargées à la fois (voir strava-streams)
      body: JSON.stringify({ limit: Math.max(1, Math.min(40, Math.floor(limite))), profil_a_la_fin: true, parallele: PARALLELE }),
    });
    const corps = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { data: null, erreur: messageLot(res.status, corps?.error) };
    const restantes = entierPositif(corps?.remaining);
    if (restantes === null) return { data: null, erreur: messageLot(500, null) };
    return { data: { restantes, limiteAtteinte: corps?.rate_limited === true }, erreur: '' };
  } catch {
    return { data: null, erreur: messageLot(0, null) };
  } finally {
    clearTimeout(minuteur);
  }
}
