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
import { appliquerTout } from './retouches.js';

const COLONNES_SEANCE =
  'id,strava_id,source,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,avg_heartrate,avg_watts,np,tss,category';
const COLONNES_METRIQUES = 'iso_date,tss,ctl,atl,tsb,duration_min,activity_count';
const COLONNES_OBJECTIF = 'id,name,date,sport,km,d_plus,priority,duration,category';
const COLONNES_PROFIL = 'ftp,hr_max,lthr,weight,extras';

// Retouches de sorties (table activity_edits) : chargées une fois, puis réappliquées à toutes les sorties lues.
// Si elles ne se chargent pas, on affiche les sorties telles quelles plutôt que de bloquer la page.
let cacheRetouches = { userId: null, table: null };
export function invaliderRetouches() {
  cacheRetouches = { userId: null, table: null };
}
async function tableRetouches(userId) {
  if (cacheRetouches.userId === userId && cacheRetouches.table) return cacheRetouches.table;
  const table = Object.create(null); // sans prototype : une clé comme « constructor » n'est jamais prise pour une retouche
  // Par pages de 1000 (l'API n'en renvoie pas plus) : sans limite à 5000 retouches
  for (let page = 0; ; page++) {
    const r = await sb.from('activity_edits').select('activity_id,data').eq('user_id', userId).order('activity_id', { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (r.error) return null;
    for (const l of r.data || []) if (l && typeof l.data === 'object' && l.data) table[String(l.activity_id)] = l.data;
    if ((r.data || []).length < 1000 || page >= 99) break;
  }
  cacheRetouches = { userId, table };
  return table;
}
async function avecRetouches(userId, lignes) {
  const table = await tableRetouches(userId);
  return table ? appliquerTout(lignes, table) : lignes;
}

function resultat(reponse, message) {
  if (reponse.error) {
    console.error('[app/api]', message, reponse.error.code || '');
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

/**
 * La marche quotidienne (`Walk`) ne compte pas dans la charge, le volume ni les listes de l'accueil : elle les polluerait sans rien dire de la forme.
 * Elle reste visible dans le calendrier et le bilan (l'historique complet). La randonnée (`Hike`) compte, elle.
 */
function sansMarche(seances) {
  return seances.filter((s) => s.sport !== 'Walk');
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
  const res = resultat(r, 'Impossible de charger tes séances.');
  if (res.data) res.data = sansMarche(await avecRetouches(userId, res.data));
  return res;
}

/**
 * Les N séances les plus récentes, QUELLE QUE SOIT leur date (pour la liste « Dernières séances » : elle ne doit pas
 * se vider parce qu'on n'a rien fait depuis 12 semaines). On en charge beaucoup plus que ce qu'on affiche (la carte en montre
 * autant que sa hauteur le permet) : le filtre de sport se fait ensuite côté écran, et il faut remonter assez loin
 * pour trouver des séances d'un sport pratiqué moins souvent.
 */
export async function chargerDernieresSeances(userId, limite = 200) {
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .order('start_date_local', { ascending: false })
    .limit(limite);
  const res = resultat(r, 'Impossible de charger tes dernières séances.');
  if (res.data) res.data = sansMarche(await avecRetouches(userId, res.data));
  return res;
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

const COLONNES_PLANIFIEE = 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes,structure,gpx_name';

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
  const res = resultat(r, 'Impossible de charger les séances de ce mois.');
  if (res.data) res.data = await avecRetouches(userId, res.data);
  return res;
}

/**
 * Séances réalisées sur une longue période (les analyses ont besoin d'un an et plus) : on lit par pages de 500 (4 pages au plus,
 * soit 2 000 séances), de la plus ancienne à la plus récente.
 */
export async function chargerSeancesLongue(userId, debutIso, finIso) {
  const toutes = [];
  for (let page = 0; page < 4; page++) {
    const r = await sb
      .from('activities')
      .select(COLONNES_SEANCE)
      .eq('user_id', userId)
      .gte('start_date_local', debutIso)
      .lt('start_date_local', `${finIso}T23:59:59`)
      .order('start_date_local', { ascending: true })
      .range(page * 500, page * 500 + 499);
    const res = resultat(r, 'Impossible de charger tes séances.');
    if (res.erreur) return { data: null, erreur: res.erreur };
    toutes.push(...res.data);
    if (res.data.length < 500) break;
  }
  return { data: await avecRetouches(userId, toutes), erreur: '' };
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

// Lien séance prévue → programme de muscu (colonne programme_id, ajoutée par la migration 2026-10-14_prevue_programme.sql).
// Ces trois fonctions sont tolérantes : tant que la migration n'est pas appliquée, la colonne n'existe pas, la requête échoue
// et on répond « pas de lien » : rien d'autre ne casse (les listes de séances prévues n'ont volontairement PAS cette colonne).
const UUID_LIEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Programmes reliés aux séances prévues d'une période : { identifiant de la séance prévue : identifiant du programme }. */
export async function chargerLiensProgrammes(userId, debutIso, finIso) {
  const r = await sb.from('activity_planned').select('id,programme_id').eq('user_id', userId).gte('date', debutIso).lte('date', finIso).not('programme_id', 'is', null).limit(300);
  const liens = Object.create(null);
  if (r.error) return { data: liens, erreur: '' };
  for (const l of r.data || []) liens[String(l.id)] = String(l.programme_id);
  return { data: liens, erreur: '' };
}

/** Programme relié à UNE séance prévue (identifiant, ou null). */
export async function chargerLienProgramme(userId, id) {
  if (!UUID_LIEN.test(String(id))) return { data: null, erreur: '' };
  const r = await sb.from('activity_planned').select('programme_id').eq('user_id', userId).eq('id', id).maybeSingle();
  return { data: r.error ? null : r.data?.programme_id || null, erreur: '' };
}

/** Relie une séance prévue à un programme (ou retire le lien avec null). La base refuse le programme d'un autre utilisateur. */
export async function lierProgramme(userId, id, programmeId) {
  if (!UUID_LIEN.test(String(id)) || (programmeId != null && !UUID_LIEN.test(String(programmeId)))) return { erreur: 'Programme introuvable.' };
  const r = await sb.from('activity_planned').update({ programme_id: programmeId || null }).eq('user_id', userId).eq('id', id);
  if (r.error) {
    console.error('[app/api]', 'lien programme', r.error.code || '');
    return { erreur: "La séance est enregistrée, mais son lien avec le programme n'a pas pu l'être." };
  }
  return { erreur: '' };
}

// ---------------------------------------------------------------------------
// Détail d'une séance
// ---------------------------------------------------------------------------

const COLONNES_DETAIL =
  'id,strava_id,source,name,sport,start_date_local,elapsed_time,moving_time,distance_km,total_elevation_gain,avg_speed_kmh,max_speed_kmh,' +
  'avg_heartrate,max_heartrate,avg_watts,max_watts,np,intensity,ftp_at_time,avg_cadence,kj,calories,tss,variability_index,' +
  'has_heartrate,has_power,user_notes,rpe,category,planned_id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Une séance du joueur (jamais les gros champs : streams, GPX…). Un identifiant qui n'est pas un UUID n'existe pas. */
export async function chargerSeance(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const r = await sb.from('activities').select(COLONNES_DETAIL).eq('user_id', userId).eq('id', id).maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Séance introuvable.' };
  const res = resultat(r, 'Impossible de charger cette séance.');
  if (res.data) res.data = (await avecRetouches(userId, [res.data]))[0];
  return res;
}

/** Streams d'une séance (courbes), chargés à part car volumineux (jusqu'à plusieurs centaines de Ko). */
export async function chargerStreams(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: '' };
  const r = await sb.from('activities').select('streams_gz,streams_format').eq('user_id', userId).eq('id', id).maybeSingle();
  if (r.error) {
    console.error('[app/api] streams', r.error.code || '');
    return { data: null, erreur: 'Impossible de charger les courbes de cette séance.' };
  }
  if (!r.data || !r.data.streams_gz || r.data.streams_format === 'none') return { data: null, erreur: '' };
  try {
    return { data: await decoderStreams(r.data.streams_gz), erreur: '' };
  } catch (e) {
    console.error('[app/api] décodage des streams');
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
    .insert({ ...ligne, user_id: userId, client_id: `app-${crypto.randomUUID()}` })
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

const COLONNES_PROFIL_COMPLET = 'weight,ftp,hr_max,lthr,extras';

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

export const COLONNES_COMPETITION = 'id,name,date,start_date_local,sport,priority,km,d_plus,type,duration,notes,category,gpx_name';

/** Compétitions prévues (toutes dates ; la page sépare passé et futur) et compétitions déjà courues. */
export async function chargerCompetitions(userId) {
  const [prevues, courues] = await Promise.all([
    sb.from('activity_planned').select(COLONNES_COMPETITION).eq('user_id', userId).eq('category', 'competition').order('date', { ascending: true }).limit(300),
    sb.from('activities').select(`${COLONNES_SEANCE},priority,result_place,result_total,result_catev`).eq('user_id', userId).eq('category', 'competition').order('start_date_local', { ascending: false }).limit(200),
  ]);
  if (prevues.error || courues.error) {
    console.error('[app/api] competitions', prevues.error?.code || courues.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes compétitions.' };
  }
  return { data: { prevues: prevues.data || [], courues: await avecRetouches(userId, courues.data || []) }, erreur: '' };
}

/**
 * Marque une activité comme compétition (ou la repasse en entraînement). `category_set_by_user` empêche la synchro Strava
 * de la reclasser ensuite (même règle qu'avant). N'écrit que sur une activité de l'utilisateur.
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
// Bilan annuel : tout l'historique des activités et les objectifs annuels
// ---------------------------------------------------------------------------

const COLONNES_BILAN = 'id,strava_id,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,tss';
const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages
const PAGES_MAX = 100; // garde-fou : 100 000 activités ; au-delà, on le dit au lieu d'afficher un bilan tronqué

/** Tout l'historique, de la toute première activité à la fin de l'année (colonnes légères), par pages de 1000. Les étapes fusionnées d'un triathlon sont déjà comptées par leur parent. */
export async function chargerActivitesBilan(userId, annee) {
  const toutes = [];
  let complet = false;
  for (let page = 0; page < PAGES_MAX; page++) {
    const r = await sb
      .from('activities')
      .select(COLONNES_BILAN)
      .eq('user_id', userId)
      .is('merged_into', null)
      .lte('start_date_local', `${annee}-12-31T23:59:59`)
      .order('start_date_local', { ascending: true })
      .order('id', { ascending: true }) // second critère : sans lui, deux séances à la même heure peuvent être doublées ou sautées entre deux pages
      .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
    if (r.error) {
      console.error('[app/api] bilan', r.error.code || '');
      return { data: null, erreur: 'Impossible de charger tes activités.' };
    }
    toutes.push(...r.data);
    if (r.data.length < TAILLE_PAGE) {
      complet = true;
      break;
    }
  }
  if (!complet) return { data: null, erreur: 'Ton historique est trop long pour être chargé en entier.' };
  return { data: await avecRetouches(userId, toutes), erreur: '' };
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
    .insert({ ...valeurs, user_id: userId, year: annee, client_id: `app-${crypto.randomUUID()}` })
    .select(COLONNES_OBJECTIF_ANNUEL)
    .single();
  // 23505 : la base refuse un doublon (même sport, même objectif, même année)
  const res = resultat(r, r.error?.code === '23505' ? 'Cet objectif existe déjà pour cette année : modifie-le plutôt.' : "Impossible d'enregistrer l'objectif.");
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
    console.error('[app/api] annotations', notes.error?.code || repos.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes notes.' };
  }
  return { data: { notes: notes.data || [], repos: (repos.data || []).map((r) => r.iso_date) }, erreur: '' };
}

/** Crée une note (ligne produite par versLigneNote). */
export async function creerNote(userId, ligne) {
  const r = await sb.from('day_notes').insert({ ...ligne, user_id: userId, client_id: `app-${crypto.randomUUID()}` }).select(COLONNES_NOTE).single();
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
    .insert({ ...ligne, user_id: userId, client_id: `app-${crypto.randomUUID()}`, updated_at: new Date().toISOString() })
    .select(COLONNES_MODELE)
    .single();
  return resultat(r, "Impossible d'enregistrer le modèle.");
}

/** Supprime un modèle qui t'appartient. */
export async function supprimerModele(userId, id) {
  const r = await sb.from('activity_template').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer le modèle.');
}

// ---------------------------------------------------------------------------
// Lien prévu / réalisé (colonne activities.planned_id)
// ---------------------------------------------------------------------------

/** Séance prévue (avec sa structure) d'après son identifiant. Un identifiant qui n'est pas un UUID n'existe pas. */
export async function chargerPlanifieeParId(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: '' };
  const r = await sb.from('activity_planned').select('id,name,date,sport,duration,tss,km,rpe,structure,category').eq('user_id', userId).eq('id', id).maybeSingle();
  return resultat(r, 'Impossible de charger la séance prévue.');
}

/** Séances prévues d'un jour (pour proposer un rapprochement avec une sortie). */
export async function chargerPlanifieesDuJour(userId, dateIso) {
  const r = await sb.from('activity_planned').select('id,name,date,sport,duration,tss,km,structure,category').eq('user_id', userId).eq('date', dateIso).limit(20);
  return resultat(r, 'Impossible de charger les séances prévues de ce jour.');
}

/** Relie une sortie à une séance prévue (uuid), ou la délie ('none'). N'écrit que sur une activité de l'utilisateur. */
export async function lierPrevu(userId, activiteId, valeur) {
  if (valeur !== 'none' && !UUID.test(String(valeur))) return { data: null, erreur: 'Séance prévue invalide.' };
  const r = await sb.from('activities').update({ planned_id: valeur }).eq('id', activiteId).eq('user_id', userId).select('id,planned_id').maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Sortie introuvable.' };
  return resultat(r, 'Impossible de modifier le lien.');
}

// ---------------------------------------------------------------------------
// Sorties saisies à la main (source = 'manual') et retouches des sorties Strava (activity_edits)
// ---------------------------------------------------------------------------

/** Crée une sortie saisie à la main (ligne produite par versLigneManuelle). */
export async function creerSortieManuelle(userId, ligne, clientId = null) {
  const r = await sb
    .from('activities')
    .insert({ ...ligne, user_id: userId, client_id: clientId || `app-${crypto.randomUUID()}` })
    .select(COLONNES_DETAIL)
    .single();
  return resultat(r, "Impossible d'enregistrer la sortie.");
}

/** Modifie une sortie saisie à la main. Le filtre sur `source` garantit qu'une sortie Strava ou Garmin n'est jamais écrasée. */
export async function modifierSortieManuelle(userId, id, ligne) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Sortie introuvable.' };
  const r = await sb.from('activities').update(ligne).eq('id', id).eq('user_id', userId).eq('source', 'manual').select(COLONNES_DETAIL).maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Sortie introuvable.' };
  return resultat(r, 'Impossible de modifier la sortie.');
}

/** Supprime une sortie saisie à la main (jamais une sortie synchronisée). */
export async function supprimerSortieManuelle(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Sortie introuvable.' };
  const r = await sb.from('activities').delete().eq('id', id).eq('user_id', userId).eq('source', 'manual');
  return resultat(r, 'Impossible de supprimer la sortie.');
}

/** Enregistre (ou remplace) les retouches d'une sortie Strava. `cle` : strava_id en texte. */
export async function enregistrerRetouche(userId, cle, data) {
  const r = await sb.from('activity_edits').upsert({ user_id: userId, activity_id: String(cle), data }, { onConflict: 'user_id,activity_id' });
  invaliderRetouches();
  return resultat(r, "Impossible d'enregistrer tes retouches.");
}

/** Efface les retouches d'une sortie : elle retrouve ses valeurs d'origine. */
export async function supprimerRetouche(userId, cle) {
  const r = await sb.from('activity_edits').delete().eq('user_id', userId).eq('activity_id', String(cle));
  invaliderRetouches();
  return resultat(r, "Impossible d'effacer tes retouches.");
}

/** Enregistre (ou efface, valeurs à null) le résultat saisi à la main d'une compétition courue. */
export async function enregistrerResultat(userId, id, valeurs) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Sortie introuvable.' };
  const r = await sb.from('activities').update(valeurs).eq('id', id).eq('user_id', userId).select('id,result_place,result_total,result_catev').maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Sortie introuvable.' };
  return resultat(r, "Impossible d'enregistrer le résultat.");
}

/** Contenu GPX d'une séance prévue ou d'une compétition (colonne lourde, chargée seulement quand on affiche le parcours). */
export async function chargerGpx(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: '' };
  const r = await sb.from('activity_planned').select('gpx_content').eq('user_id', userId).eq('id', id).maybeSingle();
  const res = resultat(r, 'Impossible de charger le parcours.');
  return { data: typeof res.data?.gpx_content === 'string' && res.data.gpx_content ? res.data.gpx_content : null, erreur: res.erreur };
}

// ---------------------------------------------------------------------------
// Carnet de force : exercices perso, programmes, séries (tables strength_*)
// ---------------------------------------------------------------------------

const COLONNES_SERIE = 'id,activity_id,date,exercise_key,exercise_name,muscle_group,position,set_no,reps,weight_kg';
// La colonne « rir » (répétitions en réserve) vient d'une migration : tant qu'elle n'est pas en base, on lit et on écrit sans elle.
let rirDisponible = true;
const colonnesSerie = () => COLONNES_SERIE + (rirDisponible ? ',rir' : '');
const colonneRirAbsente = (e) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /\brir\b/i.test(String(e.message || '')));
const COLONNES_PROGRAMME = 'id,name,exercises,notes,created_at';

/**
 * Séries des N derniers jours (les plus récentes d'abord), 10 ans par défaut : les records se cherchent dans tout l'historique.
 * Supabase ne renvoie qu'un certain nombre de lignes par requête (1000 par défaut) : on lit par pages, jusqu'à `limite` séries.
 * Le tri a un second critère (id) pour que les pages ne se chevauchent pas quand plusieurs séries ont la même date.
 */
export async function chargerSeriesForce(userId, jours = 3650, limite = 5000) {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const PAGE = 1000;
  const lignes = [];
  for (let debut = 0; debut < limite; debut += PAGE) {
    let r = await sb
      .from('strength_sets')
      .select(colonnesSerie())
      .eq('user_id', userId)
      .gte('date', dateIsoLocale(depuis))
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(debut, Math.min(debut + PAGE, limite) - 1);
    if (r.error && rirDisponible && colonneRirAbsente(r.error)) {
      rirDisponible = false; // pas encore de colonne rir : on relit sans
      r = await sb.from('strength_sets').select(colonnesSerie()).eq('user_id', userId).gte('date', dateIsoLocale(depuis)).order('date', { ascending: false }).order('id', { ascending: true }).range(debut, Math.min(debut + PAGE, limite) - 1);
    }
    if (r.error) return resultat(r, 'Impossible de charger ton carnet de force.');
    lignes.push(...(r.data || []));
    if ((r.data || []).length < PAGE) break; // dernière page
  }
  return resultat({ data: lignes, error: null }, 'Impossible de charger ton carnet de force.');
}

/** Séries d'une séance précise. */
export async function chargerSeriesSeance(userId, activiteId) {
  if (!UUID.test(String(activiteId))) return { data: [], erreur: '' };
  const lire = () => sb.from('strength_sets').select(colonnesSerie()).eq('user_id', userId).eq('activity_id', activiteId).order('position', { ascending: true }).order('set_no', { ascending: true }).limit(1500);
  let r = await lire();
  if (r.error && rirDisponible && colonneRirAbsente(r.error)) {
    rirDisponible = false;
    r = await lire();
  }
  return resultat(r, 'Impossible de charger les séries de cette séance.');
}

export async function chargerProgrammes(userId) {
  const r = await sb.from('strength_programs').select(COLONNES_PROGRAMME).eq('user_id', userId).order('created_at', { ascending: true }).limit(100);
  return resultat(r, 'Impossible de charger tes programmes.');
}

export async function creerProgramme(userId, ligne) {
  const r = await sb.from('strength_programs').insert({ ...ligne, user_id: userId }).select(COLONNES_PROGRAMME).single();
  return resultat(r, "Impossible d'enregistrer le programme.");
}

export async function modifierProgramme(userId, id, ligne) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Programme introuvable.' };
  const r = await sb.from('strength_programs').update({ ...ligne, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select(COLONNES_PROGRAMME).maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Programme introuvable.' };
  return resultat(r, 'Impossible de modifier le programme.');
}

export async function supprimerProgramme(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Programme introuvable.' };
  const r = await sb.from('strength_programs').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer le programme.');
}

export async function chargerExercicesPerso(userId) {
  const r = await sb.from('strength_exercises').select('id,name,muscle_group').eq('user_id', userId).order('name', { ascending: true }).limit(500);
  return resultat(r, 'Impossible de charger tes exercices.');
}

export async function creerExercicePerso(userId, nom, groupe) {
  const r = await sb.from('strength_exercises').insert({ user_id: userId, name: nom, muscle_group: groupe }).select('id,name,muscle_group').single();
  return resultat(r, "Impossible d'ajouter l'exercice.");
}

export async function supprimerExercicePerso(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Exercice introuvable.' };
  const r = await sb.from('strength_exercises').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, "Impossible de supprimer l'exercice.");
}

/** Insère des séries par paquets (la base limite la taille d'une requête). */
async function insererSeries(userId, activiteId, lignes) {
  for (let i = 0; i < lignes.length; i += 400) {
    const sansRir = (l) => {
      const { rir, ...reste } = l; // eslint-disable-line no-unused-vars
      return reste;
    };
    const paquet = lignes.slice(i, i + 400).map((l) => ({ ...(rirDisponible ? l : sansRir(l)), user_id: userId, activity_id: activiteId }));
    let r = await sb.from('strength_sets').insert(paquet);
    if (r.error && rirDisponible && colonneRirAbsente(r.error)) {
      rirDisponible = false; // la colonne n'existe pas encore : on enregistre sans le RIR plutôt que de perdre la séance
      r = await sb.from('strength_sets').insert(paquet.map(sansRir));
    }
    if (r.error) {
      console.error('[app/api] séries', r.error.code || '');
      return false;
    }
  }
  return true;
}

/**
 * Enregistre une séance de force : la séance (ligne `activities` saisie à la main) puis ses séries.
 *  - création : si les séries échouent, la séance créée est supprimée (pas de séance vide à moitié enregistrée) ;
 *  - modification : `existante` = { id, manuelle }. Une séance Strava n'est jamais réécrite : on remplace seulement ses séries ;
 *  - remplacement des séries : on insère les nouvelles AVANT de supprimer les anciennes (par leur identifiant), pour ne rien perdre en cas d'échec.
 */
export async function enregistrerSeanceForce(userId, ligne, lignesSeries, existante = null, clientId = null) {
  let id = existante?.id;
  if (!existante) {
    const c = await creerSortieManuelle(userId, ligne, clientId);
    if (c.erreur) return { data: null, erreur: c.erreur };
    id = c.data.id;
    if (!(await insererSeries(userId, id, lignesSeries))) {
      await supprimerSortieManuelle(userId, id);
      return { data: null, erreur: "Impossible d'enregistrer les séries. Rien n'a été gardé, réessaie." };
    }
    return { data: { id }, erreur: '' };
  }
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  if (existante.manuelle) {
    const m = await modifierSortieManuelle(userId, id, ligne);
    if (m.erreur) return { data: null, erreur: m.erreur };
  }
  const anciennes = await sb.from('strength_sets').select('id').eq('user_id', userId).eq('activity_id', id).limit(1500);
  if (anciennes.error) return { data: null, erreur: 'Impossible de relire les séries de cette séance.' };
  if (!(await insererSeries(userId, id, lignesSeries))) return { data: null, erreur: "Impossible d'enregistrer les séries. Les anciennes sont conservées." };
  const ids = (anciennes.data || []).map((l) => l.id);
  for (let i = 0; i < ids.length; i += 200) {
    const d = await sb.from('strength_sets').delete().eq('user_id', userId).in('id', ids.slice(i, i + 200));
    if (d.error) return { data: null, erreur: "Les nouvelles séries sont enregistrées, mais les anciennes n'ont pas pu être retirées." };
  }
  return { data: { id }, erreur: '' };
}

/** Supprime les séries d'une séance (séance Strava : la séance reste) ou la séance entière (saisie à la main : séries en cascade). */
export async function supprimerSeanceForce(userId, id, manuelle) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  if (manuelle) return supprimerSortieManuelle(userId, id);
  const r = await sb.from('strength_sets').delete().eq('user_id', userId).eq('activity_id', id);
  return resultat(r, 'Impossible de supprimer les séries.');
}

// ---------------------------------------------------------------------------
// Hyrox : tests / courses (hyrox_tests) et objectif de temps (hyrox_objectif)
// ---------------------------------------------------------------------------

const COLONNES_HYROX = 'id,date,label,kind,segments,total_s,source,activity_id,notes';

export async function chargerTestsHyrox(userId) {
  const r = await sb.from('hyrox_tests').select(COLONNES_HYROX).eq('user_id', userId).order('date', { ascending: false }).limit(200);
  return resultat(r, 'Impossible de charger tes tests Hyrox.');
}

export async function creerTestHyrox(userId, valeurs, extra = {}) {
  const r = await sb.from('hyrox_tests').insert({ ...valeurs, ...extra, user_id: userId }).select(COLONNES_HYROX).single();
  return resultat(r, "Impossible d'enregistrer le test.");
}

export async function modifierTestHyrox(userId, id, valeurs) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Test introuvable.' };
  const r = await sb.from('hyrox_tests').update(valeurs).eq('id', id).eq('user_id', userId).select(COLONNES_HYROX).maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Test introuvable.' };
  return resultat(r, 'Impossible de modifier le test.');
}

export async function supprimerTestHyrox(userId, id) {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Test introuvable.' };
  const r = await sb.from('hyrox_tests').delete().eq('id', id).eq('user_id', userId);
  return resultat(r, 'Impossible de supprimer le test.');
}

export async function chargerObjectifHyrox(userId) {
  const r = await sb.from('hyrox_objectif').select('total_s,segments').eq('user_id', userId).maybeSingle();
  return resultat(r, "Impossible de charger ton objectif Hyrox.");
}

export async function enregistrerObjectifHyrox(userId, valeurs) {
  const r = await sb.from('hyrox_objectif').upsert({ ...valeurs, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return resultat(r, "Impossible d'enregistrer ton objectif.");
}

export async function supprimerObjectifHyrox(userId) {
  const r = await sb.from('hyrox_objectif').delete().eq('user_id', userId);
  return resultat(r, "Impossible d'effacer ton objectif.");
}

// ---------------------------------------------------------------------------
// Import Hevy : ce qui existe déjà autour des dates importées
// ---------------------------------------------------------------------------

/** Séances déjà dans l'app entre deux dates, et lesquelles ont déjà des séries. Sert à ne rien importer en double. */
export async function chargerContexteImport(userId, debutIso, finIso) {
  const existantes = [];
  for (let page = 0; page < 6; page++) {
    const r = await sb
      .from('activities')
      .select('id,source,sport,start_date_local,client_id')
      .eq('user_id', userId)
      .gte('start_date_local', `${debutIso}T00:00:00`)
      .lt('start_date_local', `${finIso}T23:59:59`)
      .order('start_date_local', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (r.error) return { data: null, erreur: "Impossible de lire tes séances existantes." };
    existantes.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const avecSeries = new Set();
  for (let page = 0; page < 10; page++) {
    const r = await sb
      .from('strength_sets')
      .select('activity_id')
      .eq('user_id', userId)
      .gte('date', debutIso)
      .lte('date', finIso)
      .range(page * 1000, page * 1000 + 999);
    if (r.error) return { data: null, erreur: 'Impossible de lire tes séries existantes.' };
    for (const l of r.data) avecSeries.add(l.activity_id);
    if (r.data.length < 1000) break;
  }
  return { data: { existantes, avecSeries }, erreur: '' };
}
