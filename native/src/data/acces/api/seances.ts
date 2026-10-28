import { SUPABASE_URL } from '@/config';
import { avertissementLimite } from '../../calendrier/calendrier';
import { dateIsoLocale } from '../../outils/format';
import { messageTours, toursValides } from '../../calendrier/seance-detail';
import { sb } from '../supabase';
import type { Seance, Tour } from '../../types';
import { COLONNES_SEANCE, resultat, UUID, type Resultat } from './commun';
import { avecRetouches } from './retouches-cache';

/**
 * La marche quotidienne (`Walk`) ne compte pas dans la charge, le volume ni les listes de l'accueil : elle les polluerait sans rien dire de la forme.
 * Elle reste visible dans le calendrier et le bilan (l'historique complet). La randonnée (`Hike`) compte, elle.
 */
function sansMarche(seances: Seance[]): Seance[] {
  return seances.filter((s) => s.sport !== 'Walk');
}

/** Séances réalisées depuis N jours (les plus récentes d'abord). */
export async function chargerSeances(userId: string, jours = 84, limite = 600): Promise<Resultat<Seance[]>> {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .gte('start_date_local', dateIsoLocale(depuis))
    .order('start_date_local', { ascending: false })
    .limit(limite);
  const res = resultat<Seance[]>(r, 'Impossible de charger tes séances.');
  if (res.data) res.data = sansMarche(await avecRetouches(userId, res.data));
  return res;
}

/** Deux ans de séances (avec cardio et puissance) pour comparer une période à celle d'avant : voir data/progression.ts. Les plus récentes d'abord. */
export async function chargerHistoriqueProgression(userId: string, jours = 730, limite = 3000): Promise<Resultat<Seance[]>> {
  return chargerSeances(userId, jours, limite);
}

/**
 * Les N séances les plus récentes, QUELLE QUE SOIT leur date (pour la liste « Dernières séances » : elle ne doit pas
 * se vider parce qu'on n'a rien fait depuis 12 semaines). On en charge beaucoup plus que ce qu'on affiche : le filtre de sport
 * se fait ensuite côté écran, et il faut remonter assez loin pour trouver des séances d'un sport pratiqué moins souvent.
 */
export async function chargerDernieresSeances(userId: string, limite = 200): Promise<Resultat<Seance[]>> {
  const r = await sb.from('activities').select(COLONNES_SEANCE).eq('user_id', userId).order('start_date_local', { ascending: false }).limit(limite);
  const res = resultat<Seance[]>(r, 'Impossible de charger tes dernières séances.');
  if (res.data) res.data = sansMarche(await avecRetouches(userId, res.data));
  return res;
}

// L'écran de détail d'une séance : les colonnes utiles (jamais les gros champs : flux, GPX…).
const COLONNES_DETAIL =
  'id,strava_id,source,name,sport,start_date_local,elapsed_time,moving_time,distance_km,total_elevation_gain,avg_speed_kmh,' +
  'avg_heartrate,max_heartrate,avg_watts,max_watts,np,ftp_at_time,avg_cadence,kj,calories,tss,user_notes,rpe,category';

/** Une séance de l'utilisateur, avec ses retouches. Un identifiant qui n'est pas un UUID n'existe pas (pas de requête). */
export async function chargerSeance(userId: string, id: string): Promise<Resultat<Seance | null>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const r = await sb.from('activities').select(COLONNES_DETAIL).eq('user_id', userId).eq('id', id).maybeSingle();
  const res = resultat<Seance | null>(r, 'Impossible de charger cette séance.');
  if (res.data) res.data = (await avecRetouches(userId, [res.data]))[0];
  if (!res.erreur && !res.data) return { data: null, erreur: 'Séance introuvable.' };
  return res;
}

/**
 * Les tours (laps) d'une séance Strava, par la fonction « strava-laps » (elle seule parle à Strava : aucun jeton ne passe par l'app).
 * La réponse est nettoyée avant usage.
 */
export async function chargerTours(id: string): Promise<Resultat<Tour[]>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: 'Reconnecte-toi pour voir les tours.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-laps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: id }),
    });
    const corps = (await res.json().catch(() => null)) as { error?: unknown; laps?: unknown } | null;
    if (!res.ok) return { data: null, erreur: messageTours(res.status, corps?.error) };
    return { data: toursValides(corps?.laps), erreur: '' };
  } catch {
    return { data: null, erreur: messageTours(0, null) };
  }
}

const LIMITE_SEANCES = 1000; // le maximum que l'API renvoie en une requête

/** Séances réalisées entre deux dates ISO incluses (le calendrier d'un mois). */
export async function chargerSeancesPeriode(userId: string, debutIso: string, finIso: string): Promise<Resultat<Seance[]>> {
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .gte('start_date_local', debutIso)
    .lt('start_date_local', `${finIso}T23:59:59`)
    .order('start_date_local', { ascending: true })
    .limit(LIMITE_SEANCES);
  const res = resultat<Seance[]>(r, 'Impossible de charger les séances de ce mois.');
  if (res.data) res.data = await avecRetouches(userId, res.data);
  // Limite atteinte : les données sont gardées, mais on le dit (sinon la fin du mois manquerait sans qu'on le sache)
  if (res.data) res.erreur = avertissementLimite(res.data.length, LIMITE_SEANCES, 'séances');
  return res;
}
