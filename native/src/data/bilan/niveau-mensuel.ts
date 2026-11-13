// Le niveau mois par mois, calculé sur un seul fait : les heures d'entraînement du mois, sport par sport.
// La note d'un mois = ses heures / les heures de ton MEILLEUR mois de ce sport × 100. 100 = ton meilleur mois, 50 = la moitié.
// Aucune formule maison : un total d'heures, que tu peux vérifier dans le calendrier. Fonctions pures, sans réseau.
import type { ActiviteBilan } from './bilan.ts';

export interface PointMois {
  /** « 2026-03 » */
  mois: string;
  heures: number;
  /** 0 à 100 : les heures du mois par rapport à ton meilleur mois de ce sport */
  note: number;
  /** Le mois en cours : il n'est pas fini, sa note peut encore monter */
  enCours: boolean;
}

export interface CourbeSport {
  famille: string;
  /** Du premier mois d'entraînement de ce sport jusqu'au mois en cours, sans trou (un mois sans séance vaut 0). */
  points: PointMois[];
  /** Ton meilleur mois de ce sport : le premier en date quand deux mois sont à égalité. */
  meilleur: PointMois;
  /** Les heures de tout l'historique de ce sport (sert à ranger les sports) */
  totalHeures: number;
}

const moisDe = (iso: string): string => iso.slice(0, 7);
const indexMois = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const moisDepuisIndex = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/** Une courbe par sport (famille), le sport le plus pratiqué d'abord. Un sport sans une seule heure n'a pas de courbe. */
export function notesMensuelles(acts: readonly ActiviteBilan[], maintenant: Date): CourbeSport[] {
  const courant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const parSport = new Map<string, Map<string, number>>();
  for (const a of acts) {
    if (!(a.duree_min > 0)) continue;
    const m = moisDe(a.iso);
    if (m > courant) continue; // une séance datée dans le futur n'est pas encore faite
    const mois = parSport.get(a.famille) ?? new Map<string, number>();
    mois.set(m, (mois.get(m) ?? 0) + a.duree_min / 60);
    parSport.set(a.famille, mois);
  }

  const courbes: CourbeSport[] = [];
  for (const [famille, mois] of parSport) {
    const cles = [...mois.keys()].sort();
    const debut = indexMois(cles[0]);
    const fin = indexMois(courant);
    const heures: number[] = [];
    for (let i = debut; i <= fin; i++) heures.push(mois.get(moisDepuisIndex(i)) ?? 0);
    const meilleurH = Math.max(...heures);
    if (!(meilleurH > 0)) continue;
    const points: PointMois[] = heures.map((h, k) => {
      const m = moisDepuisIndex(debut + k);
      return { mois: m, heures: h, note: Math.round((h / meilleurH) * 100), enCours: m === courant };
    });
    const meilleur = points.find((x) => x.heures === meilleurH) as PointMois;
    courbes.push({ famille, points, meilleur, totalHeures: heures.reduce((t, h) => t + h, 0) });
  }
  return courbes.sort((a, b) => b.totalHeures - a.totalHeures);
}

/** Les mois affichés : les `nb` derniers (null = tout l'historique). Les notes, elles, restent celles de tout l'historique. */
export function fenetre(courbes: readonly CourbeSport[], nb: number | null, maintenant: Date): { mois: string[]; courbes: CourbeSport[] } {
  const courant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const premier = courbes.length ? Math.min(...courbes.map((c) => indexMois(c.points[0].mois))) : indexMois(courant);
  const debut = nb == null ? premier : Math.max(premier, indexMois(courant) - nb + 1);
  const mois: string[] = [];
  for (let i = debut; i <= indexMois(courant); i++) mois.push(moisDepuisIndex(i));
  const garde = new Set(mois);
  return { mois, courbes: courbes.map((c) => ({ ...c, points: c.points.filter((p) => garde.has(p.mois)) })).filter((c) => c.points.length > 0) };
}

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « Mars 2026 » */
export function nomMois(mois: string): string {
  const nom = NOMS_MOIS[Number(mois.slice(5, 7)) - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${mois.slice(0, 4)}`;
}
