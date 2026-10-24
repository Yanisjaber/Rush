// Modèles de séance (table activity_template) : des séances types qu'on pose sur un jour. Fonctions pures, sans écran ni réseau. Port de app/src/lib/data/modeles.js.
import { FAMILLES_PRINCIPALES } from './catalogue-sports.ts';
import { cleDuType, estimerTss, SPORTS_AJOUT, typeDeCle, type LignePrevue } from './ajouts.ts';
import { metriquesDuSport, normaliser, resume, type Bloc, type Reference } from './structure.ts';

export interface Modele {
  id: string;
  /** Catégorie de regroupement (cyclisme, course, natation, musculation, triathlon, autre). */
  sport: string;
  /** Le type brut du sport (Run, Ride…), quand il est connu. */
  sport_raw: string | null;
  name: string;
  duration_min: number | null;
  tss: number | null;
  description: string | null;
  rpe: number | null;
  distance_km: number | null;
  dplus: number | null;
  structure: unknown;
}

const CATEGORIE_VERS_CLE: Record<string, string> = { cyclisme: 'velo', vtt: 'velo', course: 'course', trail: 'course', natation: 'natation', musculation: 'muscu', triathlon: 'triathlon' };

/** La clé de sport (course, velo…) d'un modèle : son type brut s'il est connu, sinon sa catégorie. */
export function cleDuModele(m: Pick<Modele, 'sport' | 'sport_raw'>): string {
  if (m.sport_raw && SPORTS_AJOUT.some((s) => s.type === m.sport_raw)) return cleDuType(m.sport_raw);
  return CATEGORIE_VERS_CLE[m.sport] ?? 'autre';
}

const sansAccent = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Les modèles dont le nom ou la description contient la recherche, et qui sont du sport choisi (« tous » : tous), triés par nom. */
export function filtrerModeles(modeles: Modele[], recherche = '', cle = 'tous'): Modele[] {
  const q = sansAccent(recherche).trim();
  return modeles
    .filter((m) => cle === 'tous' || cleDuModele(m) === cle)
    .filter((m) => !q || sansAccent(`${m.name} ${m.description ?? ''}`).includes(q))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
}

/** Les sports présents dans les modèles, dans l'ordre de la liste des sports (pour les pastilles de filtre). */
export const sportsDesModeles = (modeles: Modele[]): string[] => {
  const presents = new Set(modeles.map(cleDuModele));
  return [...FAMILLES_PRINCIPALES, 'autre'].filter((c) => presents.has(c));
};

/** Les blocs d'un modèle, nettoyés (jamais de valeur absurde venue de la base). */
export const blocsDuModele = (m: Pick<Modele, 'structure' | 'sport' | 'sport_raw'>): Bloc[] => normaliser(m.structure, metriquesDuSport(m.sport_raw ?? typeDeCle(cleDuModele(m as Modele)))[0]);

/** Résumé d'une ligne de modèle : « 55 min · 48 pts · 40 km · par blocs ». */
export function resumeModele(m: Modele): string {
  const morceaux: string[] = [];
  if (m.duration_min) morceaux.push(`${m.duration_min} min`);
  if (m.tss) morceaux.push(`${m.tss} pts`);
  if (m.distance_km) morceaux.push(`${String(m.distance_km).replace('.', ',')} km`);
  if (Array.isArray(m.structure) && m.structure.length) morceaux.push('par blocs');
  return morceaux.join(' · ');
}

/**
 * La ligne à écrire dans activity_planned pour poser un modèle sur un jour (sans user_id). Les blocs sont nettoyés ; la durée et la charge viennent des blocs
 * quand il y en a, sinon du modèle, sinon d'une estimation (60 min).
 */
export function lignePrevueDepuisModele(m: Modele, date: string, heure = '12:00', ref: Reference = {}): LignePrevue {
  const type = m.sport_raw && SPORTS_AJOUT.some((s) => s.type === m.sport_raw) ? m.sport_raw : typeDeCle(cleDuModele(m));
  const blocs = blocsDuModele({ structure: m.structure, sport: m.sport, sport_raw: type });
  const calcul = blocs.length ? resume(blocs, ref, type) : null;
  const duree = Math.min(1440, Math.max(1, Math.round(calcul ? calcul.dureeMin : Number(m.duration_min) > 0 ? Number(m.duration_min) : 60)));
  return {
    category: 'entrainement',
    name: String(m.name || 'Séance').slice(0, 120),
    date,
    start_date_local: `${date}T${heure}:00`,
    sport: type,
    duration: duree,
    tss: calcul ? calcul.tss : Number(m.tss) > 0 ? Number(m.tss) : estimerTss(duree, Number(m.rpe) >= 1 && Number(m.rpe) <= 10 ? Number(m.rpe) : 5),
    rpe: null,
    km: Number(m.distance_km) > 0 ? Number(m.distance_km) : null,
    d_plus: null,
    notes: null,
    structure: blocs.length ? blocs : null,
    est_watts: calcul?.watts ?? null,
    est_bpm: calcul?.bpm ?? null,
    est_kj: calcul?.kj ?? null,
    est_if: calcul?.facteurIntensite ?? null,
  };
}
