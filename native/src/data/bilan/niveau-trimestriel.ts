// Le niveau trimestre par trimestre, calculé sur trois faits, sport par sport :
//   - les heures d'entraînement du trimestre ;
//   - la charge du trimestre (les « pts » de l'app) ;
//   - les records posés pendant le trimestre : combien de tes records actuels (plus longue séance, plus longue distance, plus gros dénivelé, plus grosse charge) datent de ces trois mois.
// Chaque fait est comparé à ton MEILLEUR trimestre de ce sport (100 = ton meilleur trimestre pour ce fait). La note du trimestre est la moyenne de ces pourcentages, remise à l'échelle
// pour que ton meilleur trimestre vaille 100. Un fait que le sport n'a pas (pas de charge, aucun record) n'entre pas dans la moyenne. Fonctions pures, sans réseau.
// Un trimestre = trois mois du calendrier : T1 janvier à mars, T2 avril à juin, T3 juillet à septembre, T4 octobre à décembre. Clé : « 2026-T1 ».
import type { ActiviteBilan } from './bilan.ts';

export interface PointTrimestre {
  /** « 2026-T1 » */
  trimestre: string;
  heures: number;
  /** La charge du trimestre (somme des « pts » des séances) */
  charge: number;
  /** Combien de tes records actuels ont été posés pendant ce trimestre */
  records: number;
  /** 0 à 100 : la moyenne des pourcentages (heures, charge, records) par rapport à ton meilleur trimestre, remise à l'échelle (le meilleur vaut 100) */
  note: number;
  /** Le trimestre en cours : il n'est pas fini, sa note peut encore monter */
  enCours: boolean;
}

export interface CourbeSport {
  famille: string;
  /** Du premier trimestre d'entraînement de ce sport jusqu'au trimestre en cours, sans trou (un trimestre sans séance vaut 0). */
  points: PointTrimestre[];
  /** Ton meilleur trimestre de ce sport : le premier en date quand deux trimestres sont à égalité. */
  meilleur: PointTrimestre;
  /** Les heures de tout l'historique de ce sport (sert à ranger les sports) */
  totalHeures: number;
}

/** Le trimestre d'une date ISO (« 2026-03-15 » → « 2026-T1 »). */
export const trimestreDe = (iso: string): string => `${iso.slice(0, 4)}-T${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
const indexTrimestre = (t: string): number => Number(t.slice(0, 4)) * 4 + Number(t.slice(6, 7)) - 1;
const trimestreDepuisIndex = (i: number): string => `${Math.floor(i / 4)}-T${(i % 4) + 1}`;
const trimestreCourant = (maintenant: Date): string => `${maintenant.getFullYear()}-T${Math.floor(maintenant.getMonth() / 3) + 1}`;

/** Les mesures d'une séance dont le record (la plus grande valeur) compte comme « record posé pendant ce trimestre ». */
const RECORDS_SEANCE = ['duree_min', 'distance_km', 'd_plus', 'tss'] as const;

/** Les familles sans courbe : « Autres » (ski, trek…) mélange des sports sans rapport entre eux, un niveau n'y aurait aucun sens. */
const SANS_COURBE = new Set(['autre']);

/** Une courbe par sport (famille), le sport le plus pratiqué d'abord. Un sport sans une seule heure n'a pas de courbe. */
export function notesTrimestrielles(acts: readonly ActiviteBilan[], maintenant: Date): CourbeSport[] {
  const courant = trimestreCourant(maintenant);
  const parSport = new Map<string, ActiviteBilan[]>();
  for (const a of acts) {
    if (SANS_COURBE.has(a.famille)) continue;
    if (!(a.duree_min > 0)) continue;
    if (trimestreDe(a.iso) > courant) continue; // une séance datée dans le futur n'est pas encore faite
    const liste = parSport.get(a.famille) ?? [];
    liste.push(a);
    parSport.set(a.famille, liste);
  }

  const courbes: CourbeSport[] = [];
  for (const [famille, seances] of parSport) {
    const heuresParT = new Map<string, number>();
    const chargeParT = new Map<string, number>();
    for (const a of seances) {
      const t = trimestreDe(a.iso);
      heuresParT.set(t, (heuresParT.get(t) ?? 0) + a.duree_min / 60);
      chargeParT.set(t, (chargeParT.get(t) ?? 0) + (a.tss > 0 ? a.tss : 0));
    }
    // Les records actuels du sport : la plus grande valeur de chaque mesure (à égalité, la plus ancienne séance), rattachée à son trimestre
    const recordsParT = new Map<string, number>();
    for (const cle of RECORDS_SEANCE) {
      let meilleure: ActiviteBilan | null = null;
      for (const a of seances) if (a[cle] > 0 && (!meilleure || a[cle] > meilleure[cle] || (a[cle] === meilleure[cle] && a.iso < meilleure.iso))) meilleure = a;
      if (meilleure) recordsParT.set(trimestreDe(meilleure.iso), (recordsParT.get(trimestreDe(meilleure.iso)) ?? 0) + 1);
    }

    const cles = [...heuresParT.keys()].sort();
    const debut = indexTrimestre(cles[0]);
    const fin = indexTrimestre(courant);
    const trimestres: string[] = [];
    for (let i = debut; i <= fin; i++) trimestres.push(trimestreDepuisIndex(i));
    const h = trimestres.map((t) => heuresParT.get(t) ?? 0);
    const c = trimestres.map((t) => chargeParT.get(t) ?? 0);
    const r = trimestres.map((t) => recordsParT.get(t) ?? 0);
    const hMax = Math.max(...h);
    if (!(hMax > 0)) continue;
    const cMax = Math.max(...c);
    const rMax = Math.max(...r);
    // La moyenne des pourcentages des faits que ce sport a
    const brute = trimestres.map((_, k) => {
      const parts = [h[k] / hMax];
      if (cMax > 0) parts.push(c[k] / cMax);
      if (rMax > 0) parts.push(r[k] / rMax);
      return parts.reduce((t, x) => t + x, 0) / parts.length;
    });
    const bMax = Math.max(...brute);
    const points: PointTrimestre[] = trimestres.map((t, k) => ({ trimestre: t, heures: h[k], charge: c[k], records: r[k], note: Math.round((brute[k] / bMax) * 100), enCours: t === courant }));
    const meilleur = points.find((x) => x.note === 100) as PointTrimestre;
    courbes.push({ famille, points, meilleur, totalHeures: h.reduce((t, x) => t + x, 0) });
  }
  return courbes.sort((a, b) => b.totalHeures - a.totalHeures);
}

/** Les trimestres affichés : les `nb` derniers (null = tout l'historique). Les notes, elles, restent celles de tout l'historique. */
export function fenetre(courbes: readonly CourbeSport[], nb: number | null, maintenant: Date): { trimestres: string[]; courbes: CourbeSport[] } {
  const courant = trimestreCourant(maintenant);
  const premier = courbes.length ? Math.min(...courbes.map((c) => indexTrimestre(c.points[0].trimestre))) : indexTrimestre(courant);
  const debut = nb == null ? premier : Math.max(premier, indexTrimestre(courant) - nb + 1);
  const trimestres: string[] = [];
  for (let i = debut; i <= indexTrimestre(courant); i++) trimestres.push(trimestreDepuisIndex(i));
  const garde = new Set(trimestres);
  return { trimestres, courbes: courbes.map((c) => ({ ...c, points: c.points.filter((p) => garde.has(p.trimestre)) })).filter((c) => c.points.length > 0) };
}

const MOIS_DU_TRIMESTRE = ['janv. – mars', 'avril – juin', 'juil. – sept.', 'oct. – déc.'];
/** « T1 2026 » */
export const nomTrimestre = (t: string): string => `T${t.slice(6, 7)} ${t.slice(0, 4)}`;
/** « janv. – mars » : les trois mois du trimestre */
export const moisDuTrimestre = (t: string): string => MOIS_DU_TRIMESTRE[Number(t.slice(6, 7)) - 1] ?? '';
