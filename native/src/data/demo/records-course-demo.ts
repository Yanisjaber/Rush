// Les records de la course en démo, calculés sur les streams des courses d'exemple (courbes-demo.ts) : mêmes lignes que la fonction SQL rpc_courbe_course et rpc_piliers_course.
import type { LignePiliersCourse } from '../bilan/piliers-course.ts';
import type { LigneCourbeCourse } from '../bilan/records-course.ts';
import type { Seance } from '../types.ts';
import { courbesCourse, type CourbesCourse } from './courbes-demo.ts';
import { activitesBilanDemo } from './demo.ts';

const COURSES = new Set(['Run', 'TrailRun', 'VirtualRun']);

function coursesDemo(maintenant: Date): Seance[] {
  return activitesBilanDemo(maintenant).filter((l) => COURSES.has(l.sport));
}

/** Pour un signal serveur (pace : meilleur temps par distance, dis : meilleure distance par durée, fc : meilleure FC par durée), les meilleures courses (rang 1 à n) de chaque point. */
export function lignesCourbeCourseDemo(maintenant: Date, signal: 'pace' | 'dis' | 'fc', annee?: number, cle?: number, n = 3): LigneCourbeCourse[] {
  const candidates = coursesDemo(maintenant).filter((s) => annee == null || s.start_date_local.startsWith(`${annee}-`));
  const parCourse = candidates.map((s) => ({ s, c: (courbesCourse(s)[signal] ?? {}) as Record<string, number> }));
  const cles = new Set<number>();
  for (const { c } of parCourse) for (const k of Object.keys(c)) cles.add(Number(k));
  const lignes: LigneCourbeCourse[] = [];
  for (const k of [...cles].filter((x) => cle == null || x === cle)) {
    const valides = parCourse.filter(({ c }) => c[String(k)] != null);
    // Le meilleur temps est le plus petit ; la meilleure distance et la meilleure FC sont les plus grandes
    valides.sort((a, b) => (signal === 'pace' ? a.c[String(k)] - b.c[String(k)] : b.c[String(k)] - a.c[String(k)]));
    valides.slice(0, n).forEach(({ s, c }, i) => lignes.push({ cle: k, rang: i + 1, valeur: c[String(k)], activity_id: s.id, name: s.name, start_date_local: s.start_date_local }));
  }
  return lignes;
}

/** Les mesures par année du niveau global de la course : meilleurs temps sur 1, 5 et 10 km, meilleures distances en 5 et 60 minutes. */
export function piliersCourseDemo(maintenant: Date): LignePiliersCourse[] {
  const parAn = new Map<number, CourbesCourse[]>();
  for (const s of coursesDemo(maintenant)) {
    const an = Number(s.start_date_local.slice(0, 4));
    parAn.set(an, [...(parAn.get(an) ?? []), courbesCourse(s)]);
  }
  const mini = (cs: CourbesCourse[], sig: 'pace' | 'dis', k: number, plusGrand: boolean): number | null => {
    const v = cs.map((c) => c[sig]?.[String(k)]).filter((x): x is number => x != null);
    return v.length ? (plusGrand ? Math.max(...v) : Math.min(...v)) : null;
  };
  return [...parAn].sort((a, b) => a[0] - b[0]).map(([an, cs]) => ({
    an, t1000: mini(cs, 'pace', 1000, false), t5000: mini(cs, 'pace', 5000, false), t10000: mini(cs, 'pace', 10000, false),
    d300: mini(cs, 'dis', 300, true), d3600: mini(cs, 'dis', 3600, true), nCourbes: cs.length,
  }));
}
