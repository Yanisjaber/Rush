// Nettoyage de la trace d'une activité Strava (positions, altitude, distance) avant de la renvoyer à l'app.
// Fonction pure : aucune base, aucun réseau. Utilisée par strava-trace, testée dans supabase/tests/edge/trace-strava.test.mts.

export const POINTS_MAX = 600;

export interface TraceNettoyee {
  /** Les positions [latitude, longitude], 600 au plus. */
  latlng: [number, number][];
  /** L'altitude (m) de chaque position ; vide si Strava n'en donne pas. */
  altitude: number[];
  /** La distance cumulée (m) à chaque position ; vide si Strava n'en donne pas. */
  distance: number[];
}

const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Garde au plus `max` éléments, répartis régulièrement (le premier et le dernier sont toujours gardés). */
export function alleger<T>(liste: T[], max: number): T[] {
  if (liste.length <= max) return liste;
  const sortie: T[] = [];
  for (let i = 0; i < max; i++) sortie.push(liste[Math.round((i * (liste.length - 1)) / (max - 1))]);
  return sortie;
}

/** Les valeurs d'un flux Strava reçu avec key_by_type=true : { type: { data: [...] } }. */
function donnees(brut: any, type: string): unknown[] {
  const d = brut?.[type]?.data;
  return Array.isArray(d) ? d : [];
}

/**
 * La trace d'une réponse « streams » de Strava. Les positions invalides sont écartées (avec leur altitude et leur distance, pour que les trois listes restent alignées) ;
 * sans au moins deux positions valides, il n'y a pas de trace (null).
 */
export function nettoyerTrace(brut: unknown): TraceNettoyee | null {
  const pos = donnees(brut, 'latlng');
  const alt = donnees(brut, 'altitude');
  const dis = donnees(brut, 'distance');
  const idx: number[] = [];
  const latlng: [number, number][] = [];
  pos.forEach((p, i) => {
    if (!Array.isArray(p) || p.length < 2) return;
    const lat = nombre(p[0]);
    const lon = nombre(p[1]);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    idx.push(i);
    latlng.push([lat, lon]);
  });
  if (latlng.length < 2) return null;
  const altitude = alt.length === pos.length ? idx.map((i) => nombre(alt[i])) : [];
  const distance = dis.length === pos.length ? idx.map((i) => nombre(dis[i])) : [];
  // On allège les trois listes avec les mêmes indices
  const choisis = alleger(latlng.map((_, k) => k), POINTS_MAX);
  const garder = <T>(l: (T | null)[]): T[] => (l.length && l.every((v) => v !== null) ? choisis.map((k) => l[k] as T) : []);
  return { latlng: choisis.map((k) => latlng[k]), altitude: garder(altitude), distance: garder(distance) };
}

const CLES_COURBES = ['distance', 'velocity_smooth', 'heartrate', 'altitude', 'cadence', 'watts', 'time'] as const;

/**
 * Les courbes d'une réponse « streams » de Strava (distance, vitesse, cœur, altitude, cadence, puissance, temps écoulé), même forme que la réponse : { type: { data: [...] } }.
 * Un flux qui n'est pas fait que de nombres, ou dont la longueur diffère de celle de la distance, est écarté. 600 points au plus, mêmes indices pour tous. Null sans aucune courbe.
 */
export function nettoyerCourbes(brut: unknown): Record<string, { data: number[] }> | null {
  const longueur = Math.max(0, ...CLES_COURBES.map((c) => donnees(brut, c).length));
  if (longueur < 2) return null;
  const choisis = alleger(Array.from({ length: longueur }, (_, i) => i), POINTS_MAX);
  const sortie: Record<string, { data: number[] }> = {};
  for (const cle of CLES_COURBES) {
    const d = donnees(brut, cle);
    if (d.length !== longueur || !d.every((v) => nombre(v) !== null)) continue;
    sortie[cle] = { data: choisis.map((k) => d[k] as number) };
  }
  return Object.keys(sortie).length ? sortie : null;
}
