// Calculs purs sur les données brutes (ni réseau ni écran, donc testables).
// Port de app/src/lib/data/synthese.js : pour l'instant seulement ce que l'Accueil utilise.
import { familleAffichage } from './familles.ts';
import { dateIsoLocale } from './format.ts';
import type { Metrique, Prevue, Seance } from './types.ts';

const JOUR = 86400000;

/**
 * Charge d'une séance, en « points ». Principe : une charge universelle, comparable d'un sport
 * à l'autre. Le TSS enregistré s'il existe ; sinon une estimation simple à partir de la durée
 * (un peu plus élevée si le cardio est connu).
 */
export function chargeSeance(s: Pick<Seance, 'tss' | 'moving_time' | 'avg_heartrate'>): number {
  if (typeof s.tss === 'number' && s.tss > 0) return s.tss;
  const heures = (s.moving_time || 0) / 3600;
  return Math.round(heures * (s.avg_heartrate ? 45 : 35));
}

/**
 * Les prochaines séances prévues (aujourd'hui compris), de la plus proche à la plus lointaine.
 * Les compétitions n'en font pas partie : elles ont leur dossard d'objectif.
 */
export function prochainesPrevues(planifiees: Prevue[] | null | undefined, aujourdhui: Date = new Date(), limite = 3): Prevue[] {
  const aujIso = dateIsoLocale(aujourdhui);
  return (planifiees || [])
    .filter((p) => p.category !== 'competition' && String(p.date).slice(0, 10) >= aujIso)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, limite);
}

/** Numéro de la semaine glissante d'une séance : 0 = les 7 derniers jours, 1 = la semaine d'avant… */
function indexSemaine(dateSeance: string, aujourdhui: Date): number {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const d = new Date(String(dateSeance).slice(0, 10) + 'T00:00:00');
  const jours = Math.floor((base.getTime() - d.getTime()) / JOUR);
  return Math.floor(jours / 7);
}

export interface Forme {
  ctl: number; // condition (forme de fond)
  atl: number; // fatigue
  tsb: number; // fraîcheur = condition − fatigue
  libelle: string;
}

/** Dernière forme connue : { ctl, atl, tsb, libelle }. */
export function formeActuelle(metriques: Metrique[]): Forme | null {
  if (!metriques.length) return null;
  const m = metriques[metriques.length - 1];
  const tsb = Number(m.tsb) || 0;
  let libelle = 'Équilibré';
  if (tsb >= 15) libelle = 'Très frais';
  else if (tsb >= 5) libelle = 'Frais';
  else if (tsb <= -30) libelle = 'Très fatigué';
  else if (tsb <= -10) libelle = 'Fatigué';
  return { ctl: Math.round(Number(m.ctl) || 0), atl: Math.round(Number(m.atl) || 0), tsb: Math.round(tsb), libelle };
}

export interface SegmentVolume {
  famille: string; // clé de sport (course, velo…) : la couleur se choisit à l'affichage, selon le thème
  secondes: number;
}

/** Temps passé sur chaque sport pendant les 7 derniers jours, du plus long au plus court. */
export function repartition7Jours(seances: Seance[], aujourdhui: Date = new Date()): { segments: SegmentVolume[]; totalSecondes: number } {
  const parSport = new Map<string, number>();
  let total = 0;
  for (const s of seances) {
    if (indexSemaine(s.start_date_local, aujourdhui) !== 0) continue;
    const famille = familleAffichage(s.sport);
    const t = s.moving_time || 0;
    parSport.set(famille, (parSport.get(famille) || 0) + t);
    total += t;
  }
  const segments = [...parSport.entries()].map(([famille, secondes]) => ({ famille, secondes })).sort((a, b) => b.secondes - a.secondes);
  return { segments, totalSecondes: total };
}

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Lundi (à midi) de la semaine qui contient `d`. */
function lundiDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const decalage = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - decalage);
  return x;
}

export interface JourSemaine {
  iso: string;
  jour: string; // « Lun »…
  num: number; // jour du mois
  aujourdhui: boolean;
  futur: boolean;
  seances: Seance[];
  prevues: Prevue[];
}

/** Les 7 jours de la semaine en cours (du lundi au dimanche), avec les séances faites et prévues. */
export function semaineCourante(seances: Seance[], aujourdhui: Date = new Date(), prevues: Prevue[] = []): JourSemaine[] {
  const lundi = lundiDe(aujourdhui);
  const aujIso = dateIsoLocale(aujourdhui);
  return JOURS_COURTS.map((jour, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    const iso = dateIsoLocale(d);
    return {
      iso,
      jour,
      num: d.getDate(),
      aujourdhui: iso === aujIso,
      futur: iso > aujIso,
      seances: seances.filter((s) => String(s.start_date_local).slice(0, 10) === iso),
      // séances prévues à partir d'aujourd'hui (une séance prévue dans le passé n'est plus « à venir »)
      prevues: iso >= aujIso ? prevues.filter((p) => String(p.date).slice(0, 10) === iso) : [],
    };
  });
}
