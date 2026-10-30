import { SUPABASE_URL } from '@/config';
import { quotaValide, type QuotaStrava } from '../../synchro/estimation';
import { sb } from '../supabase';
import { UUID, type Resultat } from './commun';

// La synchro des courbes de puissance : combien de sorties avec capteur ont leur courbe, et le calcul d'un lot de sorties par la fonction « strava-streams »
// (elle seule parle à Strava : aucun jeton ne passe par l'app). Voir docs/native/SYNCHRO_STRAVA.md.

export interface CompteurSynchro {
  /** Les sorties avec un vrai capteur de puissance : les seules qui auront une courbe de watts. */
  total: number;
  /** Celles dont la courbe est déjà calculée. */
  faites: number;
}

export async function chargerCompteurSynchro(userId: string): Promise<Resultat<CompteurSynchro>> {
  if (!UUID.test(String(userId))) return { data: null, erreur: 'Compte introuvable.' };
  const base = () => sb.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('device_watts', true).is('merged_into', null);
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
  /** Sorties avec capteur qui attendent encore leur courbe, après ce lot. */
  restantes: number;
  /** Strava a refusé une demande (limite atteinte) : il faut attendre. */
  limiteAtteinte: boolean;
  /** Les limites et l'usage lus chez Strava, ou null si aucune demande n'est partie. */
  quota: QuotaStrava | null;
}

const entierPositif = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

const messageLot = (statut: number, code: unknown): string => {
  if (code === 'no_strava_connection') return 'Strava n\'est pas connecté à ce compte.';
  if (statut === 401) return 'Reconnecte-toi pour continuer la synchro.';
  if (statut === 0) return 'Pas de connexion : la synchro reprendra dès que le réseau revient.';
  return 'Le calcul s\'est interrompu. Rien n\'est perdu : il reprend là où il s\'est arrêté.';
};

/** Calcule la courbe d'un lot de sorties (les plus récentes d'abord, seulement celles avec capteur de puissance). */
export async function traiterLotSynchro(limite: number): Promise<Resultat<LotSynchro>> {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: messageLot(401, null) };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-streams`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: Math.max(1, Math.min(40, Math.floor(limite))), puissance_seulement: true }),
    });
    const corps = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { data: null, erreur: messageLot(res.status, corps?.error) };
    const restantes = entierPositif(corps?.remaining);
    if (restantes === null) return { data: null, erreur: messageLot(500, null) };
    return { data: { restantes, limiteAtteinte: corps?.rate_limited === true, quota: quotaValide(corps?.quota) }, erreur: '' };
  } catch {
    return { data: null, erreur: messageLot(0, null) };
  }
}
