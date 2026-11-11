import { detecterEfforts } from './efforts.ts';
import type { Flux1Hz } from './flux.ts';

// Les réactions du corps et la progression, lues dans le flux et dans les sorties passées. Fonctions pures : aucun écran, aucun réseau.
// Seuils : des conventions de lecture (nommées ci-dessous), pas des normes médicales.

/** Cœur moyen et pic d'une sortie (bpm), null sans cœur. Les 0 (cœur inconnu) sont ignorés. */
export function niveauCoeur(f: Flux1Hz): { moyen: number; pic: number } | null {
  let s = 0;
  let k = 0;
  const valeurs: number[] = [];
  for (const x of f.fc) {
    if (x > 0) {
      s += x;
      k++;
      valeurs.push(x);
    }
  }
  if (k < 120) return null;
  valeurs.sort((a, b) => a - b);
  return { moyen: s / k, pic: valeurs[Math.floor(valeurs.length * 0.995)] };
};

/** Combien de bpm le cœur perd dans la minute qui suit la fin d'un effort (cœur de la fin d'effort moins cœur 60 s plus tard). */
export interface Recuperation {
  /** Baisse après chaque effort, dans l'ordre. */
  baisses: number[];
}
const moyFc = (f: Flux1Hz, de: number, fin: number): number | null => {
  let s = 0;
  let k = 0;
  for (let i = Math.max(0, de); i < Math.min(f.n, fin); i++) {
    if (f.fc[i] > 0) {
      s += f.fc[i];
      k++;
    }
  }
  return k >= 3 ? s / k : null;
};

/** Seuls les efforts suivis d'au moins 60 s de récupération comptent (le dernier peut ne pas l'être). Il en faut 3 pour parler de tendance. */
export function recuperationCardiaque(f: Flux1Hz, dureeEffortS: number, vitesseCible: number | null): Recuperation | null {
  const efforts = detecterEfforts(f, dureeEffortS, vitesseCible);
  const baisses: number[] = [];
  for (const e of efforts) {
    const fin = e.debutS + e.dureeS;
    if (fin + 62 > f.n) continue;
    const apres = moyFc(f, fin + 56, fin + 62);
    const avant = moyFc(f, fin - 5, fin);
    if (avant == null || apres == null) continue;
    baisses.push(avant - apres);
  }
  return baisses.length >= 3 ? { baisses } : null;
}

/** Une récupération qui se dégrade : la baisse du dernier effort est inférieure d'au moins 30 % à celle du premier. */
export const RECUP_DEGRADEE = 0.3;

// --- Progression ------------------------------------------------------------------------------------------------------------------

export interface SortieHistorique {
  id: string;
  sport: string;
  /** Le type deviné d'après le nom (footing, longue…). */
  type: string;
  date: string;
  dureeS: number;
  distanceKm: number | null;
  coeurMoyen: number | null;
  deniveleM: number | null;
}

export interface Progression {
  /** Écart d'efficacité (vitesse par battement) en % : positif = plus vite à cœur égal. */
  ecartPct: number;
  /** Secondes par km gagnées (positif) ou perdues (négatif) à cœur égal. */
  secKm: number;
  nb: number;
  comparable: boolean;
  coeurMoyenRefs: number;
}

/** Une sortie est comparable si : même sport, même type, durée de 0,6 à 1,6 fois la sienne, relief voisin, dans les 90 jours, avant elle. */
const FENETRE_JOURS = 90;
const NB_REFS_MAX = 5;
const NB_REFS_MINI = 2;
/** Un cœur moyen qui diffère de plus de 10 bpm rend la comparaison fragile (le lien allure/cœur n'est plus proche d'une droite). */
const ECART_COEUR_MAX = 10;
/** En dessous de 2,5 % d'écart d'efficacité, on parle de stabilité : c'est le bruit habituel du cœur d'une sortie à l'autre (chaleur, sommeil, café). */
export const SEUIL_PROGRES = 2.5;

const mediane = (a: number[]) => {
  const t = [...a].sort((x, y) => x - y);
  return t.length ? t[Math.floor(t.length / 2)] : 0;
};
const parKm = (m: number | null, km: number | null) => (m != null && km ? m / km : 0);

export function calculerProgression(
  courante: { id: string; sport: string; type: string; date: string; dureeS: number; distanceKm: number | null; coeurMoyen: number | null; deniveleM: number | null },
  historique: SortieHistorique[],
): Progression | null {
  if ((courante.type !== 'footing' && courante.type !== 'longue') || !courante.coeurMoyen || !courante.distanceKm || courante.dureeS < 900) return null;
  const limite = new Date(courante.date).getTime() - FENETRE_JOURS * 86400000;
  const refs = historique
    .filter((h) => h.id !== courante.id && h.sport === courante.sport && h.type === courante.type && h.date < courante.date)
    .filter((h) => new Date(h.date).getTime() >= limite && h.coeurMoyen && h.coeurMoyen >= 60 && h.distanceKm && h.dureeS >= 0.6 * courante.dureeS && h.dureeS <= 1.6 * courante.dureeS)
    .filter((h) => Math.abs(parKm(h.deniveleM, h.distanceKm) - parKm(courante.deniveleM, courante.distanceKm)) <= 10)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, NB_REFS_MAX);
  if (refs.length < NB_REFS_MINI) return null;
  const efficacite = (km: number, s: number, fc: number) => (km * 1000) / s / fc;
  const ref = mediane(refs.map((h) => efficacite(h.distanceKm!, h.dureeS, h.coeurMoyen!)));
  const maintenant = efficacite(courante.distanceKm, courante.dureeS, courante.coeurMoyen);
  const coeurRefs = mediane(refs.map((h) => h.coeurMoyen!));
  const ecart = (maintenant / ref - 1) * 100;
  const allureRef = mediane(refs.map((h) => h.dureeS / h.distanceKm!));
  const secKm = allureRef * (1 - 1 / (1 + ecart / 100));
  return { ecartPct: ecart, secKm, nb: refs.length, comparable: Math.abs(courante.coeurMoyen - coeurRefs) <= ECART_COEUR_MAX, coeurMoyenRefs: coeurRefs };
}
