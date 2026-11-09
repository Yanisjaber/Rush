import { gunzipSync } from 'fflate';

// La trace d'une sortie réalisée (positions, altitude, distance), qu'elle vienne de Strava (fonction strava-trace) ou d'un fichier importé (flux stockés dans activities.streams_gz).
// Fonctions pures : aucun écran, aucun réseau.
export interface TraceBrute {
  /** Les positions [latitude, longitude]. */
  latlng: [number, number][];
  /** L'altitude (m) à chaque position ; vide si on ne l'a pas. */
  altitude: number[];
  /** La distance cumulée (m) à chaque position ; vide si on ne l'a pas. */
  distance: number[];
}

const MAX_POINTS = 5000; // la réponse du serveur n'en a que 600 ; les flux stockés d'un fichier importé peuvent en avoir plus, on allège
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function alleger<T>(liste: T[], max: number): T[] {
  if (liste.length <= max) return liste;
  return Array.from({ length: max }, (_, i) => liste[Math.round((i * (liste.length - 1)) / (max - 1))]);
}

/** Nettoie des listes brutes (positions, altitudes, distances) : positions valides seulement, listes alignées, allégées. Null sans deux positions valides. */
export function traceDepuisListes(pos: unknown, alt: unknown, dis: unknown): TraceBrute | null {
  if (!Array.isArray(pos)) return null;
  const altitudes = Array.isArray(alt) && alt.length === pos.length ? alt : null;
  const distances = Array.isArray(dis) && dis.length === pos.length ? dis : null;
  const garde: number[] = [];
  const latlng: [number, number][] = [];
  pos.forEach((p, i) => {
    if (!Array.isArray(p) || p.length < 2) return;
    const lat = nombre(p[0]);
    const lon = nombre(p[1]);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    garde.push(i);
    latlng.push([lat, lon]);
  });
  if (latlng.length < 2) return null;
  const choisis = alleger(
    latlng.map((_, k) => k),
    MAX_POINTS,
  );
  const aligne = (liste: unknown[] | null): number[] => {
    if (!liste) return [];
    const valeurs = garde.map((i) => nombre(liste[i]));
    return valeurs.every((v) => v !== null) ? choisis.map((k) => valeurs[k] as number) : [];
  };
  return { latlng: choisis.map((k) => latlng[k]), altitude: aligne(altitudes), distance: aligne(distances) };
}

/** La réponse de la fonction strava-trace : { ok, trace: { latlng, altitude, distance } | null }. Tout est revérifié, on ne fait pas confiance au réseau. */
export function traceDepuisReponse(corps: unknown): TraceBrute | null {
  const t = (corps as { trace?: { latlng?: unknown; altitude?: unknown; distance?: unknown } | null } | null)?.trace;
  if (!t || typeof t !== 'object') return null;
  return traceDepuisListes(t.latlng, t.altitude, t.distance);
}

/** Décode du base64 (sans dépendre de atob, absent de certains moteurs). Octets vides si la chaîne n'est pas du base64 valide. */
export function deBase64(texte: string): Uint8Array {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const propre = texte.replace(/[\r\n\s]/g, '').replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(propre)) return new Uint8Array(0);
  const octets: number[] = [];
  let tampon = 0;
  let bits = 0;
  for (const c of propre) {
    tampon = (tampon << 6) | A.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      octets.push((tampon >> bits) & 255);
    }
  }
  return Uint8Array.from(octets);
}

/** La liste de valeurs d'un type de flux : le format stocké est soit [{ type, data }], soit { type: { data } } ou { type: [...] }. */
function valeursDuFlux(flux: unknown, type: string): unknown {
  if (Array.isArray(flux)) return (flux.find((f) => f && f.type === type) as { data?: unknown } | undefined)?.data;
  const s = (flux as Record<string, unknown> | null)?.[type];
  return Array.isArray(s) ? s : (s as { data?: unknown } | undefined)?.data;
}

/** La trace d'un `streams_gz` (JSON compressé en gzip puis en base64). Null s'il n'y a pas de positions, ou si le contenu est illisible. */
export function traceDepuisStreams(base64: string | null | undefined): TraceBrute | null {
  if (!base64) return null;
  try {
    const octets = gunzipSync(deBase64(base64));
    if (!octets.length) return null;
    const flux: unknown = JSON.parse(new TextDecoder().decode(octets));
    return traceDepuisListes(valeursDuFlux(flux, 'latlng'), valeursDuFlux(flux, 'altitude'), valeursDuFlux(flux, 'distance'));
  } catch {
    return null;
  }
}
