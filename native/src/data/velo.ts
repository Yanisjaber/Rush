// Vélo : kilomètres et dénivelé par semaine, évolution de la FTP, répartition du temps par zone de puissance.
// Calculs purs, sans écran (testés dans tests/velo.test.ts).
import { familleAffichage } from './familles.ts';
import { cumulParSemaine, repartirParZone, type CumulHebdo, type RepartitionZones } from './hebdo.ts';
import { MODELES_ZONES } from './profil.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

const EST_VELO = (s: Seance): boolean => familleAffichage(s.sport) === 'velo';

export function kmVeloParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => EST_VELO(s) && (s.distance_km ?? 0) > 0, (s) => Number(s.distance_km), nbSemaines, aujourdhui, 1);
}

/** Dénivelé positif en mètres par semaine ; une sortie sans dénivelé renseigné compte pour zéro. */
export function deniveleParSemaine(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): CumulHebdo {
  return cumulParSemaine(seances, (s) => EST_VELO(s) && Number(s.total_elevation_gain) > 0, (s) => Number(s.total_elevation_gain), nbSemaines, aujourdhui, 0);
}

export interface EvolutionFtp {
  /** La FTP de chaque semaine depuis la première connue, de la plus ancienne à la plus récente. Une semaine sans sortie garde la FTP d'avant. */
  parSemaine: number[];
  actuelle: number;
  /** Évolution depuis la première FTP connue, en % (null si elle est identique ou sans point de départ). */
  evolutionPct: number | null;
  meilleure: number;
}

/**
 * Évolution de la FTP sur `nbSemaines`, d'après la FTP enregistrée avec chaque sortie (ftp_at_time) : la dernière sortie de la semaine fait foi.
 * Null sans aucune FTP connue sur la période.
 */
export function evolutionFtp(seances: Seance[], nbSemaines = 26, aujourdhui: Date = new Date()): EvolutionFtp | null {
  // Par semaine (0 = la plus ancienne), la FTP de la sortie la plus récente
  const parSemaine: { date: string; ftp: number }[] = [];
  for (const s of seances) {
    const ftp = Number(s.ftp_at_time);
    if (!EST_VELO(s) || !(ftp > 0)) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const k = nbSemaines - 1 - i;
    if (!parSemaine[k] || s.start_date_local > parSemaine[k].date) parSemaine[k] = { date: s.start_date_local, ftp };
  }
  const premier = parSemaine.findIndex((x) => x);
  if (premier < 0) return null;
  const valeurs: number[] = [];
  let derniere = 0;
  for (let k = premier; k < nbSemaines; k++) {
    if (parSemaine[k]) derniere = parSemaine[k].ftp;
    valeurs.push(derniere);
  }
  const depart = valeurs[0];
  const actuelle = valeurs[valeurs.length - 1];
  return { parSemaine: valeurs, actuelle, evolutionPct: depart !== actuelle ? Math.round(((actuelle - depart) / depart) * 1000) / 10 : null, meilleure: Math.max(...valeurs) };
}

/**
 * Temps de vélo par zone de puissance sur les 4 dernières semaines. Une sortie est classée tout entière dans la zone de sa puissance normalisée
 * (à défaut sa puissance moyenne) : c'est une estimation, une sortie variée se range au milieu. Null sans FTP ou sans sortie avec puissance.
 */
export function repartitionPuissance(seances: Seance[], ftp: unknown, nbSemaines = 4, aujourdhui: Date = new Date()): RepartitionZones | null {
  const reference = Number(ftp);
  if (!(reference > 0)) return null;
  const entrees = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return EST_VELO(s) && s.moving_time > 0 && i >= 0 && i < nbSemaines;
    })
    .map((s) => ({ watts: Number(s.np) > 0 ? Number(s.np) : Number(s.avg_watts), temps: s.moving_time }))
    .filter((e) => e.watts > 0)
    .map((e) => ({ pct: (e.watts / reference) * 100, temps: e.temps }));
  return repartirParZone(entrees, MODELES_ZONES.puissance.zones);
}

/** La FTP de référence : celle du profil, sinon celle de la sortie la plus récente qui en a une. */
export function ftpReference(profilFtp: unknown, seances: Seance[]): number | null {
  if (Number(profilFtp) > 0) return Number(profilFtp);
  const derniere = seances.filter((s) => EST_VELO(s) && Number(s.ftp_at_time) > 0).sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))[0];
  return derniere ? Number(derniere.ftp_at_time) : null;
}

// --- Watts et fréquence cardiaque ------------------------------------------------------------------------------------

export interface WattsACardioEgal {
  /** Watts moyens des sorties faciles de chaque semaine qui en a, de la plus ancienne à la plus récente. */
  points: { semaine: number; watts: number }[];
  actuelle: number;
  /** Évolution entre la première et la dernière semaine, en % (positif = plus de watts pour le même cardio). */
  evolutionPct: number;
}

/**
 * Watts moyens des sorties faciles (cardio entre 60 et 80 % de la FC max, 125 à 155 bpm sans FC max), semaine après semaine : ils montent quand la
 * condition monte. Pondérés par la durée des sorties. Null avec moins de trois semaines exploitables.
 */
export function wattsACardioEgal(seances: Seance[], hrMax: number | null, nbSemaines = 12, aujourdhui: Date = new Date()): WattsACardioEgal | null {
  const bas = hrMax ? hrMax * 0.6 : 125;
  const haut = hrMax ? hrMax * 0.8 : 155;
  const semaines = new Map<number, { temps: number; wattsTemps: number }>();
  for (const s of seances) {
    const watts = Number(s.avg_watts);
    const fc = Number(s.avg_heartrate);
    if (!EST_VELO(s) || !(watts > 0) || !(s.moving_time >= 1200) || !(fc >= bas && fc <= haut)) continue;
    const i = indexSemaine(s.start_date_local, aujourdhui);
    if (i < 0 || i >= nbSemaines) continue;
    const cle = nbSemaines - 1 - i;
    const m = semaines.get(cle) ?? { temps: 0, wattsTemps: 0 };
    m.temps += s.moving_time;
    m.wattsTemps += watts * s.moving_time;
    semaines.set(cle, m);
  }
  const points = [...semaines.entries()].sort((a, b) => a[0] - b[0]).map(([semaine, m]) => ({ semaine, watts: Math.round(m.wattsTemps / m.temps) }));
  if (points.length < 3) return null;
  const premier = points[0].watts;
  const actuelle = points[points.length - 1].watts;
  return { points, actuelle, evolutionPct: Math.round(((actuelle - premier) / premier) * 1000) / 10 };
}

export interface EquivalenceWattsFc {
  /** Une sortie = un point : sa FC moyenne (bpm) et sa puissance moyenne (W). */
  points: { fc: number; watts: number }[];
  /** La droite d'équivalence : watts = pente × FC + ordonnée. */
  pente: number;
  ordonnee: number;
  /** Qualité de l'ajustement, de 0 à 1 (plus c'est haut, plus la droite colle aux sorties). */
  r2: number;
  fcMin: number;
  fcMax: number;
  /** Quelques équivalences « à 140 bpm ≈ 190 W » (tous les 10 bpm, ou 5 si la plage est étroite), sur la plage de FC observée (jamais au-delà). */
  table: { fc: number; watts: number }[];
}

/**
 * Équivalence entre cardio et watts, par régression sur tes sorties à vélo des 12 dernières semaines (une sortie = sa FC moyenne et ses watts moyens).
 * Il faut au moins 6 sorties d'au moins 20 minutes, avec une FC qui varie d'au moins 10 bpm et une relation qui monte. Sinon null.
 */
export function equivalenceWattsFc(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): EquivalenceWattsFc | null {
  const points = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return EST_VELO(s) && s.moving_time >= 1200 && Number(s.avg_watts) > 0 && Number(s.avg_heartrate) > 0 && i >= 0 && i < nbSemaines;
    })
    .map((s) => ({ fc: Number(s.avg_heartrate), watts: Number(s.avg_watts) }));
  const n = points.length;
  if (n < 6) return null;
  const fcMin = Math.min(...points.map((p) => p.fc));
  const fcMax = Math.max(...points.map((p) => p.fc));
  if (fcMax - fcMin < 10) return null;
  const mx = points.reduce((a, p) => a + p.fc, 0) / n;
  const my = points.reduce((a, p) => a + p.watts, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.fc - mx) ** 2, 0);
  const sxy = points.reduce((a, p) => a + (p.fc - mx) * (p.watts - my), 0);
  const syy = points.reduce((a, p) => a + (p.watts - my) ** 2, 0);
  if (sxx <= 0 || syy <= 0) return null;
  const pente = sxy / sxx;
  if (!(pente > 0)) return null;
  const ordonnee = my - pente * mx;
  const r2 = (sxy * sxy) / (sxx * syy);
  // Une équivalence tous les 10 bpm (tous les 5 quand la plage observée est étroite), sur la plage observée
  const pas = fcMax - fcMin < 30 ? 5 : 10;
  const table: { fc: number; watts: number }[] = [];
  for (let fc = Math.ceil(fcMin / pas) * pas; fc <= fcMax; fc += pas) table.push({ fc, watts: Math.round(pente * fc + ordonnee) });
  return { points, pente, ordonnee, r2, fcMin, fcMax, table };
}
