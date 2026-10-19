// Logique du calendrier : construit la grille d'un mois (semaines de lundi à dimanche)
// et y range les séances réalisées, les séances prévues et les objectifs.
import { dateIsoLocale } from './format.ts';
import type { Note, Objectif, Prevue, Seance } from './types.ts';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const iso10 = (valeur: unknown): string => String(valeur).slice(0, 10);

/** Lundi (à midi) de la semaine qui contient la date. */
function lundiDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Première et dernière date affichées pour un mois (la grille déborde sur les mois voisins). */
export function bornesGrille(annee: number, mois: number): { debut: string; fin: string } {
  const debut = lundiDe(new Date(annee, mois, 1));
  const dernier = new Date(annee, mois + 1, 0, 12); // dernier jour du mois
  const fin = lundiDe(dernier);
  fin.setDate(fin.getDate() + 6);
  return { debut: dateIsoLocale(debut), fin: dateIsoLocale(fin) };
}

/** Mois précédent ou suivant : (annee, mois, +1 | -1) → { annee, mois }. */
export function decalerMois(annee: number, mois: number, sens: number): { annee: number; mois: number } {
  const d = new Date(annee, mois + sens, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}

export function titreMois(annee: number, mois: number): string {
  return `${MOIS[mois]} ${annee}`;
}

/**
 * Grille d'un mois : { titre, semaines: [[jour × 7] × n] }.
 * jour : { iso, num, dansMois, aujourdhui, futur, seances, planifiees, objectifs, notes, repos }
 *  - seances : séances réalisées (table activities)
 *  - planifiees : séances prévues (activity_planned, hors compétitions)
 *  - objectifs : compétitions (activity_planned, category = 'competition')
 *  - notes : notes, maladies et blessures qui recouvrent le jour (day_notes) ; repos : jour de repos (rest_day)
 */
export interface JourGrille {
  iso: string;
  num: number;
  dansMois: boolean;
  aujourdhui: boolean;
  futur: boolean;
  seances: Seance[];
  planifiees: Prevue[];
  objectifs: (Objectif | Prevue)[];
  notes: Note[];
  repos: boolean;
}

export function grilleMois(
  annee: number,
  mois: number,
  {
    seances = [],
    planifiees = [],
    objectifs = [],
    notes = [],
    repos = [],
  }: { seances?: Seance[]; planifiees?: Prevue[]; objectifs?: (Objectif | Prevue)[]; notes?: Note[]; repos?: (string | { iso_date: string })[] } = {},
  aujourdhui: Date = new Date(),
): { titre: string; semaines: JourGrille[][] } {
  const { debut } = bornesGrille(annee, mois);
  const auj = dateIsoLocale(aujourdhui);

  const range = <T,>(liste: T[], cle: (e: T) => unknown): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const e of liste) {
      const k = iso10(cle(e));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  };
  const parSeance = range(seances, (s) => s.start_date_local);
  const parPlan = range(planifiees, (p) => p.date);
  const parObjectif = range(objectifs, (o) => o.date);
  const jourDeRepos = new Set(repos.map((r) => iso10(typeof r === 'string' ? r : r.iso_date)));

  const semaines: JourGrille[][] = [];
  const curseur = new Date(`${debut}T12:00:00`);
  while (true) {
    const semaine: JourGrille[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = dateIsoLocale(curseur);
      semaine.push({
        iso,
        num: curseur.getDate(),
        dansMois: curseur.getMonth() === mois,
        aujourdhui: iso === auj,
        futur: iso > auj,
        seances: parSeance.get(iso) || [],
        planifiees: parPlan.get(iso) || [],
        objectifs: parObjectif.get(iso) || [],
        notes: notes.filter((n) => String(n.from_date) <= iso && iso <= String(n.to_date)),
        repos: jourDeRepos.has(iso),
      });
      curseur.setDate(curseur.getDate() + 1);
    }
    semaines.push(semaine);
    // on s'arrête quand la semaine suivante commence après le mois affiché
    const prochain = new Date(curseur);
    if (prochain.getMonth() !== mois && prochain.getFullYear() * 12 + prochain.getMonth() > annee * 12 + mois) break;
    if (semaines.length > 6) break; // garde-fou
  }
  return { titre: titreMois(annee, mois), semaines };
}

/** Un jour est vide quand il n'a ni séance, ni séance prévue, ni objectif, ni note, ni repos. */
export const jourVide = (j: JourGrille): boolean => !j.seances.length && !j.planifiees.length && !j.objectifs.length && !j.notes.length && !j.repos;

/**
 * Le jour apparaît-il dans la liste (téléphone) ? Les jours vides sont masqués (sauf aujourd'hui), et un jour d'un mois voisin
 * n'apparaît que s'il a une séance, une séance prévue ou un objectif (comme sur le web : règles CSS « .vide » et « .hors »).
 */
export function jourAffiche(j: JourGrille): boolean {
  if (jourVide(j) && !j.aujourdhui) return false;
  if (!j.dansMois && !j.seances.length && !j.planifiees.length && !j.objectifs.length) return false;
  return true;
}

/** Nom court du jour de la semaine d'une date ISO : « Lun », « Mar »… */
export const nomJour = (iso: string): string => JOURS_SEMAINE[(new Date(`${iso}T12:00:00`).getDay() + 6) % 7];
