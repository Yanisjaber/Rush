// L'aperçu d'une activité qu'on vient d'importer : la trace pour la carte, le profil d'altitude et les chiffres principaux. Fonctions pures, sans écran ni réseau.
import { formatAllure, formatDuree, formatKm, formatNombre } from './format.ts';
import { distanceKm, lireGpx } from './gpx.ts';
import type { ActiviteImportee } from './import-activite.ts';

export interface PointCarte {
  latitude: number;
  longitude: number;
}

export interface RegionCarte extends PointCarte {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface StatApercu {
  libelle: string;
  valeur: string;
}

export interface ApercuImport {
  /** La trace, allégée (600 points au plus) ; vide si le fichier n'a pas de position. */
  trace: PointCarte[];
  /** La zone à montrer pour voir toute la trace ; null sans trace. */
  region: RegionCarte | null;
  /** Les altitudes (m), à intervalles réguliers de distance (160 points au plus) ; vide sans altitude. */
  profil: number[];
  altitudeMin: number | null;
  altitudeMax: number | null;
  /** Les chiffres principaux (distance, durée, dénivelé, vitesse ou allure, FC moyenne, puissance moyenne), dans l'ordre d'affichage ; seuls ceux que le fichier donne. */
  stats: StatApercu[];
}

const POINTS_TRACE = 600;
const POINTS_PROFIL = 160;

/** `max` éléments pris à intervalles réguliers, le premier et le dernier toujours gardés. */
export function echantillonner<T>(liste: T[], max: number): T[] {
  if (liste.length <= max) return liste.slice();
  if (max < 2) return [liste[0]];
  return Array.from({ length: max }, (_, k) => liste[Math.round((k * (liste.length - 1)) / (max - 1))]);
}

/** La zone qui contient toute la trace, avec une marge ; jamais plus étroite que ~400 m (une trace presque immobile ne zoome pas à l'infini). */
export function regionDeTrace(trace: PointCarte[]): RegionCarte | null {
  if (!trace.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of trace) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.004),
    longitudeDelta: Math.max((maxLon - minLon) * 1.4, 0.004),
  };
}

/** Les altitudes à pas de distance réguliers (l'axe du profil est la distance, pas le temps : une pause ne l'étire pas). Sans distance, pas d'index réguliers. */
export function profilAltitude(altitudes: (number | null)[], distances: (number | null)[] | null, points = POINTS_PROFIL): number[] {
  // Une altitude manquante reprend la précédente (la première reprend la première connue)
  const premiere = altitudes.find((v): v is number => v != null);
  if (premiere == null) return [];
  let derniere = premiere;
  const alt = altitudes.map((v) => (derniere = v ?? derniere));
  if (!distances || distances.length !== alt.length || distances.every((d) => d == null)) return echantillonner(alt, points);
  let precedente = 0;
  const dist = distances.map((d) => (precedente = d != null && d >= precedente ? d : precedente)); // croissante
  const total = dist[dist.length - 1];
  if (!(total > 0) || alt.length <= points) return echantillonner(alt, points);
  const sortie: number[] = [];
  let j = 0;
  for (let k = 0; k < points; k++) {
    const cible = (total * k) / (points - 1);
    while (j < dist.length - 1 && dist[j] < cible) j++;
    sortie.push(alt[j]);
  }
  return sortie;
}

/** Tout ce que la fenêtre d'aperçu montre. `type` est le type de l'activité (Run, Ride…) tel qu'il sera enregistré. */
export function apercuImport(a: ActiviteImportee, type: string): ApercuImport {
  const flux = (t: string) => a.flux.find((f) => f.type === t)?.data;
  const pos = flux('latlng') as ([number, number] | null)[] | undefined;
  const trace = echantillonner(
    (pos ?? []).filter((p): p is [number, number] => p != null).map(([latitude, longitude]) => ({ latitude, longitude })),
    POINTS_TRACE,
  );
  const alt = flux('altitude') as (number | null)[] | undefined;
  const profil = alt ? profilAltitude(alt, (flux('distance') as (number | null)[] | undefined) ?? null) : [];

  const stats: StatApercu[] = [];
  const ajout = (libelle: string, valeur: string | null) => valeur && stats.push({ libelle, valeur });
  const km = a.distanceKm;
  if (km != null && km > 0) ajout('Distance', type === 'Swim' ? `${formatNombre(km * 1000)} m` : `${formatKm(km, km >= 100 ? 0 : 1)} km`);
  ajout('Durée', a.dureeS != null ? formatDuree(a.dureeS) : null);
  ajout('Dénivelé +', a.denivele != null ? `${formatNombre(a.denivele)} m` : null);
  if (km != null && km > 0 && a.dureeS != null && a.dureeS > 0 && type !== 'Swim') {
    if (type === 'Run') ajout('Allure', formatAllure(a.dureeS / km));
    else ajout('Vitesse moy.', `${formatKm(a.extras?.avg_speed_kmh ?? (km / a.dureeS) * 3600)} km/h`);
  }
  ajout('FC moy.', a.fc != null ? `${a.fc} bpm` : null);
  ajout('Puissance moy.', a.extras?.avg_watts != null ? `${formatNombre(a.extras.avg_watts)} W` : null);

  return {
    trace,
    region: regionDeTrace(trace),
    profil,
    altitudeMin: profil.length ? Math.min(...profil) : null,
    altitudeMax: profil.length ? Math.max(...profil) : null,
    stats,
  };
}

/** La carte et le profil d'altitude d'un parcours GPX déjà enregistré (celui d'une séance prévue ou d'une compétition) ; null si le fichier n'a pas assez de points. */
export function apercuDeGpx(contenu: string): Pick<ApercuImport, 'trace' | 'region' | 'profil' | 'altitudeMin' | 'altitudeMax'> | null {
  const { points } = lireGpx(contenu);
  if (points.length < 2) return null;
  const trace = echantillonner(points.map((p) => ({ latitude: p.lat, longitude: p.lon })), POINTS_TRACE);
  let cumul = 0;
  const distances = points.map((p, i) => (i === 0 ? 0 : (cumul += distanceKm(points[i - 1], p))));
  const profil = profilAltitude(points.map((p) => p.ele), distances);
  return { trace, region: regionDeTrace(trace), profil, altitudeMin: profil.length ? Math.min(...profil) : null, altitudeMax: profil.length ? Math.max(...profil) : null };
}
