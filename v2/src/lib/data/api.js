// Accès aux données Supabase. La RLS garantit que chaque utilisateur ne lit que ses propres lignes ;
// on filtre quand même explicitement par user_id (défense en profondeur, et requêtes plus lisibles).
//
// RÈGLES :
//  - JAMAIS de select('*') sur `activities` : la table contient de très grosses colonnes
//    (streams_gz, streams_blob, gpx_blob, gpx_content, power_curve…). On liste les colonnes utiles.
//  - Toutes les fonctions renvoient { data, erreur } ; `erreur` est un message court en français,
//    jamais le texte brut de l'erreur de la base.
import { sb } from '../supabase.js';
import { dateIsoLocale } from '../utils/format.js';
import { decoderStreams } from './streams.js';

const COLONNES_SEANCE =
  'id,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,avg_heartrate,avg_watts,np,tss,category';
const COLONNES_METRIQUES = 'iso_date,tss,ctl,atl,tsb,duration_min,activity_count';
const COLONNES_OBJECTIF = 'id,name,date,sport,km,d_plus,priority,duration,category';
const COLONNES_PROFIL = 'display_name,ftp,hr_max,lthr,weight';

function resultat(reponse, message) {
  if (reponse.error) {
    console.error('[v2/api]', message, reponse.error.code || '');
    return { data: null, erreur: message };
  }
  return { data: reponse.data, erreur: '' };
}

export async function chargerProfil(userId) {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL).eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton profil.');
}

/** Métriques de charge quotidiennes (CTL, ATL, TSB) sur les N derniers jours. */
export async function chargerMetriques(userId, jours = 90) {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const r = await sb
    .from('daily_metrics')
    .select(COLONNES_METRIQUES)
    .eq('user_id', userId)
    .gte('iso_date', dateIsoLocale(depuis))
    .order('iso_date', { ascending: true })
    .limit(400);
  return resultat(r, 'Impossible de charger ta forme.');
}

/** Séances réalisées depuis N jours (les plus récentes d'abord). */
export async function chargerSeances(userId, jours = 84, limite = 600) {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .gte('start_date_local', dateIsoLocale(depuis))
    .order('start_date_local', { ascending: false })
    .limit(limite);
  return resultat(r, 'Impossible de charger tes séances.');
}

/** Prochaines compétitions (objectifs), de la plus proche à la plus lointaine. */
export async function chargerObjectifs(userId, limite = 3) {
  const r = await sb
    .from('activity_planned')
    .select(COLONNES_OBJECTIF)
    .eq('user_id', userId)
    .eq('category', 'competition')
    .gte('date', dateIsoLocale())
    .order('date', { ascending: true })
    .limit(limite);
  return resultat(r, 'Impossible de charger tes objectifs.');
}

/**
 * Courbe de puissance (vélo) : meilleures puissances par durée, sur 90 jours et sur toute la vie.
 * On ne garde que des durées standard (5 s, 15 s, 30 s, 1, 5, 10, 20, 60 min).
 */
const DUREES_PUISSANCE = [5, 15, 30, 60, 300, 600, 1200, 3600];
export async function chargerPuissance(userId) {
  const r = await sb
    .from('power_profile')
    .select('duration_s,watts_90d,watts_alltime')
    .eq('user_id', userId)
    .in('duration_s', DUREES_PUISSANCE)
    .order('duration_s', { ascending: true });
  return resultat(r, 'Impossible de charger ta courbe de puissance.');
}

// ---------------------------------------------------------------------------
// Calendrier : séances réalisées et prévues sur une période
// ---------------------------------------------------------------------------

const COLONNES_PLANIFIEE = 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes';

/** Séances réalisées entre deux dates ISO incluses (le calendrier d'un mois). */
export async function chargerSeancesPeriode(userId, debutIso, finIso) {
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .gte('start_date_local', debutIso)
    .lt('start_date_local', `${finIso}T23:59:59`)
    .order('start_date_local', { ascending: true })
    .limit(500);
  return resultat(r, 'Impossible de charger les séances de ce mois.');
}

/** Séances et compétitions prévues entre deux dates ISO incluses. */
export async function chargerPlanifiees(userId, debutIso, finIso) {
  const r = await sb
    .from('activity_planned')
    .select(COLONNES_PLANIFIEE)
    .eq('user_id', userId)
    .gte('date', debutIso)
    .lte('date', finIso)
    .order('date', { ascending: true })
    .limit(300);
  return resultat(r, 'Impossible de charger les séances prévues.');
}

// ---------------------------------------------------------------------------
// Détail d'une séance
// ---------------------------------------------------------------------------

const COLONNES_DETAIL =
  'id,name,sport,start_date_local,elapsed_time,moving_time,distance_km,total_elevation_gain,avg_speed_kmh,max_speed_kmh,' +
  'avg_heartrate,max_heartrate,avg_watts,max_watts,np,intensity,ftp_at_time,avg_cadence,kj,calories,tss,variability_index,' +
  'has_heartrate,has_power,user_notes,category';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Une séance du joueur (jamais les gros champs : streams, GPX…). Un identifiant qui n'est pas un UUID n'existe pas. */
export async function chargerSeance(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const r = await sb.from('activities').select(COLONNES_DETAIL).eq('user_id', userId).eq('id', id).maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Séance introuvable.' };
  return resultat(r, 'Impossible de charger cette séance.');
}

/** Streams d'une séance (courbes), chargés à part car volumineux (jusqu'à plusieurs centaines de Ko). */
export async function chargerStreams(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: '' };
  const r = await sb.from('activities').select('streams_gz,streams_format').eq('user_id', userId).eq('id', id).maybeSingle();
  if (r.error) {
    console.error('[v2/api] streams', r.error.code || '');
    return { data: null, erreur: 'Impossible de charger les courbes de cette séance.' };
  }
  if (!r.data || !r.data.streams_gz || r.data.streams_format === 'none') return { data: null, erreur: '' };
  try {
    return { data: await decoderStreams(r.data.streams_gz), erreur: '' };
  } catch (e) {
    console.error('[v2/api] décodage des streams');
    return { data: null, erreur: 'Les courbes de cette séance sont illisibles.' };
  }
}

// Colonnes légères de garmin_sleep : on évite `segments` et `hr_stream` (gros JSON, inutiles pour la vue d'ensemble)
const COLONNES_SOMMEIL =
  'date,bedtime,wake_time,total_sec,deep_sec,light_sec,rem_sec,awake_sec,awake_count,avg_stress,avg_heart_rate,resting_heart_rate,body_battery_change,hrv_avg,hrv_status,spo2_avg,score,score_qualifier';

/** Nuits Garmin des N derniers jours (la plus récente d'abord). */
export async function chargerSommeil(userId, jours = 60) {
  const r = await sb
    .from('garmin_sleep')
    .select(COLONNES_SOMMEIL)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(jours);
  return resultat(r, 'Impossible de charger ton sommeil.');
}

// ---------------------------------------------------------------------------
// Écriture des séances prévues. user_id vient toujours de la session (jamais d'un formulaire) ;
// la RLS refuse de toute façon une ligne qui n'est pas la tienne.
// ---------------------------------------------------------------------------

/** Crée une séance prévue (ligne produite par versLigne). Renvoie la ligne créée. */
export async function creerPlanifiee(userId, ligne) {
  const r = await sb
    .from('activity_planned')
    .insert({ ...ligne, user_id: userId, client_id: `v2-${crypto.randomUUID()}` })
    .select(COLONNES_PLANIFIEE)
    .single();
  return resultat(r, "Impossible d'enregistrer la séance.");
}

/** Modifie une séance prévue qui t'appartient. */
export async function modifierPlanifiee(userId, id, ligne) {
  const r = await sb
    .from('activity_planned')
    .update(ligne)
    .eq('id', id)
    .eq('user_id', userId)
    .select(COLONNES_PLANIFIEE)
    .single();
  return resultat(r, 'Impossible de modifier la séance.');
}

/** Supprime définitivement une séance prévue qui t'appartient. */
export async function supprimerPlanifiee(userId, id) {
  const r = await sb.from('activity_planned').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer la séance.');
}
