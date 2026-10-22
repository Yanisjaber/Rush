// Logique du calendrier : construit la grille d'un mois (semaines de lundi à dimanche)
// et y range les séances réalisées, les séances prévues et les objectifs.
import { familleAffichage } from './familles.ts';
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

/** La charge d'une séance faite, en points : ses points de charge, à défaut une estimation par la durée (0,7 point par minute). */
export const chargeSeance = (s: Seance): number => (Number(s.tss) > 0 ? Number(s.tss) : Math.round(((s.moving_time || 0) / 60) * 0.7));

/** La charge du jour : celle de toutes ses séances faites. */
export const chargeJour = (j: JourGrille): number => j.seances.reduce((t, s) => t + chargeSeance(s), 0);

/** À partir de cette charge du jour (points), la teinte d'une case est à sa force maximale. */
const CHARGE_JOUR_FORTE = 150;

export interface TeinteJour {
  /** La famille du sport de la séance la plus chargée du jour (course, vélo…) : c'est sa couleur qui teinte la case. */
  famille: string;
  /** De 0 à 1 : la charge du jour rapportée à une grosse journée (150 points). */
  force: number;
}

/** De quelle couleur et avec quelle force teinter la case d'un jour : celle du sport de sa séance la plus chargée. Null sans séance faite. */
export function teinteJour(j: JourGrille): TeinteJour | null {
  if (!j.seances.length) return null;
  const dominante = j.seances.reduce((a, b) => (chargeSeance(b) > chargeSeance(a) ? b : a));
  return { famille: familleAffichage(dominante.sport), force: Math.min(1, chargeJour(j) / CHARGE_JOUR_FORTE) };
}

export interface ResumeSemaine {
  /** Temps des séances faites, en secondes. */
  faites: number;
  /** Temps des séances prévues (hors compétitions), en secondes. */
  prevues: number;
  /** Charge des séances faites, en points. */
  charge: number;
}

/** Le résumé d'une semaine de la grille (7 jours) : le temps fait, le temps prévu, la charge. Compte aussi les jours des mois voisins. */
export function resumeSemaine(semaine: JourGrille[]): ResumeSemaine {
  let faites = 0;
  let prevues = 0;
  let charge = 0;
  for (const j of semaine) {
    for (const s of j.seances) faites += s.moving_time || 0;
    for (const x of j.planifiees) prevues += (Number(x.duration) > 0 ? Number(x.duration) : 0) * 60;
    charge += chargeJour(j);
  }
  return { faites, prevues, charge };
}

/** Le temps d'un jour : ses séances faites plus ses séances prévues (hors compétitions), en secondes. */
export const secondesJour = (j: JourGrille): number =>
  j.seances.reduce((t, s) => t + (s.moving_time || 0), 0) + j.planifiees.reduce((t, x) => t + (Number(x.duration) > 0 ? Number(x.duration) * 60 : 0), 0);

export interface JourProfil {
  iso: string;
  /** Le temps du jour (fait + prévu), en secondes : la hauteur de sa barre. */
  secondes: number;
  /** La famille du sport qui prend le plus de temps ce jour-là (le fait d'abord, sinon le prévu) : la couleur de sa barre ; null un jour vide. */
  famille: string | null;
  /** Le jour a-t-il au moins une séance faite ? Sinon sa barre est pâle (rien que du prévu). */
  fait: boolean;
}

/** Le profil d'une semaine de la grille : une barre par jour, de lundi à dimanche. */
export function profilSemaine(semaine: JourGrille[]): JourProfil[] {
  return semaine.map((j) => {
    const faites = j.seances.filter((s) => s.moving_time > 0);
    const prevues = j.planifiees.filter((x) => Number(x.duration) > 0);
    const dominanteFaite = faites.length ? faites.reduce((a, b) => (b.moving_time > a.moving_time ? b : a)) : null;
    const dominantePrevue = !dominanteFaite && prevues.length ? prevues.reduce((a, b) => (Number(b.duration) > Number(a.duration) ? b : a)) : null;
    const sport = dominanteFaite?.sport ?? dominantePrevue?.sport;
    return { iso: j.iso, secondes: secondesJour(j), famille: sport ? familleAffichage(sport) : null, fait: faites.length > 0 };
  });
}

