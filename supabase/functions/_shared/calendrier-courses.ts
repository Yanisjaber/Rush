// ============================================================
// Le calendrier de courses de la personne, VU EN ENTIER (pas un cas par cas : une, deux, quatre courses dans la journée, trois jours de suite, une saison…).
//
// Idée : plusieurs courses qui tombent le même jour ou sur des jours qui se suivent forment un BLOC DE COMPÉTITION (entre elles, il n'y a rien à entraîner).
// Autour de chaque bloc, le plan applique des règles qui ne dépendent ni du nombre de courses ni de leur ordre :
//   - avant la CIBLE (le bloc visé) : le plan s'arrête la veille du bloc et finit par l'affûtage (plan-course.ts) ;
//   - les blocs plus tôt dans le plan sont des étapes : leur jour est bloqué, la veille est sans séance dure (validateur), et ils sont suivis de jours FACILES (récupération) ;
//   - les blocs après la cible ne sont pas planifiés ici : le coach le dit, le plan se refait après la cible.
// Les durées de récupération viennent de la fiche course-periodisation-recuperation (docs/ia/connaissances) : « après un 10 km : 2 à 5 jours faciles ; après un marathon : 1 à 2 semaines (7 à 14 jours) ».
// On prend le MILIEU de ces fourchettes (3 jours jusqu'à 10 km, 10 jours à partir d'un marathon) et on interpole entre les deux. Pour un bloc de plusieurs courses, la distance est la SOMME des distances.
// Ce sont des CONVENTIONS d'échelle tirées d'une fourchette de terrain, pas des résultats d'études ; et AUCUNE étude n'existe sur l'enchaînement de plusieurs courses le même jour (recherche du 12 nov. 2026).
// ============================================================
import { ajouterJours, ecartJours } from './dates-iso.ts';

export type Priorite = 'A' | 'B' | 'C';
export interface Course { date: string; km: number | null; heure: string | null; priorite: Priorite | null; tempsCibleMin: number | null }
export interface Bloc { debut: string; fin: string; courses: Course[]; kmTotal: number }

const RANG: Record<string, number> = { A: 0, B: 1, C: 2 };
const rang = (c: Course): number => RANG[c.priorite ?? ''] ?? 3;
const minutesDe = (h: string | null): number => { const m = /^(\d{2}):(\d{2})$/.exec(h ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const nombreFr = (x: number): string => String(Math.round(x * 100) / 100).replace('.', ',');

/** Les courses lues dans le résumé (champs inconnus ou bizarres = null) */
// deno-lint-ignore no-explicit-any
export function coursesDepuisResume(competitions: any): Course[] {
  if (!Array.isArray(competitions)) return [];
  return competitions
    // deno-lint-ignore no-explicit-any
    .filter((c: any) => c && c.sport === 'course' && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
    // deno-lint-ignore no-explicit-any
    .map((c: any): Course => ({
      date: c.date,
      km: typeof c.km === 'number' && c.km > 0 ? c.km : null,
      heure: typeof c.heure === 'string' && /^\d{2}:\d{2}$/.test(c.heure) ? c.heure : null,
      priorite: c.priorite === 'A' || c.priorite === 'B' || c.priorite === 'C' ? c.priorite : null,
      tempsCibleMin: typeof c.temps_cible_min === 'number' && c.temps_cible_min > 0 ? c.temps_cible_min : null,
    }));
}

/** Les blocs : des courses le même jour ou à un jour d'écart au plus ne laissent aucune place à un entraînement entre elles */
export function formerBlocs(courses: Course[]): Bloc[] {
  const tri = [...courses].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : minutesDe(a.heure) - minutesDe(b.heure)));
  const blocs: Bloc[] = [];
  for (const c of tri) {
    const dernier = blocs[blocs.length - 1];
    if (dernier && ecartJours(dernier.fin, c.date) <= 1) {
      dernier.courses.push(c);
      dernier.fin = c.date;
      dernier.kmTotal += c.km ?? 0;
    } else {
      blocs.push({ debut: c.date, fin: c.date, courses: [c], kmTotal: c.km ?? 0 });
    }
  }
  return blocs;
}

/** Jours faciles après un bloc : 3 jusqu'à 10 km, 10 à partir de 42,195 km, interpolé entre les deux (milieu des fourchettes 2-5 jours et 7-14 jours de la fiche). Distance inconnue = 10 km. */
export function joursRecuperation(kmTotal: number): number {
  const km = kmTotal > 0 ? kmTotal : 10;
  if (km <= 10) return 3;
  if (km >= 42.195) return 10;
  return Math.round(3 + ((km - 10) * 7) / (42.195 - 10));
}

export function libelleCourse(c: Course): string {
  return `${c.km ? `${nombreFr(c.km)} km` : 'une course'}${c.heure ? ` à ${c.heure}` : ''}${c.priorite ? ` (priorité ${c.priorite})` : ''}`;
}
const dateCourte = (iso: string): string => { const [, m, j] = iso.split('-'); return `${Number(j)}/${Number(m)}`; };
export function libelleBloc(b: Bloc): string {
  const quand = b.debut === b.fin ? `le ${dateCourte(b.debut)}` : `du ${dateCourte(b.debut)} au ${dateCourte(b.fin)}`;
  return `${quand} : ${b.courses.map(libelleCourse).join(', puis ')}`;
}

export interface AnalyseCalendrier {
  /** Le bloc visé par le plan (ou un bloc vide à la date demandée, si elle n'est pas au calendrier) */
  cible: Bloc;
  /** La course qui sert de référence pour les allures et le temps visé (null si la date demandée n'est pas au calendrier) */
  reference: Course | null;
  /** Les blocs plus tôt que la cible : des étapes du plan */
  avant: Bloc[];
  /** Les blocs après la cible : pas planifiés maintenant */
  apres: Bloc[];
  /** Ce que le coach doit savoir et dire, écrit par le code */
  note: string;
}

/**
 * Choisit la cible et la référence, sans jamais bloquer pour demander :
 *   - la cible : le bloc qui contient la date demandée ; sinon le premier bloc qui contient une course de priorité A ; sinon le premier bloc ;
 *   - la référence (allures, temps visé) dans le bloc : la distance demandée (à 0,6 km près), sinon la meilleure priorité, sinon une course qui a un temps visé, sinon la plus longue.
 * La note dit ce qui a été choisi, pour que le coach puisse le confirmer ou le corriger avec la personne.
 */
export function analyserCalendrier(courses: Course[], o: { aujourdhui: string; dateDemandee?: string | null; kmDemande?: number | null }): AnalyseCalendrier | null {
  const blocs = formerBlocs(courses.filter((c) => c.date > o.aujourdhui));
  let cible: Bloc | undefined;
  if (o.dateDemandee) cible = blocs.find((b) => b.debut <= o.dateDemandee! && o.dateDemandee! <= b.fin);
  else cible = blocs.find((b) => b.courses.some((c) => c.priorite === 'A')) ?? blocs[0];
  if (!cible && !o.dateDemandee) return null;
  const bloc: Bloc = cible ?? { debut: o.dateDemandee!, fin: o.dateDemandee!, courses: [], kmTotal: 0 };

  let reference: Course | null = null;
  if (bloc.courses.length) {
    if (o.kmDemande && o.kmDemande > 0) reference = bloc.courses.find((c) => c.km != null && Math.abs(c.km - o.kmDemande!) <= 0.6) ?? null;
    if (!reference) {
      const meilleur = Math.min(...bloc.courses.map(rang));
      const pretendantes = bloc.courses.filter((c) => rang(c) === meilleur);
      reference = [...pretendantes].sort((a, b) => (b.tempsCibleMin ? 1 : 0) - (a.tempsCibleMin ? 1 : 0) || (b.km ?? 0) - (a.km ?? 0))[0];
    }
  }
  const avant = blocs.filter((b) => b.fin < bloc.debut);
  const apres = blocs.filter((b) => b.debut > bloc.fin);

  const lignes: string[] = [];
  if (bloc.courses.length > 1) {
    lignes.push(`BLOC DE COMPÉTITION visé : ${libelleBloc(bloc)}. Le plan s'arrête la veille du ${dateCourte(bloc.debut)} et finit par l'affûtage. ${reference ? `Les allures et le temps visé sont calés sur ${libelleCourse(reference)}. Dis-le à l'utilisateur et demande-lui si c'est bien celle qui compte le plus.` : ''}`);
  }
  if (avant.length) {
    lignes.push(`Étapes DÉJÀ au calendrier avant la cible, dont le plan tient compte : ${avant.map((b) => `${libelleBloc(b)} → ${joursRecuperation(b.kmTotal)} jours faciles ensuite`).join(' ; ')}.`);
  }
  if (apres.length) {
    lignes.push(`Courses APRÈS la cible, pas planifiées maintenant : ${apres.map(libelleBloc).join(' ; ')}. Dis qu'on refera le plan pour la suite après la cible, avec la récupération (${joursRecuperation(bloc.kmTotal)} jours faciles après le bloc visé).`);
  }
  if (bloc.courses.length > 1 || avant.length || apres.length) {
    lignes.push("Les jours de récupération viennent des fiches de terrain (après un 10 km : 2 à 5 jours faciles ; après un marathon : 7 à 14 jours), on prend le milieu ; pour plusieurs courses d'un même bloc, on additionne les distances. Aucune étude n'existe sur l'enchaînement de plusieurs courses le même jour ou sur des jours qui se suivent : tu n'inventes AUCUN chiffre (récupération entre deux départs, allure de chaque course…), tu restes général et honnête, et tu demandes à la personne l'enjeu de chaque course (à fond, ou en préparation) si le calendrier ne le dit pas.");
  }
  return { cible: bloc, reference, avant, apres, note: lignes.join(' ') };
}
