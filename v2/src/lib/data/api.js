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

const COLONNES_PLANIFIEE = 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes,structure';

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
  'date,bedtime,wake_time,total_sec,deep_sec,light_sec,rem_sec,awake_sec,awake_count,restless_count,avg_stress,avg_heart_rate,resting_heart_rate,body_battery_change,hrv_avg,hrv_status,resp_avg,resp_min,resp_max,spo2_avg,score,score_qualifier,segments';

/** FC minute par minute d'UNE nuit ([minute, bpm]) : colonne lourde, chargée seulement quand on ouvre le détail. */
export async function chargerFcNuit(userId, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { data: null, erreur: 'Date invalide.' };
  const r = await sb.from('garmin_sleep').select('hr_stream').eq('user_id', userId).eq('date', date).maybeSingle();
  const res = resultat(r, 'Impossible de charger la FC de cette nuit.');
  return { data: Array.isArray(res.data?.hr_stream) ? res.data.hr_stream : null, erreur: res.erreur };
}

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
export async function creerPlanifiee(userId, ligne, colonnes = COLONNES_PLANIFIEE) {
  const r = await sb
    .from('activity_planned')
    .insert({ ...ligne, user_id: userId, client_id: `v2-${crypto.randomUUID()}` })
    .select(colonnes)
    .single();
  return resultat(r, "Impossible d'enregistrer la séance.");
}

/** Modifie une séance prévue qui t'appartient. */
export async function modifierPlanifiee(userId, id, ligne, colonnes = COLONNES_PLANIFIEE) {
  const r = await sb
    .from('activity_planned')
    .update(ligne)
    .eq('id', id)
    .eq('user_id', userId)
    .select(colonnes)
    .single();
  return resultat(r, 'Impossible de modifier la séance.');
}

/** Supprime définitivement une séance prévue qui t'appartient. */
export async function supprimerPlanifiee(userId, id) {
  const r = await sb.from('activity_planned').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer la séance.');
}

// ---------------------------------------------------------------------------
// Profil complet (page Profil) : colonnes + extras (JSON)
// ---------------------------------------------------------------------------

const COLONNES_PROFIL_COMPLET = 'display_name,weight,ftp,hr_max,lthr,extras';

/** Profil complet de l'utilisateur (colonnes et extras). `data` vaut null si aucune ligne n'existe encore. */
export async function chargerProfilComplet(userId) {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL_COMPLET).eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton profil.');
}

/**
 * Enregistre une section du profil. `colonnes` : colonnes à mettre à jour ; `extras` : objet COMPLET (les clés des autres
 * sections sont déjà conservées par versPayload). Met à jour la ligne de l'utilisateur, jamais celle d'un autre.
 */
export async function enregistrerProfil(userId, colonnes, extras) {
  const r = await sb
    .from('user_profiles')
    .update({ ...colonnes, extras, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select(COLONNES_PROFIL_COMPLET)
    .maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Profil introuvable : reconnecte-toi puis réessaie.' };
  return resultat(r, "Impossible d'enregistrer ton profil.");
}

// ---------------------------------------------------------------------------
// Compétitions : à venir (activity_planned) et passées (activités marquées « competition »)
// ---------------------------------------------------------------------------

export const COLONNES_COMPETITION = 'id,name,date,start_date_local,sport,priority,km,d_plus,type,duration,notes,category';

/** Compétitions prévues (toutes dates ; la page sépare passé et futur) et compétitions déjà courues. */
export async function chargerCompetitions(userId) {
  const [prevues, courues] = await Promise.all([
    sb.from('activity_planned').select(COLONNES_COMPETITION).eq('user_id', userId).eq('category', 'competition').order('date', { ascending: true }).limit(300),
    sb.from('activities').select(`${COLONNES_SEANCE},priority`).eq('user_id', userId).eq('category', 'competition').order('start_date_local', { ascending: false }).limit(200),
  ]);
  if (prevues.error || courues.error) {
    console.error('[v2/api] competitions', prevues.error?.code || courues.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes compétitions.' };
  }
  return { data: { prevues: prevues.data || [], courues: courues.data || [] }, erreur: '' };
}

/**
 * Marque une activité comme compétition (ou la repasse en entraînement). `category_set_by_user` empêche la synchro Strava
 * de la reclasser ensuite (même règle que la v1). N'écrit que sur une activité de l'utilisateur.
 */
export async function definirCategorieActivite(userId, id, categorie) {
  if (!['competition', 'entrainement'].includes(categorie)) return { data: null, erreur: 'Catégorie invalide.' };
  const r = await sb
    .from('activities')
    .update({ category: categorie, category_set_by_user: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id,category')
    .maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Activité introuvable.' };
  return resultat(r, 'Impossible de modifier cette sortie.');
}

// ---------------------------------------------------------------------------
// Bilan annuel : activités des 3 dernières années et objectifs annuels
// ---------------------------------------------------------------------------

const COLONNES_BILAN = 'id,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,tss';
const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages

/** Activités de l'année et des deux précédentes (colonnes légères), par pages de 1000. */
export async function chargerActivitesBilan(userId, annee) {
  const toutes = [];
  for (let page = 0; page < 12; page++) {
    const r = await sb
      .from('activities')
      .select(COLONNES_BILAN)
      .eq('user_id', userId)
      .gte('start_date_local', `${annee - 2}-01-01`)
      .lte('start_date_local', `${annee}-12-31T23:59:59`)
      .order('start_date_local', { ascending: true })
      .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
    if (r.error) {
      console.error('[v2/api] bilan', r.error.code || '');
      return { data: null, erreur: 'Impossible de charger tes activités.' };
    }
    toutes.push(...r.data);
    if (r.data.length < TAILLE_PAGE) break;
  }
  return { data: toutes, erreur: '' };
}

const COLONNES_OBJECTIF_ANNUEL = 'id,year,sport,template,target,current_manual';
const versObjectif = (l) => ({ id: l.id, annee: l.year, sport: l.sport, template: l.template, target: Number(l.target), currentManual: l.current_manual ?? undefined });

/** Tous les objectifs annuels de l'utilisateur (toutes années). */
export async function chargerObjectifsAnnuels(userId) {
  const r = await sb.from('yearly_goals').select(COLONNES_OBJECTIF_ANNUEL).eq('user_id', userId).order('year', { ascending: false }).limit(500);
  const res = resultat(r, 'Impossible de charger tes objectifs.');
  return { data: res.data ? res.data.map(versObjectif) : null, erreur: res.erreur };
}

/** Crée un objectif annuel (valeurs : sport, template, target, current_manual). */
export async function creerObjectifAnnuel(userId, annee, valeurs) {
  const r = await sb
    .from('yearly_goals')
    .insert({ ...valeurs, user_id: userId, year: annee, client_id: `v2-${crypto.randomUUID()}` })
    .select(COLONNES_OBJECTIF_ANNUEL)
    .single();
  const res = resultat(r, "Impossible d'enregistrer l'objectif.");
  return { data: res.data ? versObjectif(res.data) : null, erreur: res.erreur };
}

/** Modifie un objectif annuel qui t'appartient. */
export async function modifierObjectifAnnuel(userId, id, valeurs) {
  const r = await sb.from('yearly_goals').update(valeurs).eq('id', id).eq('user_id', userId).select(COLONNES_OBJECTIF_ANNUEL).single();
  const res = resultat(r, "Impossible de modifier l'objectif.");
  return { data: res.data ? versObjectif(res.data) : null, erreur: res.erreur };
}

/** Supprime un objectif annuel qui t'appartient. */
export async function supprimerObjectifAnnuel(userId, id) {
  const r = await sb.from('yearly_goals').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, "Impossible de supprimer l'objectif.");
}

// ---------------------------------------------------------------------------
// Repos, notes et annotations du calendrier (tables rest_day et day_notes)
// ---------------------------------------------------------------------------

const COLONNES_NOTE = 'id,type,text,color,from_date,to_date';

/** Notes qui recouvrent la période et jours de repos de la période. */
export async function chargerAnnotations(userId, debutIso, finIso) {
  const [notes, repos] = await Promise.all([
    sb.from('day_notes').select(COLONNES_NOTE).eq('user_id', userId).lte('from_date', finIso).gte('to_date', debutIso).order('from_date', { ascending: true }).limit(300),
    sb.from('rest_day').select('iso_date').eq('user_id', userId).gte('iso_date', debutIso).lte('iso_date', finIso).limit(400),
  ]);
  if (notes.error || repos.error) {
    console.error('[v2/api] annotations', notes.error?.code || repos.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes notes.' };
  }
  return { data: { notes: notes.data || [], repos: (repos.data || []).map((r) => r.iso_date) }, erreur: '' };
}

/** Crée une note (ligne produite par versLigneNote). */
export async function creerNote(userId, ligne) {
  const r = await sb.from('day_notes').insert({ ...ligne, user_id: userId, client_id: `v2-${crypto.randomUUID()}` }).select(COLONNES_NOTE).single();
  return resultat(r, "Impossible d'enregistrer la note.");
}

/** Modifie une note qui t'appartient. */
export async function modifierNote(userId, id, ligne) {
  const r = await sb.from('day_notes').update(ligne).eq('id', id).eq('user_id', userId).select(COLONNES_NOTE).single();
  return resultat(r, 'Impossible de modifier la note.');
}

/** Supprime une note qui t'appartient. */
export async function supprimerNote(userId, id) {
  const r = await sb.from('day_notes').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer la note.');
}

/** Pose des jours de repos (un par jour, sans doublon). */
export async function poserRepos(userId, jours) {
  const r = await sb.from('rest_day').upsert(jours.map((iso_date) => ({ user_id: userId, iso_date })), { onConflict: 'user_id,iso_date' });
  return resultat(r, "Impossible d'enregistrer le repos.");
}

/** Retire des jours de repos. */
export async function retirerRepos(userId, jours) {
  const r = await sb.from('rest_day').delete().eq('user_id', userId).in('iso_date', jours);
  return resultat(r, 'Impossible de retirer le repos.');
}

// ---------------------------------------------------------------------------
// Modèles de séances (table activity_template)
// ---------------------------------------------------------------------------

const COLONNES_MODELE = 'id,sport,sport_raw,name,duration_min,tss,description,rpe,distance_km,dplus,structure';

/** Modèles de séances de l'utilisateur. */
export async function chargerModeles(userId) {
  const r = await sb.from('activity_template').select(COLONNES_MODELE).eq('user_id', userId).order('name', { ascending: true }).limit(500);
  return resultat(r, 'Impossible de charger tes modèles.');
}

/** Crée un modèle (ligne produite par modeleDepuisValeurs). */
export async function creerModele(userId, ligne) {
  const r = await sb
    .from('activity_template')
    .insert({ ...ligne, user_id: userId, client_id: `v2-${crypto.randomUUID()}`, updated_at: new Date().toISOString() })
    .select(COLONNES_MODELE)
    .single();
  return resultat(r, "Impossible d'enregistrer le modèle.");
}

/** Supprime un modèle qui t'appartient. */
export async function supprimerModele(userId, id) {
  const r = await sb.from('activity_template').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer le modèle.');
}
