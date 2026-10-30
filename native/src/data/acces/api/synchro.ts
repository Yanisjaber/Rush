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

const entierPositif = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

const messageLot = (statut: number, code: unknown): string => {
  if (code === 'no_strava_connection') return 'Strava n\'est pas connecté à ce compte.';
  if (statut === 401) return 'Reconnecte-toi pour continuer la synchro.';
  if (statut === 0) return 'Pas de connexion : la synchro reprendra dès que le réseau revient.';
  return 'Le calcul s\'est interrompu. Rien n\'est perdu : il reprend là où il s\'est arrêté.';
};

/** Importe le flux et calcule les courbes d'un lot de sorties (les plus récentes d'abord). */
export async function traiterLotSynchro(limite: number): Promise<Resultat<LotSynchro>> {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: messageLot(401, null) };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-streams`, {
      method: 'POST',
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
  }
}
