import { familleAffichage } from '../../sports/familles.ts';
import { dureeTotale, indiceZone, milieu, normaliser, segmentsDuBloc } from '../structure.ts';
import type { Bloc, Metrique, TypeBloc } from '../structure.ts';
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
    };
  });
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
