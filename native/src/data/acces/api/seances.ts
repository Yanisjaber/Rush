import { SUPABASE_URL } from '@/config';
import { avertissementLimite } from '../../calendrier/calendrier';
import { dateIsoLocale } from '../../outils/format';
import { messageTours, toursValides } from '../../calendrier/seance-detail';
import { sb } from '../supabase';
import type { Seance, Tour } from '../../types';
import { COLONNES_SEANCE, resultat, UUID, type Resultat } from './commun';
import { COLONNES_ECART, sansDonneesEcarteesTout, type ColonneEcart } from '../../calendrier/donnees-ecartees';
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
  if (res.data) res.data = sansDonneesEcarteesTout(sansMarche(await avecRetouches(userId, res.data)));
  return res;
}

const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages
const PAGES_MAX = 20; // garde-fou : 20 000 séances

/**
 * Tout l'historique des séances (avec cardio et puissance) : le niveau année après année remonte à la première séance, et la comparaison de deux périodes à deux ans.
 * Lu par pages de 1000. Les plus récentes d'abord. Voir data/bilan/niveau-annees.ts et progression.ts.
 */
export async function chargerHistoriqueProgression(userId: string): Promise<Resultat<Seance[]>> {
  const toutes: Seance[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const r = await sb
      .from('activities')
      .select(COLONNES_SEANCE)
      .eq('user_id', userId)
      .order('start_date_local', { ascending: false })
      .order('id', { ascending: true }) // un ordre complet : sans lui, deux séances à la même minute pourraient changer de page
      .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
    const res = resultat<Seance[]>(r, 'Impossible de charger ton historique.');
    if (res.erreur || !res.data) return { data: null, erreur: res.erreur || 'Impossible de charger ton historique.' };
    toutes.push(...res.data);
    if (res.data.length < TAILLE_PAGE) return { data: sansDonneesEcarteesTout(sansMarche(await avecRetouches(userId, toutes))), erreur: '' };
  }
  return { data: null, erreur: 'Ton historique est trop long pour être chargé en entier.' };
}

/**
 * Les N séances les plus récentes, QUELLE QUE SOIT leur date (pour la liste « Dernières séances » : elle ne doit pas
 * se vider parce qu'on n'a rien fait depuis 12 semaines). On en charge beaucoup plus que ce qu'on affiche : le filtre de sport
 * se fait ensuite côté écran, et il faut remonter assez loin pour trouver des séances d'un sport pratiqué moins souvent.
 */
export async function chargerDernieresSeances(userId: string, limite = 200): Promise<Resultat<Seance[]>> {
  const r = await sb.from('activities').select(COLONNES_SEANCE).eq('user_id', userId).order('start_date_local', { ascending: false }).limit(limite);
  const res = resultat<Seance[]>(r, 'Impossible de charger tes dernières séances.');
  if (res.data) res.data = sansDonneesEcarteesTout(sansMarche(await avecRetouches(userId, res.data)));
  return res;
}

// L'écran de détail d'une séance : les colonnes utiles (jamais les gros champs : flux, GPX…).
const COLONNES_DETAIL =
  'id,strava_id,source,name,sport,start_date_local,elapsed_time,moving_time,distance_km,total_elevation_gain,avg_speed_kmh,' +
  'avg_heartrate,max_heartrate,avg_watts,max_watts,np,ftp_at_time,avg_cadence,kj,calories,tss,user_notes,rpe,category,device_watts,' +
  'excl_power,excl_hr,excl_cadence,excl_distance,excl_elevation,excl_load';

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
  if (res.data) res.data = sansDonneesEcarteesTout(await avecRetouches(userId, res.data));
  // Limite atteinte : les données sont gardées, mais on le dit (sinon la fin du mois manquerait sans qu'on le sache)
  if (res.data) res.erreur = avertissementLimite(res.data.length, LIMITE_SEANCES, 'séances');
  return res;
}

/**
 * Écarte (ou remet) une donnée d'une séance, Strava ou saisie à la main : seul le drapeau `excl_*` change, les chiffres restent en base
 * (la synchro Strava ne touche pas à ces colonnes). Dit « introuvable » si aucune ligne n'a été modifiée. Le déclencheur SQL recalcule la charge.
 */
export async function changerDonneeEcartee(userId: string, id: string, colonne: ColonneEcart, ecartee: boolean): Promise<{ erreur: string }> {
  if (!UUID.test(String(id)) || !COLONNES_ECART.includes(colonne)) return { erreur: 'Séance introuvable.' };
  const r = await sb.from('activities').update({ [colonne]: ecartee }).eq('user_id', userId).eq('id', id).select('id');
  const res = resultat<{ id: string }[]>(r, 'Impossible de changer cette donnée.');
  if (res.erreur) return { erreur: res.erreur };
  return { erreur: res.data && res.data.length ? '' : 'Séance introuvable.' };
}
