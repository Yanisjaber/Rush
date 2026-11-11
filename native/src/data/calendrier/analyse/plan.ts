import { familleAffichage } from '../../sports/familles.ts';
import { dureeTotale, indiceZone, milieu, normaliser, segmentsDuBloc } from '../structure.ts';
import type { Bloc, Metrique, TypeBloc } from '../structure.ts';
import { detecterEfforts } from './efforts.ts';
import { allureFenetre, moyenne } from './flux.ts';
import type { Flux1Hz } from './flux.ts';

// Prévu contre réalisé : relier la sortie faite à la séance du calendrier, traduire la structure de la séance (blocs, zones, intensités) en cibles chiffrées,
// et mesurer ce qui a été fait dans chaque bloc. Fonctions pures : aucun écran, aucun réseau.
// Une référence manquante (pas de FTP, de FC max ou de vitesse seuil dans le profil) rend la cible de ce bloc inconnue : on ne juge JAMAIS avec une valeur par défaut.

export interface PrevueAnalyse {
  id: string;
  name: string | null;
  date: string;
  sport: string;
  duration: number | null; // minutes
  km: number | null;
  tss: number | null;
  rpe?: number | null;
  category: string;
  structure?: unknown[] | null;
}

/** Les références réelles du profil (null = non renseignée). `allureBase` : secondes par km à 100 % de l'intensité (allure au seuil). */
export interface RefsPlan {
  ftp?: number | null;
  hrMax?: number | null;
  allureBase?: number | null;
}

/** La séance prévue à relier à une sortie : même jour, même sport (famille), la durée la plus proche. Une compétition ne se relie qu'à défaut d'autre séance. Null s'il n'y en a pas. */
export function choisirPrevue(seance: { sport: string; start_date_local: string; moving_time: number | null }, prevues: readonly PrevueAnalyse[]): PrevueAnalyse | null {
  const jour = String(seance.start_date_local).slice(0, 10);
  const famille = familleAffichage(seance.sport);
  const duree = Number(seance.moving_time) > 0 ? Number(seance.moving_time) / 60 : null;
  const candidates = prevues.filter((p) => String(p.date).slice(0, 10) === jour && familleAffichage(p.sport) === famille);
  if (!candidates.length) return null;
  const ecart = (p: PrevueAnalyse) => (duree != null && Number(p.duration) > 0 ? Math.abs(Number(p.duration) - duree) : Number.MAX_SAFE_INTEGER);
  return [...candidates].sort((a, b) => Number(a.category === 'competition') - Number(b.category === 'competition') || ecart(a) - ecart(b))[0];
}

export interface SegmentPlan {
  debutS: number;
  dureeS: number;
  role: 'travail' | 'recup';
  blocIdx: number;
  nomBloc: string;
  type: TypeBloc;
  metric: Metrique;
  /** Indice de zone (0 = Z1) de l'intensité visée. */
  zone: number;
  /** La cible en valeur absolue : secondes par km (course), bpm ou W. Null si la référence manque. */
  bas: number | null;
  haut: number | null;
}

/** L'allure écrite dans le nom d'un bloc (« Footing à 6:28/km ») : c'est la parole exacte du plan, on la préfère au calcul depuis le profil. */
export function allureDansLeNom(nom: string): number | null {
  const m = /(\d{1,2}):(\d{2})\s*\/\s*km/.exec(String(nom));
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s >= 120 && s <= 1200 ? s : null;
}

/** La structure d'une séance prévue, segment après segment, avec les cibles chiffrées. */
export function segmentsPlan(structure: unknown, refs: RefsPlan, sport: string): SegmentPlan[] {
  const blocs: Bloc[] = normaliser(structure, familleAffichage(sport) === 'course' ? 'pace' : 'power');
  const liste: SegmentPlan[] = [];
  let t = 0;
  blocs.forEach((b, blocIdx) => {
    for (const { seg, role } of segmentsDuBloc(b)) {
      const bas = seg.intHi != null ? Math.min(seg.int, seg.intHi) : seg.int;
      const haut = seg.intHi != null ? Math.max(seg.int, seg.intHi) : seg.int;
      let lo: number | null = null;
      let hi: number | null = null;
      if (b.metric === 'power' && Number(refs.ftp) > 0) {
        lo = (Number(refs.ftp) * bas) / 100;
        hi = (Number(refs.ftp) * haut) / 100;
      } else if (b.metric === 'hr' && Number(refs.hrMax) > 0) {
        lo = (Number(refs.hrMax) * bas) / 100;
        hi = (Number(refs.hrMax) * haut) / 100;
      } else if (b.metric === 'pace' && allureDansLeNom(b.name) != null) {
        lo = hi = allureDansLeNom(b.name);
      } else if (b.metric === 'pace' && Number(refs.allureBase) > 0 && bas > 0) {
        // Plus l'intensité est haute, plus l'allure est rapide (moins de secondes par km)
        lo = (Number(refs.allureBase) * 100) / haut;
        hi = (Number(refs.allureBase) * 100) / bas;
      }
      liste.push({ debutS: Math.round(t * 60), dureeS: Math.round(seg.min * 60), role, blocIdx, nomBloc: b.name, type: b.type, metric: b.metric, zone: indiceZone(milieu(seg), b.metric), bas: lo, haut: hi });
      t += seg.min;
    }
  });
  return liste;
}

export type StatutSegment = 'dans' | 'trop_vite' | 'trop_lent' | 'trop_haut' | 'trop_bas' | 'inconnu';

export interface ResultatSegment {
  seg: SegmentPlan;
  /** La valeur mesurée sur la fenêtre (s/km, bpm ou W). */
  mesure: number | null;
  statut: StatutSegment;
  /** Écart à la cible, en % de la cible la plus proche (positif = au-dessus). */
  ecartPct: number | null;
}

/** Tolérance autour de la cible (en % de ses bornes) : un cran d'imprécision du capteur ou du terrain. Convention de lecture, pas une norme. */
export const TOLERANCE: Record<Metrique, number> = { pace: 0.03, hr: 0.03, power: 0.05 };

function mesurer(f: Flux1Hz, seg: SegmentPlan): number | null {
  const fin = seg.debutS + seg.dureeS;
  if (seg.metric === 'pace') return allureFenetre(f.v, seg.debutS, fin);
  if (seg.metric === 'hr') return moyenne(f.fc, seg.debutS, fin);
  return moyenne(f.w, seg.debutS, fin);
}

/** Mesure chaque segment de travail (échauffement et retour au calme compris : ils ont leur cible aussi) et le situe par rapport à sa cible. */
export function mesurerSegments(f: Flux1Hz, segs: SegmentPlan[]): ResultatSegment[] {
  return segs
    .filter((s) => s.role === 'travail')
    .map((seg) => {
      const m = seg.debutS + 5 < f.n ? mesurer(f, seg) : null;
      if (m == null || seg.bas == null || seg.haut == null) return { seg, mesure: m, statut: 'inconnu' as const, ecartPct: null };
      const tol = TOLERANCE[seg.metric];
      const lo = seg.bas * (1 - tol);
      const hi = seg.haut * (1 + tol);
      if (m >= lo && m <= hi) return { seg, mesure: m, statut: 'dans' as const, ecartPct: 0 };
      const dessus = m > hi;
      const ref = dessus ? seg.haut : seg.bas;
      const ecart = Math.round(((m - ref) / ref) * 1000) / 10;
      // En allure, plus de secondes = plus lent
      const statut: StatutSegment = seg.metric === 'pace' ? (dessus ? 'trop_lent' : 'trop_vite') : dessus ? 'trop_haut' : 'trop_bas';
      return { seg, mesure: m, statut, ecartPct: ecart };
    });
}

export interface ResumeBloc {
  blocIdx: number;
  nom: string;
  type: TypeBloc;
  metric: Metrique;
  nbReps: number;
  evaluees: number;
  dans: number;
  /** Valeur de la 1re et de la dernière répétition évaluée. */
  premiere: number | null;
  derniere: number | null;
  /** La cible commune du bloc (bornes de la première répétition). */
  bas: number | null;
  haut: number | null;
  /** Statut dominant des répétitions hors cible. */
  horsCible: 'trop_vite' | 'trop_lent' | 'trop_haut' | 'trop_bas' | null;
  /** Mode détection (le chrono ne suit pas le plan) : combien d'efforts ont été retrouvés dans le flux. Null en mode chrono. */
  detectees: number | null;
  /** Mode détection d'un bloc continu : l'écart à la cible la plus proche, dans l'unité de la métrique (s/km, bpm, W). */
  ecart: number | null;
}

/** Regroupe les segments par bloc : combien de répétitions dans la cible, et comment la première et la dernière se comparent. Échauffement et retour au calme ne sont pas jugés. */
export function resumerBlocs(res: ResultatSegment[]): ResumeBloc[] {
  const parBloc = new Map<number, ResultatSegment[]>();
  for (const r of res) {
    if (r.seg.type === 'warmup' || r.seg.type === 'cooldown' || r.seg.type === 'recovery') continue;
    parBloc.set(r.seg.blocIdx, [...(parBloc.get(r.seg.blocIdx) ?? []), r]);
  }
  return [...parBloc.entries()].map(([blocIdx, liste]) => {
    const evaluees = liste.filter((r) => r.statut !== 'inconnu');
    const hors = evaluees.filter((r) => r.statut !== 'dans');
    const compte = new Map<string, number>();
    for (const r of hors) compte.set(r.statut, (compte.get(r.statut) ?? 0) + 1);
    const dominant = [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as ResumeBloc['horsCible'] | undefined;
    const premiereLigne = evaluees[0];
    const derniereLigne = evaluees[evaluees.length - 1];
    return {
      blocIdx,
      nom: liste[0].seg.nomBloc,
      type: liste[0].seg.type,
      metric: liste[0].seg.metric,
      nbReps: liste.length,
      evaluees: evaluees.length,
      dans: evaluees.length - hors.length,
      premiere: premiereLigne?.mesure ?? null,
      derniere: derniereLigne?.mesure ?? null,
      bas: liste[0].seg.bas,
      haut: liste[0].seg.haut,
      horsCible: dominant ?? null,
      detectees: null,
      ecart: null,
    };
  });
}

/** Tolérance d'un effort court : le GPS lisse mal 20 secondes, on est plus large qu'au chrono. */
const TOLERANCE_EFFORT_COURT = 0.06;

/**
 * Juger sans le chrono : quand la sortie ne suit pas la structure à la seconde, on RETROUVE les efforts dans le flux.
 *  - un bloc d'intervalles (lignes droites, répétitions) : on compte les accélérations de la bonne durée et on mesure leur allure ;
 *  - un bloc continu : on mesure ce qui reste quand on retire les efforts (allure ou cœur moyens), contre la cible du bloc.
 * Seule l'allure est jugée ainsi (la détection se fait sur la vitesse). Un bloc sans cible chiffrée n'est pas jugé.
 */
export function jugerParDetection(f: Flux1Hz, segs: SegmentPlan[]): ResumeBloc[] {
  const parBloc = new Map<number, SegmentPlan[]>();
  for (const s of segs) if (s.type === 'interval' || s.type === 'steady') parBloc.set(s.blocIdx, [...(parBloc.get(s.blocIdx) ?? []), s]);
  const sortie: ResumeBloc[] = [];
  const exclure = new Array(f.n).fill(false);
  // D'abord les intervalles (leurs efforts sortent du calcul des blocs continus)
  const resultats = new Map<number, ResumeBloc>();
  let efforts: ReturnType<typeof detecterEfforts> = [];
  for (const [idx, liste] of parBloc) {
    const travail = liste.filter((x) => x.role === 'travail');
    const premier = travail[0];
    if (premier.type !== 'interval' || premier.metric !== 'pace' || premier.bas == null || premier.haut == null || efforts.length) continue;
    const vitesseCible = 1000 / ((premier.bas + premier.haut) / 2);
    efforts = detecterEfforts(f, premier.dureeS, vitesseCible).slice(0, travail.length + 4);
    // Une accélération bien plus lente que la cible (de plus de 8 %) n'est pas une répétition : c'est le bout de la sortie, une côte, un feu qui passe au vert
    const gardes = efforts.filter((e) => e.allure <= premier.haut! * 1.08).slice(0, travail.length);
    const tol = premier.dureeS <= 90 ? TOLERANCE_EFFORT_COURT : TOLERANCE[premier.metric];
    const dans = gardes.filter((e) => e.allure >= premier.bas! * (1 - tol) && e.allure <= premier.haut! * (1 + tol)).length;
    const hors = gardes.filter((e) => e.allure < premier.bas! * (1 - tol) || e.allure > premier.haut! * (1 + tol));
    const trop = hors.length ? (hors.filter((e) => e.allure > premier.haut!).length >= hors.length / 2 ? 'trop_lent' : 'trop_vite') : null;
    for (const e of efforts) for (let i = Math.max(0, e.debutS - 5); i < Math.min(f.n, e.debutS + e.dureeS + 5); i++) exclure[i] = true;
    resultats.set(idx, {
      blocIdx: idx, nom: premier.nomBloc, type: 'interval', metric: 'pace', nbReps: travail.length, evaluees: gardes.length, dans,
      premiere: gardes[0]?.allure ?? null, derniere: gardes[gardes.length - 1]?.allure ?? null, bas: premier.bas, haut: premier.haut, horsCible: trop, detectees: gardes.length, ecart: null,
    });
  }
  for (const [idx, liste] of parBloc) {
    const premier = liste[0];
    if (resultats.has(idx)) continue;
    if (premier.type !== 'steady' || premier.bas == null || premier.haut == null) continue;
    // Les secondes hors efforts : l'allure (ou le cœur) du fond de la sortie
    let metres = 0;
    let secondes = 0;
    let fcS = 0;
    let fcK = 0;
    for (let i = 0; i < f.n; i++) {
      if (exclure[i]) continue;
      metres += f.v[i];
      secondes++;
      if (f.fc[i] > 0) {
        fcS += f.fc[i];
        fcK++;
      }
    }
    const mesure = premier.metric === 'pace' ? (metres > 0 ? (secondes * 1000) / metres : null) : premier.metric === 'hr' ? (fcK ? fcS / fcK : null) : null;
    if (mesure == null || secondes < 120) continue;
    const tol = TOLERANCE[premier.metric];
    const dedans = mesure >= premier.bas * (1 - tol) && mesure <= premier.haut * (1 + tol);
    const dessus = mesure > premier.haut * (1 + tol);
    const ref = dessus ? premier.haut : premier.bas;
    resultats.set(idx, {
      blocIdx: idx, nom: premier.nomBloc, type: 'steady', metric: premier.metric, nbReps: 1, evaluees: 1, dans: dedans ? 1 : 0, premiere: mesure, derniere: mesure, bas: premier.bas, haut: premier.haut,
      horsCible: dedans ? null : premier.metric === 'pace' ? (dessus ? 'trop_lent' : 'trop_vite') : dessus ? 'trop_haut' : 'trop_bas', detectees: null, ecart: dedans ? 0 : Math.round(Math.abs(mesure - ref)),
    });
  }
  for (const idx of [...parBloc.keys()].sort((a, b) => a - b)) {
    const r = resultats.get(idx);
    if (r) sortie.push(r);
  }
  return sortie;
}

/** La part du temps prévu passée en intervalles (travail et récupération) : un footing avec quelques lignes droites en a peu, un fractionné beaucoup. */
export function partIntervalles(structure: unknown, sport: string): number {
  const blocs = normaliser(structure, familleAffichage(sport) === 'course' ? 'pace' : 'power');
  let total = 0;
  let interv = 0;
  for (const b of blocs) {
    for (const { seg } of segmentsDuBloc(b)) {
      total += seg.min;
      if (b.type === 'interval') interv += seg.min;
    }
  }
  return total > 0 ? interv / total : 0;
}

/** Le chrono suit-il le plan ? Sinon les fenêtres de temps ne tombent pas sur les blocs et on ne juge pas bloc par bloc. */
export function alignementFiable(f: Flux1Hz, segs: SegmentPlan[]): boolean {
  const prevu = segs.reduce((n, s) => Math.max(n, s.debutS + s.dureeS), 0);
  return prevu > 0 && Math.abs(f.n - prevu) / prevu <= 0.12;
}

export interface EcartGlobal {
  cle: 'duree' | 'km' | 'charge';
  prevu: number;
  fait: number;
  /** En % du prévu (positif = plus que prévu). */
  ecartPct: number;
}

/** Durée, distance et charge : le fait contre le prévu. Une grandeur absente d'un côté n'est pas comparée. */
export function comparerGlobal(p: PrevueAnalyse, fait: { moving_time: number | null; distance_km: number | null; tss: number | null }): EcartGlobal[] {
  const sortie: EcartGlobal[] = [];
  const ajouter = (cle: EcartGlobal['cle'], prevu: number, f: number | null) => {
    if (prevu > 0 && f != null && f > 0) sortie.push({ cle, prevu, fait: f, ecartPct: Math.round(((f - prevu) / prevu) * 1000) / 10 });
  };
  ajouter('duree', Number(p.duration), Number(fait.moving_time) > 0 ? Number(fait.moving_time) / 60 : null);
  ajouter('km', Number(p.km), Number(fait.distance_km));
  ajouter('charge', Number(p.tss), Number(fait.tss));
  return sortie;
}

export type Intention = 'facile' | 'modere' | 'dur';

/**
 * Ce que la séance prévue demandait : « facile » (zones 1-2), « modéré » (zone 3), « dur » (zone 4 et plus).
 * Lu dans la structure (zone moyenne, pondérée par la durée des blocs de travail), à défaut dans l'effort estimé (RPE : 1 à 4 facile, 5-6 modéré, 7 et plus dur). Null sans indice.
 */
export function intentionDuPlan(p: PrevueAnalyse): Intention | null {
  const blocs = normaliser(p.structure ?? [], familleAffichage(p.sport) === 'course' ? 'pace' : 'power');
  if (blocs.length) {
    let somme = 0;
    let total = 0;
    for (const b of blocs) {
      if (b.type === 'warmup' || b.type === 'cooldown' || b.type === 'recovery') continue;
      const z = indiceZone(milieu(b.work), b.metric);
      const d = b.work.min * b.reps;
      somme += z * d;
      total += d;
    }
    if (total > 0) {
      const moy = somme / total;
      return moy < 1.5 ? 'facile' : moy < 2.5 ? 'modere' : 'dur';
    }
  }
  const rpe = Number(p.rpe);
  if (rpe >= 1) return rpe <= 4 ? 'facile' : rpe <= 6 ? 'modere' : 'dur';
  return null;
}

/** La durée prévue par la structure, en secondes (0 sans structure). */
export const dureeStructureS = (structure: unknown, sport: string): number => Math.round(dureeTotale(normaliser(structure, familleAffichage(sport) === 'course' ? 'pace' : 'power')) * 60);
