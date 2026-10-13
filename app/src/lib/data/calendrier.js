// Logique du calendrier : construit la grille d'un mois (semaines de lundi à dimanche)
// et y range les séances réalisées, les séances prévues et les objectifs.
import { dateIsoLocale } from '../utils/format.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const iso10 = (valeur) => String(valeur).slice(0, 10);

/** Lundi (à midi) de la semaine qui contient la date. */
function lundiDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Première et dernière date affichées pour un mois (la grille déborde sur les mois voisins). */
export function bornesGrille(annee, mois) {
  const debut = lundiDe(new Date(annee, mois, 1));
  const dernier = new Date(annee, mois + 1, 0, 12); // dernier jour du mois
  const fin = lundiDe(dernier);
  fin.setDate(fin.getDate() + 6);
  return { debut: dateIsoLocale(debut), fin: dateIsoLocale(fin) };
}

/** Mois précédent ou suivant : (annee, mois, +1 | -1) → { annee, mois }. */
export function decalerMois(annee, mois, sens) {
  const d = new Date(annee, mois + sens, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}

export function titreMois(annee, mois) {
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
export function grilleMois(annee, mois, { seances = [], planifiees = [], objectifs = [], notes = [], repos = [] } = {}, aujourdhui = new Date()) {
  const { debut } = bornesGrille(annee, mois);
  const auj = dateIsoLocale(aujourdhui);

  const range = (liste, cle) => {
    const m = new Map();
    for (const e of liste) {
      const k = iso10(cle(e));
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  };
  const parSeance = range(seances, (s) => s.start_date_local);
  const parPlan = range(planifiees, (p) => p.date);
  const parObjectif = range(objectifs, (o) => o.date);
  const jourDeRepos = new Set(repos.map((r) => iso10(r.iso_date ?? r)));

  const semaines = [];
  const curseur = new Date(`${debut}T12:00:00`);
  while (true) {
    const semaine = [];
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
