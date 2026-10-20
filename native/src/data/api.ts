// Accès aux données Supabase (lecture). Port de app/src/lib/data/api.js.
// La RLS garantit que chaque utilisateur ne lit que ses propres lignes ; on filtre quand même explicitement par user_id
// (défense en profondeur, et requêtes plus lisibles).
//
// RÈGLES :
//  - JAMAIS de select('*') sur `activities` : la table contient de très grosses colonnes
//    (streams_gz, streams_blob, gpx_blob, gpx_content, power_curve…). On liste les colonnes utiles.
//  - Toutes les fonctions renvoient { data, erreur } ; `erreur` est un message court en français,
//    jamais le texte brut de l'erreur de la base.
//  - Pour l'instant : lecture seule. Les écritures (séances, programmes, tests) arrivent avec leurs écrans.
import { appliquerTout } from './retouches';
import { dateIsoLocale } from './format';
import { sb } from './supabase';
import type { ObjectifAnnuel } from './bilan.ts';
import type { LigneProfil } from './profil.ts';
import type { Nuit, Metrique, Note, Objectif, ObjectifHyrox, PointPuissance, Prevue, ProgrammeForce, Profil, Seance, SerieForce, TestHyrox } from './types';

export interface Resultat<T> {
  data: T | null;
  erreur: string;
}

const COLONNES_SEANCE =
  'id,strava_id,source,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,avg_heartrate,avg_watts,np,tss,category';
const COLONNES_METRIQUES = 'iso_date,tss,ctl,atl,tsb,duration_min,activity_count';
const COLONNES_OBJECTIF = 'id,name,date,sport,km,d_plus,priority,duration,category';
const COLONNES_PROFIL = 'ftp,hr_max,lthr,weight,extras';
const COLONNES_PLANIFIEE = 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes,structure,gpx_name';
const COLONNES_SERIE = 'id,activity_id,date,exercise_key,exercise_name,muscle_group,position,set_no,reps,weight_kg';
const COLONNES_PROGRAMME = 'id,name,exercises,notes,created_at';
const COLONNES_HYROX = 'id,date,label,kind,segments,total_s,source,activity_id,notes';

interface Reponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function resultat<T>(reponse: Reponse, message: string): Resultat<T> {
  if (reponse.error) {
    // On ne journalise jamais le texte brut de l'erreur (il peut contenir des détails de la base), seulement son code
    console.error('[app/api]', message, reponse.error.code || '');
    return { data: null, erreur: message };
  }
  return { data: reponse.data as T, erreur: '' };
}

// Retouches de séances (table activity_edits) : chargées une fois, puis réappliquées à toutes les séances lues.
// Si elles ne se chargent pas, on affiche les séances telles quelles plutôt que de bloquer la page.
let cacheRetouches: { userId: string | null; table: Record<string, unknown> | null } = { userId: null, table: null };
export function invaliderRetouches(): void {
  cacheRetouches = { userId: null, table: null };
}
async function tableRetouches(userId: string): Promise<Record<string, unknown> | null> {
  if (cacheRetouches.userId === userId && cacheRetouches.table) return cacheRetouches.table;
  const r = await sb.from('activity_edits').select('activity_id,data').eq('user_id', userId).limit(5000);
  if (r.error) return null;
  const table: Record<string, unknown> = Object.create(null); // sans prototype : une clé comme « constructor » n'est jamais prise pour une retouche
  for (const l of (r.data as { activity_id: unknown; data: unknown }[]) || []) if (l && typeof l.data === 'object' && l.data) table[String(l.activity_id)] = l.data;
  cacheRetouches = { userId, table };
  return table;
}
async function avecRetouches(userId: string, lignes: Seance[]): Promise<Seance[]> {
  const table = await tableRetouches(userId);
  return table ? appliquerTout(lignes, table) : lignes;
}

export async function chargerProfil(userId: string): Promise<Resultat<Profil | null>> {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL).eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton profil.');
}

/** Métriques de charge quotidiennes (CTL, ATL, TSB) sur les N derniers jours. */
export async function chargerMetriques(userId: string, jours = 90): Promise<Resultat<Metrique[]>> {
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

/** Prochaines compétitions (objectifs), de la plus proche à la plus lointaine. */
export async function chargerObjectifs(userId: string, limite = 3): Promise<Resultat<Objectif[]>> {
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
export async function chargerPuissance(userId: string): Promise<Resultat<PointPuissance[]>> {
  const r = await sb
    .from('power_profile')
    .select('duration_s,watts_90d,watts_alltime')
    .eq('user_id', userId)
    .in('duration_s', DUREES_PUISSANCE)
    .order('duration_s', { ascending: true });
  return resultat(r, 'Impossible de charger ta courbe de puissance.');
}

/** Séances prévues entre deux dates ISO incluses. */
export async function chargerPlanifiees(userId: string, debutIso: string, finIso: string): Promise<Resultat<Prevue[]>> {
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

/**
 * Programmes reliés aux séances prévues d'une période : { identifiant de la séance prévue : identifiant du programme }.
 * Tolérante : tant que la colonne programme_id n'existe pas en base, la requête échoue et on répond « pas de lien ».
 */
export async function chargerLiensProgrammes(userId: string, debutIso: string, finIso: string): Promise<Resultat<Record<string, string>>> {
  const r = await sb.from('activity_planned').select('id,programme_id').eq('user_id', userId).gte('date', debutIso).lte('date', finIso).not('programme_id', 'is', null).limit(300);
  const liens: Record<string, string> = Object.create(null);
  if (r.error) return { data: liens, erreur: '' };
  for (const l of (r.data as { id: unknown; programme_id: unknown }[]) || []) liens[String(l.id)] = String(l.programme_id);
  return { data: liens, erreur: '' };
}

// La colonne « rir » (répétitions en réserve) vient d'une migration : tant qu'elle n'est pas en base, on lit sans elle.
let rirDisponible = true;
const colonnesSerie = () => COLONNES_SERIE + (rirDisponible ? ',rir' : '');
const colonneRirAbsente = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /\brir\b/i.test(String(e.message || '')));

/**
 * Séries des N derniers jours (les plus récentes d'abord), 10 ans par défaut : les records se cherchent dans tout l'historique.
 * Supabase ne renvoie qu'un certain nombre de lignes par requête (1000 par défaut) : on lit par pages, jusqu'à `limite` séries.
 * Le tri a un second critère (id) pour que les pages ne se chevauchent pas quand plusieurs séries ont la même date.
 */
export async function chargerSeriesForce(userId: string, jours = 3650, limite = 5000): Promise<Resultat<SerieForce[]>> {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const PAGE = 1000;
  const lignes: SerieForce[] = [];
  const lirePage = (debut: number) =>
    sb
      .from('strength_sets')
      .select(colonnesSerie())
      .eq('user_id', userId)
      .gte('date', dateIsoLocale(depuis))
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(debut, Math.min(debut + PAGE, limite) - 1);
  for (let debut = 0; debut < limite; debut += PAGE) {
    let r = await lirePage(debut);
    if (r.error && rirDisponible && colonneRirAbsente(r.error)) {
      rirDisponible = false; // pas encore de colonne rir : on relit sans
      r = await lirePage(debut);
    }
    if (r.error) return resultat(r, 'Impossible de charger ton carnet de force.');
    const page = (r.data as unknown as SerieForce[]) || [];
    lignes.push(...page);
    if (page.length < PAGE) break; // dernière page
  }
  return { data: lignes, erreur: '' };
}

export async function chargerProgrammes(userId: string): Promise<Resultat<ProgrammeForce[]>> {
  const r = await sb.from('strength_programs').select(COLONNES_PROGRAMME).eq('user_id', userId).order('created_at', { ascending: true }).limit(100);
  return resultat(r, 'Impossible de charger tes programmes.');
}

export async function chargerTestsHyrox(userId: string): Promise<Resultat<TestHyrox[]>> {
  const r = await sb.from('hyrox_tests').select(COLONNES_HYROX).eq('user_id', userId).order('date', { ascending: false }).limit(200);
  return resultat(r, 'Impossible de charger tes tests Hyrox.');
}

export async function chargerObjectifHyrox(userId: string): Promise<Resultat<ObjectifHyrox | null>> {
  const r = await sb.from('hyrox_objectif').select('total_s,segments').eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton objectif Hyrox.');
}

/** Sports choisis par l'utilisateur (user_preferences.sports) : null s'il ne les a jamais choisis ou si la colonne n'existe pas. */
export async function chargerSportsChoisis(userId: string): Promise<Resultat<unknown>> {
  const r = await sb.from('user_preferences').select('sports').eq('user_id', userId).maybeSingle();
  if (r.error) return { data: null, erreur: '' }; // tolérant : sans préférences, la barre se déduit des séances
  return { data: (r.data as { sports?: unknown } | null)?.sports ?? null, erreur: '' };
}

// ---------------------------------------------------------------------------
// Calendrier : séances réalisées, séances prévues et annotations d'une période
// ---------------------------------------------------------------------------

/** Séances réalisées entre deux dates ISO incluses (le calendrier d'un mois). */
export async function chargerSeancesPeriode(userId: string, debutIso: string, finIso: string): Promise<Resultat<Seance[]>> {
  const r = await sb
    .from('activities')
    .select(COLONNES_SEANCE)
    .eq('user_id', userId)
    .gte('start_date_local', debutIso)
    .lt('start_date_local', `${finIso}T23:59:59`)
    .order('start_date_local', { ascending: true })
    .limit(500);
  const res = resultat<Seance[]>(r, 'Impossible de charger les séances de ce mois.');
  if (res.data) res.data = await avecRetouches(userId, res.data);
  return res;
}

const COLONNES_NOTE = 'id,type,text,color,from_date,to_date';

/** Notes qui recouvrent la période et jours de repos de la période. */
export async function chargerAnnotations(userId: string, debutIso: string, finIso: string): Promise<Resultat<{ notes: Note[]; repos: string[] }>> {
  const [notes, repos] = await Promise.all([
    sb.from('day_notes').select(COLONNES_NOTE).eq('user_id', userId).lte('from_date', finIso).gte('to_date', debutIso).order('from_date', { ascending: true }).limit(300),
    sb.from('rest_day').select('iso_date').eq('user_id', userId).gte('iso_date', debutIso).lte('iso_date', finIso).limit(400),
  ]);
  if (notes.error || repos.error) {
    console.error('[app/api] annotations', notes.error?.code || repos.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes notes.' };
  }
  return { data: { notes: (notes.data as unknown as Note[]) || [], repos: ((repos.data as { iso_date: string }[]) || []).map((r) => r.iso_date) }, erreur: '' };
}

// ---------------------------------------------------------------------------
// Bilan annuel : activités des 3 dernières années et objectifs annuels
// ---------------------------------------------------------------------------

const COLONNES_BILAN = 'id,strava_id,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,tss';
const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages

/** Activités de l'année et des deux précédentes (colonnes légères), par pages de 1000. */
export async function chargerActivitesBilan(userId: string, annee: number): Promise<Resultat<Seance[]>> {
  const toutes: Seance[] = [];
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
      console.error('[app/api] bilan', r.error.code || '');
      return { data: null, erreur: 'Impossible de charger tes activités.' };
    }
    const lignes = (r.data as unknown as Seance[]) || [];
    toutes.push(...lignes);
    if (lignes.length < TAILLE_PAGE) break;
  }
  return { data: await avecRetouches(userId, toutes), erreur: '' };
}

const COLONNES_OBJECTIF_ANNUEL = 'id,year,sport,template,target,current_manual';
const versObjectif = (l: { id: string; year: number; sport: string; template: string; target: unknown; current_manual: number | null }): ObjectifAnnuel => ({
  id: l.id,
  annee: l.year,
  sport: l.sport,
  template: l.template,
  target: Number(l.target),
  currentManual: l.current_manual ?? undefined,
});

/** Tous les objectifs annuels de l'utilisateur (toutes années). */
export async function chargerObjectifsAnnuels(userId: string): Promise<Resultat<ObjectifAnnuel[]>> {
  const r = await sb.from('yearly_goals').select(COLONNES_OBJECTIF_ANNUEL).eq('user_id', userId).order('year', { ascending: false }).limit(500);
  const res = resultat<Parameters<typeof versObjectif>[0][]>(r, 'Impossible de charger tes objectifs.');
  return { data: res.data ? res.data.map(versObjectif) : null, erreur: res.erreur };
}

// ---------------------------------------------------------------------------
// Sommeil (nuits Garmin déjà importées)
// ---------------------------------------------------------------------------

// Colonnes de garmin_sleep, sans `hr_stream` (gros JSON, chargé seulement à l'ouverture d'une nuit)
const COLONNES_SOMMEIL =
  'date,bedtime,wake_time,total_sec,deep_sec,light_sec,rem_sec,awake_sec,awake_count,restless_count,avg_stress,avg_heart_rate,resting_heart_rate,body_battery_change,hrv_avg,hrv_status,resp_avg,resp_min,resp_max,spo2_avg,score,score_qualifier,segments';

/** Nuits Garmin des N derniers jours (la plus récente d'abord). */
export async function chargerSommeil(userId: string, jours = 90): Promise<Resultat<Nuit[]>> {
  const r = await sb.from('garmin_sleep').select(COLONNES_SOMMEIL).eq('user_id', userId).order('date', { ascending: false }).limit(jours);
  return resultat<Nuit[]>(r as Reponse, 'Impossible de charger ton sommeil.');
}

/** FC minute par minute d'UNE nuit ([minute, bpm]) : colonne lourde, chargée seulement quand on ouvre le détail. */
export async function chargerFcNuit(userId: string, date: string): Promise<Resultat<[number, number][]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { data: null, erreur: 'Date invalide.' };
  const r = await sb.from('garmin_sleep').select('hr_stream').eq('user_id', userId).eq('date', date).maybeSingle();
  const res = resultat<{ hr_stream?: unknown }>(r as Reponse, 'Impossible de charger la FC de cette nuit.');
  const flux = res.data?.hr_stream;
  return { data: Array.isArray(flux) ? (flux as [number, number][]) : null, erreur: res.erreur };
}

// ---------------------------------------------------------------------------
// Paramètres : profil et sports choisis
// ---------------------------------------------------------------------------

const COLONNES_PROFIL_COMPLET = 'weight,ftp,hr_max,lthr,extras';

/** Le profil complet (colonnes + extras), ou null si aucune ligne n'existe encore. */
export async function chargerProfilComplet(userId: string): Promise<Resultat<LigneProfil>> {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL_COMPLET).eq('user_id', userId).maybeSingle();
  return resultat<LigneProfil>(r as Reponse, 'Impossible de charger ton profil.');
}

/**
 * Enregistre une section du profil. `colonnes` : colonnes à mettre à jour ; `extras` : objet COMPLET (les clés des autres
 * sections sont déjà conservées par versPayload). Ne touche que la ligne de l'utilisateur connecté.
 */
export async function enregistrerProfil(userId: string, colonnes: Record<string, unknown>, extras: Record<string, unknown>): Promise<Resultat<LigneProfil>> {
  const r = await sb
    .from('user_profiles')
    .update({ ...colonnes, extras, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select(COLONNES_PROFIL_COMPLET)
    .maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Profil introuvable : reconnecte-toi puis réessaie.' };
  return resultat<LigneProfil>(r as Reponse, "Impossible d'enregistrer ton profil.");
}

/** Enregistre les sports choisis (déjà nettoyés). N'écrit ni le thème, ni les disciplines du site, ni autre chose. */
export async function enregistrerSportsChoisis(userId: string, sports: string[]): Promise<{ erreur: string }> {
  const r = await sb.from('user_preferences').upsert({ user_id: userId, sports }, { onConflict: 'user_id' });
  if (r.error) {
    const e = r.error as { code?: string; message?: string };
    console.error('[app/api] sports', r.status, e.code || '', String(e.message || '').slice(0, 120));
    // Pour comprendre une panne : le code SQL s'il y en a un, le statut HTTP et le début du message technique (jamais de données)
    const code = /^[A-Za-z0-9]{3,8}$/.test(e.code ?? '') ? ` (code ${e.code})` : '';
    const technique = String(e.message || '').replace(/[^\w .:/-]/g, '').slice(0, 60);
    return { erreur: `Impossible d'enregistrer tes sports${code} [${r.status}${technique ? ` ${technique}` : ''}].` };
  }
  return { erreur: '' };
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

// ---------------------------------------------------------------------------
// Disposition de l'accueil de l'app mobile (user_preferences.layout_mobile). Le site a la sienne (`layout`) : les tailles ne sont pas les mêmes.
// ---------------------------------------------------------------------------

/** La disposition enregistrée (brute : à nettoyer avec normaliser). `data` vaut null si aucune ligne ; `erreur` non vide si la lecture échoue. */
export async function chargerLayout(userId: string): Promise<Resultat<unknown>> {
  const r = await sb.from('user_preferences').select('layout_mobile').eq('user_id', userId).maybeSingle();
  if (r.error) {
    console.error('[app/api] layout', r.error.code || '');
    return { data: null, erreur: 'Impossible de charger ta disposition.' };
  }
  return { data: (r.data as { layout_mobile?: unknown } | null)?.layout_mobile ?? null, erreur: '' };
}

/** Enregistre la disposition (déjà normalisée). N'écrit que la colonne `layout_mobile` de la ligne de l'utilisateur (jamais `layout`, celle du site). */
export async function enregistrerLayout(userId: string, layout: unknown): Promise<{ erreur: string }> {
  const r = await sb.from('user_preferences').upsert({ user_id: userId, layout_mobile: layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[app/api] layout', r.error.code || '');
    return { erreur: "Impossible d'enregistrer ta disposition." };
  }
  return { erreur: '' };
}
