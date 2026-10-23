// Parcours GPX : lecture sécurisée et statistiques (distance, dénivelé). Fonctions pures, sans écran ni réseau. Port de app/src/lib/data/gpx.js.
//
// Le fichier vient de l'utilisateur : on le traite comme non fiable. Lecture par motifs simples et bornés (pas d'interprétation XML complète, donc aucune entité
// externe ni expansion possible), taille limitée, coordonnées vérifiées. Rien n'est jamais inséré comme HTML ; le texte est seulement gardé tel quel en base.

export const TAILLE_MAX_GPX = 5 * 1024 * 1024; // 5 Mo
const POINTS_MAX = 300000;

export interface PointGpx {
  lat: number;
  lon: number;
  ele: number | null;
}

const nombre = (v: unknown): number => {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
};

const nettoyer = (t: unknown, max = 120): string =>
  String(t || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Le nom d'un fichier choisi, nettoyé pour l'affichage et le stockage (jamais de chemin, 120 caractères au plus). */
export const nomDeFichier = (nom: unknown): string => nettoyer(String(nom ?? '').split(/[\\/]/).pop() || 'parcours.gpx');

/**
 * Lit un fichier GPX (texte). Renvoie { points, nom, erreur }. `ele` vaut null si le point n'a pas d'altitude.
 * Cherche les points de trace (trkpt), sinon de route (rtept), sinon de repère (wpt).
 */
export function lireGpx(texte: unknown): { points: PointGpx[]; nom: string; erreur: string } {
  const brut = typeof texte === 'string' ? texte : '';
  if (!brut) return { points: [], nom: '', erreur: 'Le fichier est vide.' };
  if (brut.length > TAILLE_MAX_GPX) return { points: [], nom: '', erreur: 'Le fichier est trop gros (5 Mo maximum).' };
  if (!/<gpx[\s>]/i.test(brut)) return { points: [], nom: '', erreur: "Ce fichier n'est pas un GPX." };

  const lire = (balise: string): PointGpx[] | null => {
    const points: PointGpx[] = [];
    const motif = new RegExp(`<${balise}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${balise}>)`, 'gi');
    for (const m of brut.matchAll(motif)) {
      const lat = nombre((/\blat\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1]);
      const lon = nombre((/\blon\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1]);
      if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) continue;
      const e = m[2] ? /<ele>([^<]*)<\/ele>/i.exec(m[2]) : null;
      const ele = e ? nombre(e[1]) : NaN;
      points.push({ lat, lon, ele: Number.isFinite(ele) && ele > -500 && ele < 9000 ? ele : null });
      if (points.length > POINTS_MAX) return null;
    }
    return points;
  };

  let points = lire('trkpt');
  if (points === null) return { points: [], nom: '', erreur: 'Ce parcours contient trop de points.' };
  if (points.length < 2) points = lire('rtept') || [];
  if (points.length < 2) points = lire('wpt') || [];
  if (points.length < 2) return { points: [], nom: '', erreur: 'Aucun parcours exploitable dans ce fichier.' };

  const nom = nettoyer((/<name>([^<]*)<\/name>/i.exec(brut) || [])[1]);
  return { points, nom, erreur: '' };
}

const R = 6371; // rayon de la Terre en km
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance entre deux points en km (formule de haversine). */
export function distanceKm(a: Pick<PointGpx, 'lat' | 'lon'>, b: Pick<PointGpx, 'lat' | 'lon'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Dénivelé positif « intelligent » : on ne compte un changement que s'il dépasse 3 m (filtre le bruit du GPS). */
export function denivelePositif(altitudes: (number | null)[], seuil = 3): number {
  const alt = altitudes.filter((e): e is number => e != null);
  if (alt.length < 2) return 0;
  let gain = 0;
  let reference = alt[0];
  for (let i = 1; i < alt.length; i++) {
    const d = alt[i] - reference;
    if (d > seuil) {
      gain += d;
      reference = alt[i];
    } else if (d < -seuil) {
      reference = alt[i];
    }
  }
  return gain;
}

export interface ResumeGpx {
  nom: string;
  distanceKm: number;
  /** Dénivelé positif en mètres ; null si le parcours n'a pas d'altitude. */
  denivele: number | null;
  points: number;
}

/** Lit un GPX et en tire son nom, sa distance et son dénivelé positif. Renvoie l'erreur (en français) si le fichier n'est pas exploitable. */
export function resumerGpx(texte: unknown): { ok: true; resume: ResumeGpx } | { ok: false; erreur: string } {
  const r = lireGpx(texte);
  if (r.erreur) return { ok: false, erreur: r.erreur };
  let km = 0;
  for (let i = 1; i < r.points.length; i++) km += distanceKm(r.points[i - 1], r.points[i]);
  const avecAltitude = r.points.some((p) => p.ele != null);
  return {
    ok: true,
    resume: {
      nom: r.nom,
      distanceKm: Math.round(km * 100) / 100,
      denivele: avecAltitude ? Math.round(denivelePositif(r.points.map((p) => p.ele))) : null,
      points: r.points.length,
    },
  };
}

/** Un parcours prêt à être enregistré avec une séance : son nom et son contenu (texte du fichier). */
export interface ParcoursGpx {
  nom: string;
  contenu: string;
}

/** Vérifie un parcours avant l'envoi : texte non vide de 5 Mo au plus, qui est bien un GPX. Renvoie l'erreur ou null. */
export function verifierParcours(p: ParcoursGpx | null | undefined): string | null {
  if (p == null) return null;
  if (typeof p !== 'object' || typeof p.contenu !== 'string' || !p.contenu) return 'Parcours GPX invalide.';
  if (p.contenu.length > TAILLE_MAX_GPX) return 'Le parcours GPX est trop gros (5 Mo maximum).';
  if (!/<gpx[\s>]/i.test(p.contenu)) return "Ce fichier n'est pas un GPX.";
  if (typeof p.nom !== 'string' || p.nom.length > 120) return 'Le nom du parcours est invalide.';
  return null;
}
