// Calculs purs sur les données brutes (ni réseau ni écran, donc testables).
// Port de app/src/lib/data/synthese.js : pour l'instant seulement ce que l'Accueil utilise.
import { familleAffichage } from '../sports/familles.ts';
import { dateIsoLocale } from '../outils/format.ts';
import type { Metrique, Prevue, Seance } from '../types.ts';

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
export function indexSemaine(dateSeance: string, aujourdhui: Date): number {
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

/** Un carré d'un jour de la semaine : plein si la séance est faite, en contour si elle est prévue. */
export interface CarreJour {
  cle: string;
  fait: boolean;
  couleur: string;
}

const MAX_CARRES = 3;

/**
 * Les carrés d'un jour : les séances faites d'abord, puis les prévues. Jusqu'à 3, un carré chacune ; au-delà, les 2 premiers et le
 * nombre de séances cachées (« +2 ») : une colonne de jour ne fait que 44 pt de large. `couleur` donne la couleur d'une famille de sport.
 */
export function carresDuJour(
  j: { seances: { id: string; sport: string }[]; prevues: { id: string; sport: string }[] },
  couleur: (famille: string) => string = (famille) => famille,
): { visibles: CarreJour[]; cachees: number } {
  const tous: CarreJour[] = [
    ...j.seances.map((s) => ({ cle: `s${s.id}`, fait: true, couleur: couleur(familleAffichage(s.sport)) })),
    ...j.prevues.map((x) => ({ cle: `p${x.id}`, fait: false, couleur: couleur(familleAffichage(x.sport)) })),
  ];
  return tous.length <= MAX_CARRES ? { visibles: tous, cachees: 0 } : { visibles: tous.slice(0, MAX_CARRES - 1), cachees: tous.length - (MAX_CARRES - 1) };
}

// ---------------------------------------------------------------------------
// Charge par semaine, condition, régularité
// ---------------------------------------------------------------------------

export interface SerieCharge {
  nom: string; // clé de sport : la couleur se choisit à l'affichage, selon le thème
  valeurs: number[];
  total: number;
}

/**
 * Charge par semaine et par sport sur les N dernières semaines (la dernière colonne = les 7 derniers jours).
 * Renvoie { etiquettes, series } prêt pour le graphique en barres empilées.
 */
export function chargeParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): { etiquettes: string[]; series: SerieCharge[] } {
  const parSport = new Map<string, number[]>();
  for (const s of seances) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const famille = familleAffichage(s.sport);
    if (!parSport.has(famille)) parSport.set(famille, new Array(nbSemaines).fill(0));
    parSport.get(famille)![nbSemaines - 1 - i] += chargeSeance(s);
  }
  const series = [...parSport.entries()]
    .map(([nom, valeurs]) => ({ nom, valeurs, total: valeurs.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  const etiquettes = Array.from({ length: nbSemaines }, (_, i) => (i === nbSemaines - 1 ? 'Auj.' : `S-${nbSemaines - 1 - i}`));
  return { etiquettes, series };
}

/** Condition (CTL) à la fin de chacune des N dernières semaines, pour tracer la courbe de forme. */
export function conditionHebdo(metriques: Metrique[], nbSemaines = 12, aujourdhui: Date = new Date()): number[] {
  if (!metriques.length) return [];
  const sorties: number[] = [];
  let derniere: number = metriques[0].ctl;
  for (let i = nbSemaines - 1; i >= 0; i--) {
    const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i * 7);
    const limite = dateIsoLocale(fin);
    const candidats = metriques.filter((m) => m.iso_date <= limite);
    if (candidats.length) derniere = candidats[candidats.length - 1].ctl;
    sorties.push(Number(derniere) || 0);
  }
  return sorties;
}

export function intensiteDeCharge(charge: number): number {
  if (charge >= 80) return 3;
  if (charge >= 40) return 2;
  return charge > 0 ? 1 : 0;
}

export interface CaseRegularite {
  famille: string | null; // sport dominant du jour (null : pas de séance, ou jour à venir)
  intensite: number; // 0 à 3
  vide: boolean; // jour à venir
  /** Pour le détail d'un jour touché (Bilan › Rythme) : sa date, son nombre de séances et sa charge. */
  iso?: string;
  seances?: number;
  charge?: number;
}

/**
 * Cases de la carte de chaleur sur `nbSemaines` semaines : 7 rangées (lundi → dimanche) × nbSemaines colonnes,
 * la dernière colonne étant la semaine en cours. Chaque case a le sport dominant du jour (celui qui a la plus grande
 * charge) et une intensité 0 à 3. Les jours à venir sont marqués `vide`.
 */
export function casesRegularite(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CaseRegularite[] {
  const parJour = new Map<string, Map<string, number>>(); // date ISO → Map(famille → charge)
  for (const s of seances) {
    const iso = String(s.start_date_local).slice(0, 10);
    const famille = familleAffichage(s.sport);
    if (!parJour.has(iso)) parJour.set(iso, new Map());
    const m = parJour.get(iso)!;
    m.set(famille, (m.get(famille) || 0) + chargeSeance(s));
  }
  const debut = lundiDe(aujourdhui);
  debut.setDate(debut.getDate() - (nbSemaines - 1) * 7);
  const aujIso = dateIsoLocale(aujourdhui);
  const cases: CaseRegularite[] = [];
  for (let rangee = 0; rangee < 7; rangee++) {
    for (let col = 0; col < nbSemaines; col++) {
      const d = new Date(debut);
      d.setDate(debut.getDate() + col * 7 + rangee);
      const iso = dateIsoLocale(d);
      if (iso > aujIso) {
        cases.push({ famille: null, intensite: 0, vide: true });
        continue;
      }
      const m = parJour.get(iso);
      if (!m) {
        cases.push({ famille: null, intensite: 0, vide: false });
        continue;
      }
      const [famille] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      cases.push({ famille, intensite: intensiteDeCharge(total), vide: false });
    }
  }
  return cases;
}

/** Nombre de jours avec au moins une séance sur les N dernières semaines (pour un résumé de régularité). */
export function joursActifs(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): number {
  const limite = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - nbSemaines * 7);
  const iso = dateIsoLocale(limite);
  return new Set(seances.filter((s) => String(s.start_date_local).slice(0, 10) > iso).map((s) => String(s.start_date_local).slice(0, 10))).size;
}

// ---------------------------------------------------------------------------
// Course à pied : prédictions, efficacité, meilleures sorties
// ---------------------------------------------------------------------------

const EST_COURSE = (s: Seance): boolean => familleAffichage(s.sport) === 'course';
const joursDepuis = (dateSeance: string, aujourdhui: Date): number => {
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return Math.floor((base.getTime() - new Date(String(dateSeance).slice(0, 10) + 'T00:00:00').getTime()) / JOUR);
};

export interface Prediction {
  cle: string;
  label: string;
  km: number;
  secondes: number;
}

/**
 * Prédictions de temps sur 5 km, 10 km et semi, par la formule de Riegel (t2 = t1 × (d2 / d1)^1,06),
 * à partir des sorties de course récentes (au moins 5 km). On garde la meilleure estimation parmi les
 * sorties dont la distance est comparable (de 0,45 à 2,2 fois la distance visée). Ce sont des moyennes de
 * sorties entières : l'estimation est donc volontairement prudente.
 */
export function predictionsCourse(seances: Seance[], aujourdhui: Date = new Date(), jours = 120): Prediction[] {
  const sorties = seances.filter(
    (s) => EST_COURSE(s) && (s.distance_km ?? 0) >= 5 && s.moving_time > 0 && joursDepuis(s.start_date_local, aujourdhui) <= jours,
  );
  const cibles = [
    { cle: '5k', label: '5 km', km: 5 },
    { cle: '10k', label: '10 km', km: 10 },
    { cle: 'semi', label: 'Semi', km: 21.0975 },
  ];
  const resultats: Prediction[] = [];
  for (const c of cibles) {
    let meilleur: number | null = null;
    for (const s of sorties) {
      const d = Number(s.distance_km);
      if (d < c.km * 0.45 || d > c.km * 2.2) continue;
      const estimation = s.moving_time * Math.pow(c.km / d, 1.06);
      if (meilleur === null || estimation < meilleur) meilleur = estimation;
    }
    if (meilleur !== null) resultats.push({ ...c, secondes: Math.round(meilleur) });
  }
  return resultats;
}

export interface Efficacite {
  points: { semaine: number; allure: number }[]; // allure en secondes par km, de la plus ancienne à la plus récente
  amelioration: number; // gain en pourcentage entre la première et la dernière semaine
  allureActuelle: number;
}

/**
 * Efficacité : allure moyenne des sorties « faciles » (cardio entre 60 et 80 % de la FC max) semaine par
 * semaine. Si l'allure baisse à cardio égal, la condition progresse. Renvoie null s'il y a moins de 3 semaines
 * exploitables.
 */
export function efficaciteCourse(seances: Seance[], hrMax: number | null, nbSemaines = 12, aujourdhui: Date = new Date()): Efficacite | null {
  const bas = hrMax ? hrMax * 0.6 : 125;
  const haut = hrMax ? hrMax * 0.8 : 155;
  const semaines = new Map<number, { temps: number; km: number }>(); // indice de semaine (0 = ancienne)
  for (const s of seances) {
    if (!EST_COURSE(s) || !((s.distance_km ?? 0) >= 3) || !(s.moving_time > 0)) continue;
    const fc = s.avg_heartrate;
    if (!fc || fc < bas || fc > haut) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const cle = nbSemaines - 1 - i;
    const m = semaines.get(cle) || { temps: 0, km: 0 };
    m.temps += s.moving_time;
    m.km += Number(s.distance_km);
    semaines.set(cle, m);
  }
  const points = [...semaines.entries()].sort((a, b) => a[0] - b[0]).map(([semaine, m]) => ({ semaine, allure: m.temps / m.km }));
  if (points.length < 3) return null;
  const premiere = points[0].allure;
  const derniere = points[points.length - 1].allure;
  return { points, amelioration: Math.round(((premiere - derniere) / premiere) * 1000) / 10, allureActuelle: derniere };
}

export interface MeilleureSortie<V> {
  id: string;
  nom: string | null;
  date: string;
  valeur: V;
}

/** Meilleures sorties de course sur la période chargée : la plus longue, la plus rapide ≥ 5 km et ≥ 10 km. */
export function meilleuresSortiesCourse(seances: Seance[]): {
  plusLongue: MeilleureSortie<{ km: number; secondes: number }> | null;
  rapide5: MeilleureSortie<{ km: number; allure: number }> | null;
  rapide10: MeilleureSortie<{ km: number; allure: number }> | null;
} {
  const courses = seances.filter((s) => EST_COURSE(s) && (s.distance_km ?? 0) > 0 && s.moving_time > 0);
  const allure = (s: Seance) => s.moving_time / Number(s.distance_km);
  const meilleur = (liste: Seance[], cle: (s: Seance) => number): Seance | null => (liste.length ? liste.reduce((a, b) => (cle(b) < cle(a) ? b : a)) : null);
  const resume = <V,>(s: Seance | null, valeur: V): MeilleureSortie<V> | null => (s ? { id: s.id, nom: s.name, date: String(s.start_date_local).slice(0, 10), valeur } : null);
  const plusLongue = meilleur(courses, (s) => -Number(s.distance_km));
  const rapide5 = meilleur(courses.filter((s) => (s.distance_km ?? 0) >= 5), allure);
  const rapide10 = meilleur(courses.filter((s) => (s.distance_km ?? 0) >= 10), allure);
  return {
    plusLongue: resume(plusLongue, plusLongue && { km: Number(plusLongue.distance_km), secondes: plusLongue.moving_time }) as MeilleureSortie<{ km: number; secondes: number }> | null,
    rapide5: resume(rapide5, rapide5 && { km: Number(rapide5.distance_km), allure: allure(rapide5) }) as MeilleureSortie<{ km: number; allure: number }> | null,
    rapide10: resume(rapide10, rapide10 && { km: Number(rapide10.distance_km), allure: allure(rapide10) }) as MeilleureSortie<{ km: number; allure: number }> | null,
  };
}

// ---------------------------------------------------------------------------
// Force : régularité des séances de musculation
// ---------------------------------------------------------------------------

/**
 * Nombre de séances de force par semaine sur N semaines, et série de semaines consécutives avec au moins
 * une séance (la semaine en cours ne casse pas la série tant qu'elle n'est pas terminée).
 */
export function seancesForce(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): { parSemaine: number[]; serie: number; total: number; moyenne: number } {
  const parSemaine: number[] = new Array(nbSemaines).fill(0);
  for (const s of seances) {
    if (familleAffichage(s.sport) !== 'muscu') continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    parSemaine[nbSemaines - 1 - i] += 1;
  }
  let serie = 0;
  let i = nbSemaines - 1;
  if (parSemaine[i] === 0) i--; // semaine en cours encore vide : on ne casse pas la série
  for (; i >= 0 && parSemaine[i] > 0; i--) serie++;
  const total = parSemaine.reduce((a, b) => a + b, 0);
  return { parSemaine, serie, total, moyenne: Math.round((total / nbSemaines) * 10) / 10 };
}
