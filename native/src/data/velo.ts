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
