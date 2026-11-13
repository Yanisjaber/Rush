// Le niveau mois par mois, calculé sur trois faits, sport par sport :
//   - les heures d'entraînement du mois ;
//   - la charge du mois (les « pts » de l'app) ;
//   - les records posés ce mois-là : combien de tes records actuels (plus longue séance, plus longue distance, plus gros dénivelé, plus grosse charge) datent de ce mois.
// Chaque fait est comparé à ton MEILLEUR mois de ce sport (100 = ton meilleur mois pour ce fait). La note du mois est la moyenne de ces pourcentages, remise à l'échelle
// pour que ton meilleur mois vaille 100. Un fait que le sport n'a pas (pas de charge, aucun record) n'entre pas dans la moyenne. Fonctions pures, sans réseau.
import type { ActiviteBilan } from './bilan.ts';

export interface PointMois {
  /** « 2026-03 » */
  mois: string;
  heures: number;
  /** La charge du mois (somme des « pts » des séances) */
  charge: number;
  /** Combien de tes records actuels ont été posés ce mois-là */
  records: number;
  /** 0 à 100 : la moyenne des pourcentages (heures, charge, records) par rapport à ton meilleur mois, remise à l'échelle (le meilleur mois vaut 100) */
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

/** Les mesures d'une séance dont le record (la plus grande valeur) compte comme « record posé ce mois-là ». */
const RECORDS_SEANCE = ['duree_min', 'distance_km', 'd_plus', 'tss'] as const;

/** Une courbe par sport (famille), le sport le plus pratiqué d'abord. Un sport sans une seule heure n'a pas de courbe. */
export function notesMensuelles(acts: readonly ActiviteBilan[], maintenant: Date): CourbeSport[] {
  const courant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const parSport = new Map<string, ActiviteBilan[]>();
  for (const a of acts) {
    if (!(a.duree_min > 0)) continue;
    if (moisDe(a.iso) > courant) continue; // une séance datée dans le futur n'est pas encore faite
    const liste = parSport.get(a.famille) ?? [];
    liste.push(a);
    parSport.set(a.famille, liste);
  }

  const courbes: CourbeSport[] = [];
  for (const [famille, seances] of parSport) {
    const heuresParMois = new Map<string, number>();
    const chargeParMois = new Map<string, number>();
    for (const a of seances) {
      const m = moisDe(a.iso);
      heuresParMois.set(m, (heuresParMois.get(m) ?? 0) + a.duree_min / 60);
      chargeParMois.set(m, (chargeParMois.get(m) ?? 0) + (a.tss > 0 ? a.tss : 0));
    }
    // Les records actuels du sport : la plus grande valeur de chaque mesure (à égalité, la plus ancienne séance), rattachée à son mois
    const recordsParMois = new Map<string, number>();
    for (const cle of RECORDS_SEANCE) {
      let meilleure: ActiviteBilan | null = null;
      for (const a of seances) if (a[cle] > 0 && (!meilleure || a[cle] > meilleure[cle] || (a[cle] === meilleure[cle] && a.iso < meilleure.iso))) meilleure = a;
      if (meilleure) recordsParMois.set(moisDe(meilleure.iso), (recordsParMois.get(moisDe(meilleure.iso)) ?? 0) + 1);
    }

    const cles = [...heuresParMois.keys()].sort();
    const debut = indexMois(cles[0]);
    const fin = indexMois(courant);
    const mois: string[] = [];
    for (let i = debut; i <= fin; i++) mois.push(moisDepuisIndex(i));
    const h = mois.map((m) => heuresParMois.get(m) ?? 0);
    const c = mois.map((m) => chargeParMois.get(m) ?? 0);
    const r = mois.map((m) => recordsParMois.get(m) ?? 0);
    const hMax = Math.max(...h);
    if (!(hMax > 0)) continue;
    const cMax = Math.max(...c);
    const rMax = Math.max(...r);
    // La moyenne des pourcentages des faits que ce sport a
    const brute = mois.map((_, k) => {
      const parts = [h[k] / hMax];
      if (cMax > 0) parts.push(c[k] / cMax);
      if (rMax > 0) parts.push(r[k] / rMax);
      return parts.reduce((t, x) => t + x, 0) / parts.length;
    });
    const bMax = Math.max(...brute);
    const points: PointMois[] = mois.map((m, k) => ({ mois: m, heures: h[k], charge: c[k], records: r[k], note: Math.round((brute[k] / bMax) * 100), enCours: m === courant }));
    const meilleur = points.find((x) => x.note === 100) as PointMois;
    courbes.push({ famille, points, meilleur, totalHeures: h.reduce((t, x) => t + x, 0) });
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
