// Triathlon et duathlon : le temps réparti entre les disciplines, la dernière séance de chacune, les enchaînements (bricks), les repères de niveau.
// Calculs purs, sans écran (testés dans tests/triathlon.test.ts). Le triathlon enchaîne natation, vélo, course ; le duathlon course, vélo (course à pied, vélo, course à pied).
import { familleAffichage } from './familles.ts';
import { joursAvant } from './format.ts';
import { cumulParSemaine } from './hebdo.ts';
import { allureNatation } from './natation.ts';
import { indexSemaine } from './synthese.ts';
import type { PointPuissance, Seance } from './types.ts';

export type Discipline = 'natation' | 'velo' | 'course';

/** Les disciplines d'un onglet : le duathlon n'a pas de natation. */
export function disciplinesDe(filtre: string): Discipline[] {
  return filtre === 'duathlon' ? ['course', 'velo'] : ['natation', 'velo', 'course'];
}

/** La discipline d'une séance (le trail compte comme de la course, le VTT comme du vélo), ou null pour tout autre sport. */
export function disciplineDe(s: Pick<Seance, 'sport'>): Discipline | null {
  const f = familleAffichage(s.sport);
  return f === 'natation' || f === 'velo' || f === 'course' ? f : null;
}

const ensemble = (seances: Seance[], disciplines: Discipline[]): Seance[] =>
  seances.filter((s) => s.moving_time > 0 && disciplines.includes(disciplineDe(s) as Discipline));

export interface PartDiscipline {
  cle: Discipline;
  /** Temps passé, en secondes. */
  temps: number;
  /** Part du temps total, en % (entier). */
  pct: number;
}

export interface Repartition {
  parts: PartDiscipline[];
  /** Temps total, en secondes. */
  total: number;
}

/** Le temps passé dans chaque discipline sur les `nbSemaines` dernières semaines. Null sans séance. */
export function repartitionDisciplines(seances: Seance[], disciplines: Discipline[], nbSemaines = 4, aujourdhui: Date = new Date()): Repartition | null {
  const temps = new Map<Discipline, number>(disciplines.map((d) => [d, 0]));
  for (const s of ensemble(seances, disciplines)) {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const d = disciplineDe(s) as Discipline;
    temps.set(d, (temps.get(d) ?? 0) + s.moving_time);
  }
  const total = [...temps.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return { parts: disciplines.map((cle) => ({ cle, temps: temps.get(cle) ?? 0, pct: Math.round(((temps.get(cle) ?? 0) / total) * 100) })), total };
}

export interface SerieDiscipline {
  cle: Discipline;
  /** Minutes par semaine glissante, de la plus ancienne à la plus récente. */
  minutes: number[];
}

/** Le temps de chaque discipline semaine après semaine (en minutes), pour un graphique empilé. */
export function minutesParSemaine(seances: Seance[], disciplines: Discipline[], nbSemaines = 8, aujourdhui: Date = new Date()): SerieDiscipline[] {
  return disciplines.map((cle) => ({
    cle,
    minutes: cumulParSemaine(seances, (s) => disciplineDe(s) === cle && s.moving_time > 0, (s) => s.moving_time / 60, nbSemaines, aujourdhui, 0).parSemaine,
  }));
}

export interface DerniereSeance {
  cle: Discipline;
  /** Jours depuis la dernière séance de la discipline (0 = aujourd'hui) ; null si elle n'en a aucune. */
  jours: number | null;
  nom: string | null;
  date: string | null;
}

/** La dernière séance de chaque discipline : pour ne pas laisser la natation s'éloigner sans s'en apercevoir. */
export function dernieresParDiscipline(seances: Seance[], disciplines: Discipline[], aujourdhui: Date = new Date()): DerniereSeance[] {
  return disciplines.map((cle) => {
    const s = seances
      .filter((x) => disciplineDe(x) === cle && x.moving_time > 0 && joursAvant(String(x.start_date_local), aujourdhui) <= 0)
      .sort((a, b) => String(b.start_date_local).localeCompare(String(a.start_date_local)))[0];
    return s ? { cle, jours: Math.max(0, -joursAvant(String(s.start_date_local), aujourdhui)), nom: s.name, date: String(s.start_date_local).slice(0, 10) } : { cle, jours: null, nom: null, date: null };
  });
}

export interface Brick {
  date: string;
  /** « velo-course » : le vélo d'abord (triathlon) ; « course-velo » : la course d'abord (duathlon). */
  ordre: 'velo-course' | 'course-velo';
  velo: Seance;
  course: Seance;
  /** Minutes entre la fin de la première séance et le début de la suivante. */
  pauseMin: number;
}

export interface Bricks {
  /** Du plus récent au plus ancien. */
  liste: Brick[];
  total: number;
  /** Ceux des 4 dernières semaines. */
  quatreSemaines: number;
}

const minuteDuJour = (iso: string): number => {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

/**
 * Les enchaînements : un vélo et une course le même jour, la deuxième séance commençant au plus `pauseMaxMin` minutes après la fin de la première
 * (on tolère 5 minutes de chevauchement : les heures de départ sont arrondies). Chaque séance ne sert qu'une fois.
 */
export function bricks(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date(), pauseMaxMin = 90): Bricks {
  const dansPeriode = ensemble(seances, ['velo', 'course']).filter((s) => {
    const i = indexSemaine(s.start_date_local, aujourdhui);
    return i >= 0 && i < nbSemaines;
  });
  const parJour = new Map<string, Seance[]>();
  for (const s of dansPeriode) {
    const j = String(s.start_date_local).slice(0, 10);
    parJour.set(j, [...(parJour.get(j) ?? []), s]);
  }
  const liste: Brick[] = [];
  for (const [date, seancesDuJour] of parJour) {
    const triees = [...seancesDuJour].sort((a, b) => minuteDuJour(a.start_date_local) - minuteDuJour(b.start_date_local));
    const utilisees = new Set<string>();
    for (let i = 0; i < triees.length; i++) {
      const a = triees[i];
      if (utilisees.has(a.id)) continue;
      const finA = minuteDuJour(a.start_date_local) + a.moving_time / 60;
      const b = triees.slice(i + 1).find((x) => !utilisees.has(x.id) && disciplineDe(x) !== disciplineDe(a) && minuteDuJour(x.start_date_local) - finA >= -5 && minuteDuJour(x.start_date_local) - finA <= pauseMaxMin);
      if (!b) continue;
      utilisees.add(a.id);
      utilisees.add(b.id);
      const vAvant = disciplineDe(a) === 'velo';
      liste.push({ date, ordre: vAvant ? 'velo-course' : 'course-velo', velo: vAvant ? a : b, course: vAvant ? b : a, pauseMin: Math.max(0, Math.round(minuteDuJour(b.start_date_local) - finA)) });
    }
  }
  liste.sort((x, y) => y.date.localeCompare(x.date));
  return { liste, total: liste.length, quatreSemaines: liste.filter((b) => joursAvant(b.date, aujourdhui) >= -27).length };
}

/** Le nombre d'enchaînements par semaine glissante, de la plus ancienne à la plus récente. */
export function bricksParSemaine(liste: Brick[], nbSemaines = 12, aujourdhui: Date = new Date()): number[] {
  const n: number[] = new Array(nbSemaines).fill(0);
  for (const b of liste) {
    const i = indexSemaine(`${b.date}T12:00:00`, aujourdhui);
    if (i >= 0 && i < nbSemaines) n[nbSemaines - 1 - i] += 1;
  }
  return n;
}

export interface Repere {
  cle: Discipline;
  /** Natation : secondes pour 100 m ; course : secondes par km ; vélo : watts sur 20 minutes (null sans courbe de puissance : on donne la vitesse). */
  valeur: number | null;
  /** Vélo sans puissance : la vitesse moyenne des 4 dernières semaines, en km/h. */
  vitesseKmh?: number | null;
  /** Évolution par rapport aux 4 semaines d'avant, en % : pour la natation et la course, négatif = plus rapide. Null sans comparaison. */
  evolutionPct: number | null;
  /** Vélo : ta meilleure puissance de 20 minutes de toute ta vie, pour situer la forme du moment. */
  record?: number | null;
}

/** Allure moyenne de course (secondes par km) sur les 4 dernières semaines et sur les 4 d'avant. */
export function allureCourse4Semaines(seances: Seance[], aujourdhui: Date = new Date()): { actuelle: number | null; precedente: number | null; evolutionPct: number | null } {
  const cumul = [{ temps: 0, km: 0 }, { temps: 0, km: 0 }];
  for (const s of seances) {
    if (disciplineDe(s) !== 'course' || !(s.moving_time > 0) || !(Number(s.distance_km) >= 1)) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= 8) continue;
    const c = cumul[i < 4 ? 0 : 1];
    c.temps += s.moving_time;
    c.km += Number(s.distance_km);
  }
  const allure = (c: { temps: number; km: number }) => (c.km > 0 ? Math.round(c.temps / c.km) : null);
  const actuelle = allure(cumul[0]);
  const precedente = allure(cumul[1]);
  return { actuelle, precedente, evolutionPct: actuelle && precedente ? Math.round(((actuelle - precedente) / precedente) * 1000) / 10 : null };
}

/** Vitesse moyenne à vélo (km/h) sur les 4 dernières semaines. */
export function vitesseVelo4Semaines(seances: Seance[], aujourdhui: Date = new Date()): number | null {
  let temps = 0;
  let km = 0;
  for (const s of seances) {
    if (disciplineDe(s) !== 'velo' || !(s.moving_time > 0) || !(Number(s.distance_km) > 0)) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= 4) continue;
    temps += s.moving_time;
    km += Number(s.distance_km);
  }
  return temps > 0 ? Math.round((km / (temps / 3600)) * 10) / 10 : null;
}

/** Un repère de niveau par discipline : l'allure en natation, les watts de 20 minutes (ou la vitesse) à vélo, l'allure en course. */
export function reperesDisciplines(seances: Seance[], puissance: PointPuissance[], disciplines: Discipline[], aujourdhui: Date = new Date()): Repere[] {
  return disciplines.map((cle): Repere => {
    if (cle === 'natation') {
      const a = allureNatation(seances, aujourdhui);
      return { cle, valeur: a.actuelle, evolutionPct: a.evolutionPct };
    }
    if (cle === 'velo') {
      const p20 = (puissance ?? []).find((p) => p.duration_s === 1200);
      const watts = p20 && p20.watts_90d > 0 ? p20.watts_90d : null;
      return { cle, valeur: watts, vitesseKmh: watts ? null : vitesseVelo4Semaines(seances, aujourdhui), evolutionPct: null, record: p20 && p20.watts_alltime > 0 ? p20.watts_alltime : null };
    }
    const c = allureCourse4Semaines(seances, aujourdhui);
    return { cle, valeur: c.actuelle, evolutionPct: c.evolutionPct };
  });
}
