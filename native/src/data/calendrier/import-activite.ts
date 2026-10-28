// Import d'une activité déjà faite depuis un fichier .fit, .gpx ou .tcx : lecture sécurisée et résumé (début, durée, distance, dénivelé, FC). Fonctions pures, sans écran ni réseau.
//
// Le fichier vient de l'utilisateur : on le traite comme non fiable. Taille limitée, aucune interprétation XML complète (motifs simples et bornés, comme gpx.ts), le FIT est lu
// octet par octet avec des bornes partout. Rien n'est inséré comme HTML ; le résultat ne sert qu'à préremplir le formulaire « Activité déjà faite », que l'utilisateur relit.
import { gzipSync } from 'fflate';
import { denivelePositif, distanceKm, lireGpx, TAILLE_MAX_GPX } from '../outils/gpx.ts';

export const TAILLE_MAX_IMPORT = TAILLE_MAX_GPX; // 5 Mo
const POINTS_MAX = 300000;

/** Un flux seconde par seconde, au format de Strava (activities.streams_gz) : `time` en secondes depuis le début, `latlng` en paires [lat, lon]. Les points absents sont null. */
export interface FluxImporte {
  type: 'time' | 'distance' | 'watts' | 'heartrate' | 'cadence' | 'altitude' | 'velocity_smooth' | 'temp' | 'latlng';
  data: (number | [number, number] | null)[];
}

/** Un tour du fichier (distance en mètres, temps en secondes), comme ceux de Strava. */
export interface TourImporte {
  index: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
}

/** Les chiffres de résumé que le fichier donne en plus (colonnes de `activities`) ; null quand il ne les donne pas. */
export interface ExtrasImportes {
  avg_watts: number | null;
  max_watts: number | null;
  np: number | null;
  max_heartrate: number | null;
  avg_cadence: number | null;
  calories: number | null;
  kj: number | null;
  avg_speed_kmh: number | null;
}

export interface ActiviteImportee {
  /** Type brut stocké en base (Run, Ride…) ; null si le fichier ne dit pas le sport (on garde alors celui du formulaire). */
  type: string | null;
  debut: Date | null;
  dureeS: number | null;
  distanceKm: number | null;
  /** Dénivelé positif en mètres ; null si le fichier n'a pas d'altitude. */
  denivele: number | null;
  fc: number | null;
  nom: string;
  /** Les flux (FIT seulement) ; liste vide si le fichier n'en a pas. */
  flux: FluxImporte[];
  tours: TourImporte[];
  extras: ExtrasImportes | null;
}

export type LectureActivite = { ok: true; activite: ActiviteImportee } | { ok: false; erreur: string };

/** Un point d'une trace (une seconde de FIT, un point de GPX ou de TCX) : `t` en secondes, distances en mètres, vitesse en m/s. */
interface PointFlux {
  t: number;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  fc: number | null;
  cad: number | null;
  dist: number | null;
  vit: number | null;
  w: number | null;
  temp: number | null;
}
const pointVide = (t: number): PointFlux => ({ t, lat: null, lon: null, alt: null, fc: null, cad: null, dist: null, vit: null, w: null, temp: null });

const vide = (): ActiviteImportee => ({ type: null, debut: null, dureeS: null, distanceKm: null, denivele: null, fc: null, nom: '', flux: [], tours: [], extras: null });

// Une valeur absente ou vide n'est PAS zéro (sinon un point sans position irait en 0°N 0°E, une altitude manquante compterait 0 m)
const nombre = (v: unknown): number => {
  const t = String(v ?? '').trim();
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const nettoyer = (t: unknown, max = 120): string =>
  String(t || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// Une date plausible : après 2000, au plus demain (l'horloge d'une montre peut être en retard ou en avance d'un peu)
const dateValide = (d: Date | null, maintenant: number): Date | null => (d && d.getTime() >= Date.UTC(2000, 0, 1) && d.getTime() <= maintenant + 86400000 ? d : null);
const dateIso = (t: unknown, maintenant: number): Date | null => {
  const brut = String(t ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(brut)) return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : dateValide(d, maintenant);
};

const moyenne = (v: number[]): number | null => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
const arrondi = (n: number, d = 2): number => Math.round(n * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------------------------------------------------------------
// GPX : la trace donne la distance et le dénivelé ; l'heure des points, la durée ; l'extension « hr » (Garmin), la FC.

function sportDepuisTexte(t: string): string | null {
  const s = t.toLowerCase();
  if (/run|course|trail/.test(s)) return 'Run';
  if (/cycl|bik|ride|velo|vélo/.test(s)) return 'Ride';
  if (/swim|natation/.test(s)) return 'Swim';
  return null;
}

function lireActiviteGpx(texte: string, maintenant: number): LectureActivite {
  const lu = lireGpx(texte);
  if (lu.erreur) return { ok: false, erreur: lu.erreur };
  const a = vide();
  a.nom = lu.nom;
  let km = 0;
  for (let i = 1; i < lu.points.length; i++) km += distanceKm(lu.points[i - 1], lu.points[i]);
  a.distanceKm = arrondi(km);
  if (lu.points.some((p) => p.ele != null)) a.denivele = Math.round(denivelePositif(lu.points.map((p) => p.ele)));

  const heures: number[] = [];
  const fcs: number[] = [];
  const points: PointFlux[] = [];
  let metres = 0;
  let vus = 0;
  for (const m of texte.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi)) {
    if (++vus > POINTS_MAX) break;
    const t = /<time>([^<]*)<\/time>/i.exec(m[2]);
    const d = t ? dateIso(t[1], maintenant) : null;
    if (d) heures.push(d.getTime());
    const h = /<(?:[\w-]+:)?hr>\s*(\d{2,3})\s*<\//i.exec(m[2]);
    const fcPoint = h && nombre(h[1]) >= 30 && nombre(h[1]) <= 250 ? nombre(h[1]) : null;
    if (fcPoint != null) fcs.push(fcPoint);
    // Le point pour les flux : position vérifiée, altitude plausible, distance cumulée
    const lat = nombre((/\blat\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1]);
    const lon = nombre((/\blon\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1]);
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) continue;
    const e = /<ele>([^<]*)<\/ele>/i.exec(m[2]);
    const ele = e ? nombre(e[1]) : NaN;
    const p = pointVide(d ? d.getTime() / 1000 : NaN);
    p.lat = lat;
    p.lon = lon;
    p.alt = Number.isFinite(ele) && ele > -500 && ele < 9000 ? ele : null;
    p.fc = fcPoint;
    const avant = points[points.length - 1];
    if (avant) metres += distanceKm({ lat: avant.lat as number, lon: avant.lon as number }, { lat, lon }) * 1000;
    p.dist = metres;
    points.push(p);
  }
  const avecTemps = points.length > 1 && points.every((p) => !Number.isNaN(p.t));
  if (!avecTemps) points.forEach((p, i) => (p.t = i));
  a.flux = fluxDesPoints(points, avecTemps);
  if (heures.length) {
    a.debut = new Date(heures[0]);
    const secondes = (heures[heures.length - 1] - heures[0]) / 1000;
    if (secondes > 0) a.dureeS = Math.round(secondes);
  }
  a.fc = moyenne(fcs);
  const type = /<trk\b[\s\S]*?<type>([^<]*)<\/type>/i.exec(texte);
  a.type = type ? sportDepuisTexte(type[1]) : null;
  return { ok: true, activite: a };
}

// ---------------------------------------------------------------------------------------------------------------------
// TCX (Garmin Training Center) : les tours donnent le temps et la distance, les points l'altitude et la FC.

function lireActiviteTcx(texte: string, maintenant: number): LectureActivite {
  const a = vide();
  const sport = /<Activity\b[^>]*\bSport\s*=\s*["']([^"']+)["']/i.exec(texte);
  if (sport) a.type = /run/i.test(sport[1]) ? 'Run' : /bik/i.test(sport[1]) ? 'Ride' : null;

  let temps = 0;
  let metres = 0;
  let tours = 0;
  for (const m of texte.matchAll(/<Lap\b([^>]*)>([\s\S]*?)<\/Lap>/gi)) {
    if (++tours > 5000) break;
    if (!a.debut) {
      const s = /\bStartTime\s*=\s*["']([^"']+)["']/i.exec(m[1]);
      a.debut = s ? dateIso(s[1], maintenant) : null;
    }
    const t = nombre((/<TotalTimeSeconds>([^<]*)</i.exec(m[2]) || [])[1]);
    const d = nombre((/<DistanceMeters>([^<]*)</i.exec(m[2]) || [])[1]);
    if (t > 0) temps += t;
    if (d > 0) metres += d;
  }
  if (!tours) return { ok: false, erreur: 'Aucune activité exploitable dans ce fichier.' };

  const altitudes: number[] = [];
  const fcs: number[] = [];
  const pointsFlux: PointFlux[] = [];
  let derniere = 0;
  let points = 0;
  for (const m of texte.matchAll(/<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi)) {
    if (++points > POINTS_MAX) break;
    const alt = nombre((/<AltitudeMeters>([^<]*)</i.exec(m[1]) || [])[1]);
    if (alt > -500 && alt < 9000) altitudes.push(alt);
    const hr = nombre((/<HeartRateBpm\b[^>]*>\s*<Value>([^<]*)</i.exec(m[1]) || [])[1]);
    if (hr >= 30 && hr <= 250) fcs.push(hr);
    const dist = nombre((/<DistanceMeters>([^<]*)</i.exec(m[1]) || [])[1]);
    if (dist > derniere) derniere = dist;
    // Le point pour les flux (le temps est obligatoire dans un TCX : sans heure, on passe)
    const quand = dateIso((/<Time>([^<]*)</i.exec(m[1]) || [])[1], maintenant);
    if (!quand) continue;
    const lat = nombre((/<LatitudeDegrees>([^<]*)</i.exec(m[1]) || [])[1]);
    const lon = nombre((/<LongitudeDegrees>([^<]*)</i.exec(m[1]) || [])[1]);
    const p = pointVide(quand.getTime() / 1000);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      p.lat = lat;
      p.lon = lon;
    }
    p.alt = alt > -500 && alt < 9000 ? alt : null;
    p.fc = hr >= 30 && hr <= 250 ? hr : null;
    p.dist = dist >= 0 ? dist : null;
    pointsFlux.push(p);
  }
  a.flux = fluxDesPoints(pointsFlux, true);
  if (temps > 0) a.dureeS = Math.round(temps);
  const total = metres > 0 ? metres : derniere;
  if (total > 0) a.distanceKm = arrondi(total / 1000);
  if (altitudes.length) a.denivele = Math.round(denivelePositif(altitudes));
  a.fc = moyenne(fcs);
  return { ok: true, activite: a };
}

// ---------------------------------------------------------------------------------------------------------------------
// FIT (Garmin, Wahoo, Coros, Zwift…) : fichier binaire. On ne lit que les messages « session » (résumé de l'activité).

const FIT_EPOCH_S = 631065600; // 1989-12-31 00:00 UTC, en secondes Unix

function sportFit(sport: number | null, sous: number | null): string | null {
  if (sport === 1) return 'Run';
  if (sport === 2) return 'Ride';
  if (sport === 5) return 'Swim';
  if (sport === 15) return 'Triathlon';
  if (sport === 10 && sous === 20) return 'WeightTraining'; // « training » + musculation
  return null;
}

function lireActiviteFit(b: Uint8Array, maintenant: number): LectureActivite {
  const erreurFit: LectureActivite = { ok: false, erreur: 'Ce fichier FIT est illisible ou incomplet.' };
  if (b.length < 14) return erreurFit;
  const vue = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const entete = b[0];
  if (entete < 12 || entete > 32 || b[8] !== 0x2e || b[9] !== 0x46 || b[10] !== 0x49 || b[11] !== 0x54) return erreurFit; // « .FIT »
  const fin = Math.min(b.length - 2, entete + vue.getUint32(4, true)); // les deux derniers octets sont la somme de contrôle

  type Champ = { num: number; taille: number };
  const definitions = new Map<number, { global: number; petit: boolean; champs: Champ[]; taille: number }>();
  let pos = entete;
  let messages = 0;

  // Une valeur du fichier : 0xFF… (ou 0x7F… pour les entiers signés) veut dire « absent »
  const lire = (o: number, taille: number, petit: boolean, signe = false): number | null => {
    if (taille === 4) {
      const v = signe ? vue.getInt32(o, petit) : vue.getUint32(o, petit);
      return v === (signe ? 0x7fffffff : 0xffffffff) ? null : v;
    }
    if (taille === 2) {
      const v = signe ? vue.getInt16(o, petit) : vue.getUint16(o, petit);
      return v === (signe ? 0x7fff : 0xffff) ? null : v;
    }
    if (taille === 1) {
      const v = signe ? vue.getInt8(o) : b[o];
      return v === (signe ? 0x7f : 0xff) ? null : v;
    }
    return null;
  };

  // Résumé (session)
  let debut: number | null = null;
  let temps = 0;
  let ecoule = 0;
  let metres = 0;
  let montee: number | null = null;
  let fc: number | null = null;
  let sport: number | null = null;
  let sousSport: number | null = null;
  let sessions = 0;
  const ex: ExtrasImportes = { avg_watts: null, max_watts: null, np: null, max_heartrate: null, avg_cadence: null, calories: null, kj: null, avg_speed_kmh: null };

  // Points (records) et tours (laps)
  const points: PointFlux[] = [];
  const tours: TourImporte[] = [];
  let dernierTs = 0;

  while (pos < fin) {
    if (++messages > 2_000_000) return erreurFit;
    const h = b[pos++];
    let local: number;
    let compresse: number | null = null; // décalage de temps (5 bits) d'un en-tête compressé
    if (h & 0x80) {
      local = (h >> 5) & 0x03;
      compresse = h & 0x1f;
    } else if (h & 0x40) {
      // Définition d'un message : champs (numéro, taille, type) et champs de développeur (ignorés mais comptés)
      local = h & 0x0f;
      if (pos + 5 > fin) return erreurFit;
      pos++; // octet réservé
      const petit = b[pos++] === 0;
      const global = vue.getUint16(pos, petit);
      pos += 2;
      const n = b[pos++];
      if (pos + n * 3 > fin) return erreurFit;
      const champs: Champ[] = [];
      let taille = 0;
      for (let i = 0; i < n; i++) {
        champs.push({ num: b[pos], taille: b[pos + 1] });
        taille += b[pos + 1];
        pos += 3;
      }
      if (h & 0x20) {
        if (pos >= fin) return erreurFit;
        const nd = b[pos++];
        if (pos + nd * 3 > fin) return erreurFit;
        for (let i = 0; i < nd; i++) {
          taille += b[pos + 1];
          pos += 3;
        }
      }
      definitions.set(local, { global, petit, champs, taille });
      continue;
    } else {
      local = h & 0x0f;
    }
    const def = definitions.get(local);
    if (!def || pos + def.taille > fin) return erreurFit;

    if (def.global === 20) {
      // record : un point (position, FC, puissance…) ; les unités du FIT : semicercles, centimètres, mm/s, altitude décalée de 500 m par pas de 0,2 m
      if (points.length >= POINTS_MAX) return { ok: false, erreur: 'Cette activité contient trop de points.' };
      const p = pointVide(NaN);
      let altBasse: number | null = null;
      let vitBasse: number | null = null;
      let o = pos;
      for (const c of def.champs) {
        if (c.num === 253) p.t = lire(o, c.taille, def.petit) ?? NaN;
        else if (c.num === 0) { const v = lire(o, c.taille, def.petit, true); p.lat = v == null ? null : (v * 180) / 2 ** 31; }
        else if (c.num === 1) { const v = lire(o, c.taille, def.petit, true); p.lon = v == null ? null : (v * 180) / 2 ** 31; }
        else if (c.num === 2) { const v = lire(o, c.taille, def.petit); altBasse = v == null ? null : v / 5 - 500; }
        else if (c.num === 78) { const v = lire(o, c.taille, def.petit); p.alt = v == null ? null : v / 5 - 500; }
        else if (c.num === 3) p.fc = lire(o, c.taille, def.petit);
        else if (c.num === 4) p.cad = lire(o, c.taille, def.petit);
        else if (c.num === 5) { const v = lire(o, c.taille, def.petit); p.dist = v == null ? null : v / 100; }
        else if (c.num === 6) { const v = lire(o, c.taille, def.petit); vitBasse = v == null ? null : v / 1000; }
        else if (c.num === 73) { const v = lire(o, c.taille, def.petit); p.vit = v == null ? null : v / 1000; }
        else if (c.num === 7) p.w = lire(o, c.taille, def.petit);
        else if (c.num === 13) p.temp = lire(o, c.taille, def.petit, true);
        o += c.taille;
      }
      if (compresse != null && Number.isNaN(p.t)) {
        let t = (dernierTs & ~0x1f) + compresse;
        if (t < dernierTs) t += 32;
        p.t = t;
      }
      if (!Number.isNaN(p.t)) {
        dernierTs = p.t;
        if (p.alt == null) p.alt = altBasse;
        if (p.vit == null) p.vit = vitBasse;
        points.push(p);
      }
    } else if (def.global === 19) {
      // lap : un tour
      let elapsed = 0;
      let timer = 0;
      let dist = 0;
      let o = pos;
      for (const c of def.champs) {
        const v = lire(o, c.taille, def.petit);
        if (v != null) {
          if (c.num === 7) elapsed = v / 1000;
          else if (c.num === 8) timer = v / 1000;
          else if (c.num === 9) dist = v / 100;
        }
        o += c.taille;
      }
      if (tours.length < 5000) tours.push({ index: tours.length + 1, name: `Tour ${tours.length + 1}`, elapsed_time: Math.round(elapsed || timer), moving_time: Math.round(timer || elapsed), distance: Math.round(dist) });
    } else if (def.global === 18) {
      // session : le résumé de l'activité
      sessions++;
      let o = pos;
      for (const c of def.champs) {
        const v = lire(o, c.taille, def.petit);
        if (v != null) {
          if (c.num === 2 && debut == null && c.taille === 4) debut = (FIT_EPOCH_S + v) * 1000;
          else if (c.num === 5 && sport == null) sport = v;
          else if (c.num === 6 && sousSport == null) sousSport = v;
          else if (c.num === 7) ecoule += v / 1000;
          else if (c.num === 8) temps += v / 1000;
          else if (c.num === 9) metres += v / 100;
          else if (c.num === 22) montee = (montee ?? 0) + v;
          else if (c.num === 16 && fc == null && v >= 30 && v <= 250) fc = v;
          else if (c.num === 17 && v >= 30 && v <= 250) ex.max_heartrate = v;
          else if (c.num === 18 && v > 0 && v < 255) ex.avg_cadence = v;
          else if (c.num === 20 && v > 0) ex.avg_watts = v;
          else if (c.num === 21 && v > 0) ex.max_watts = v;
          else if (c.num === 34 && v > 0) ex.np = v;
          else if (c.num === 11 && v > 0) ex.calories = v;
          else if (c.num === 48 && v > 0) ex.kj = Math.round(v / 1000);
          else if (c.num === 124 && v > 0 && c.taille === 4) ex.avg_speed_kmh = arrondi((v / 1000) * 3.6, 1); // vitesse moyenne « enhanced » (mm/s)
          else if (c.num === 14 && v > 0 && ex.avg_speed_kmh == null) ex.avg_speed_kmh = arrondi((v / 1000) * 3.6, 1);
        }
        o += c.taille;
      }
    }
    pos += def.taille;
  }

  if (!sessions) return { ok: false, erreur: 'Aucune activité exploitable dans ce fichier.' };
  const a = vide();
  a.type = sportFit(sport, sousSport);
  a.debut = debut != null ? dateValide(new Date(debut), maintenant) : null;
  const duree = temps > 0 ? temps : ecoule;
  a.dureeS = duree > 0 ? Math.round(duree) : null;
  a.distanceKm = metres > 0 ? arrondi(metres / 1000) : null;
  a.denivele = montee;
  a.fc = fc;
  a.tours = tours;
  a.extras = Object.values(ex).some((v) => v != null) ? ex : null;
  a.flux = fluxDesPoints(points, true);
  return { ok: true, activite: a };
}

/** Les points du fichier → les flux au format de Strava. Un flux entièrement vide n'est pas gardé ; le temps part de zéro au premier point (et n'est pas écrit si le fichier n'a pas d'heures). */
function fluxDesPoints(points: PointFlux[], avecTemps: boolean): FluxImporte[] {
  if (points.length < 2) return [];
  const t0 = points[0].t;
  const un = (type: FluxImporte['type'], lire: (p: PointFlux) => number | null, decimales = 0): FluxImporte | null => {
    const data = points.map((p) => {
      const v = lire(p);
      return v == null ? null : arrondi(v, decimales);
    });
    return data.some((v) => v != null) ? { type, data } : null;
  };
  const latlng: FluxImporte | null = points.some((p) => p.lat != null && p.lon != null)
    ? { type: 'latlng', data: points.map((p) => (p.lat != null && p.lon != null ? [arrondi(p.lat, 6), arrondi(p.lon, 6)] : null)) as FluxImporte['data'] }
    : null;
  const liste = [
    avecTemps ? ({ type: 'time', data: points.map((p) => p.t - t0) } as FluxImporte) : null,
    un('distance', (p) => p.dist, 1),
    un('watts', (p) => p.w),
    un('heartrate', (p) => p.fc),
    un('cadence', (p) => p.cad),
    un('altitude', (p) => p.alt, 1),
    un('velocity_smooth', (p) => p.vit, 2),
    un('temp', (p) => p.temp),
    latlng,
  ];
  return liste.filter((f): f is FluxImporte => f != null);
}

// ---------------------------------------------------------------------------------------------------------------------

/** Lit un fichier choisi (octets) : le format est reconnu par son contenu, pas par son nom. Renvoie l'erreur (en français) si le fichier n'est pas exploitable. */
export function lireActivite(octets: Uint8Array, maintenant = Date.now()): LectureActivite {
  if (!octets.length) return { ok: false, erreur: 'Le fichier est vide.' };
  if (octets.length > TAILLE_MAX_IMPORT) return { ok: false, erreur: 'Le fichier est trop gros (5 Mo maximum).' };
  if (octets.length >= 12 && octets[8] === 0x2e && octets[9] === 0x46 && octets[10] === 0x49 && octets[11] === 0x54) return lireActiviteFit(octets, maintenant);
  const texte = new TextDecoder('utf-8').decode(octets);
  if (/<gpx[\s>]/i.test(texte)) return lireActiviteGpx(texte, maintenant);
  if (/<TrainingCenterDatabase[\s>]/i.test(texte)) return lireActiviteTcx(texte, maintenant);
  return { ok: false, erreur: 'Format non reconnu : choisis un fichier .fit, .gpx ou .tcx.' };
}

// ---------------------------------------------------------------------------------------------------------------------
// Du fichier au formulaire « Activité déjà faite » : l'écran d'import passe ces champs (tous en texte) à l'écran de saisie, qui les valide comme n'importe quelle saisie.

export const CHAMPS_IMPORT = ['type', 'heure', 'heures', 'minutes', 'distance', 'dplus', 'fc', 'nom'] as const;
export type ChampsImport = Partial<Record<(typeof CHAMPS_IMPORT)[number], string>>;

const deux = (n: number) => String(n).padStart(2, '0');

/** Le jour (AAAA-MM-JJ) et l'heure (HH:MM) locaux du début, et les champs à préremplir. Ce que le fichier ne dit pas reste absent (le formulaire garde sa valeur). */
export function versChamps(a: ActiviteImportee): { date: string | null; champs: ChampsImport } {
  const champs: ChampsImport = {};
  let date: string | null = null;
  if (a.type) champs.type = a.type;
  if (a.debut) {
    date = `${a.debut.getFullYear()}-${deux(a.debut.getMonth() + 1)}-${deux(a.debut.getDate())}`;
    champs.heure = `${deux(a.debut.getHours())}:${deux(a.debut.getMinutes())}`;
  }
  if (a.dureeS != null && a.dureeS >= 60 && a.dureeS < 100 * 3600) {
    const minutes = Math.round(a.dureeS / 60);
    champs.heures = String(Math.floor(minutes / 60));
    champs.minutes = String(minutes % 60);
  }
  if (a.distanceKm != null && a.distanceKm > 0) champs.distance = a.type === 'Swim' ? String(Math.round(a.distanceKm * 1000)) : String(a.distanceKm).replace('.', ',');
  if (a.denivele != null) champs.dplus = String(a.denivele);
  if (a.fc != null) champs.fc = String(a.fc);
  if (a.nom) champs.nom = nettoyer(a.nom);
  return { date, champs };
}

/** Relit les champs reçus par l'écran de saisie (paramètres de route, donc non fiables) : on ne garde que ceux qui ont la bonne forme. */
export function champsValides(brut: Record<string, unknown>, types: string[]): ChampsImport {
  const sortie: ChampsImport = {};
  const texte = (k: string) => (typeof brut[k] === 'string' ? (brut[k] as string) : '');
  if (types.includes(texte('type'))) sortie.type = texte('type');
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(texte('heure'))) sortie.heure = texte('heure');
  if (/^\d{1,2}$/.test(texte('heures'))) sortie.heures = texte('heures');
  if (/^\d{1,2}$/.test(texte('minutes'))) sortie.minutes = texte('minutes');
  if (/^\d{1,6}([.,]\d{1,2})?$/.test(texte('distance'))) sortie.distance = texte('distance');
  if (/^\d{1,5}$/.test(texte('dplus'))) sortie.dplus = texte('dplus');
  if (/^\d{2,3}$/.test(texte('fc'))) sortie.fc = texte('fc');
  if (texte('nom')) sortie.nom = nettoyer(texte('nom'));
  return sortie;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ce qui s'écrit avec l'activité : flux compressés (comme ceux de Strava), trace GPX, tours et chiffres de résumé.

export const FORMAT_FLUX = 'gzip+base64+json-array';
const FLUX_MAX = 8 * 1024 * 1024; // texte base64 : 8 Mo au plus

/** Les octets en base64 (par morceaux, sans dépendre de btoa). */
export function enBase64(octets: Uint8Array): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const morceaux: string[] = [];
  for (let i = 0; i < octets.length; i += 3) {
    const n = (octets[i] << 16) | ((octets[i + 1] ?? 0) << 8) | (octets[i + 2] ?? 0);
    morceaux.push(A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < octets.length ? A[(n >> 6) & 63] : '=') + (i + 2 < octets.length ? A[n & 63] : '='));
  }
  return morceaux.join('');
}

/** Les flux en JSON gzip + base64, au format de `activities.streams_gz`. Null s'il n'y a rien à garder ou si le résultat est trop gros. */
export function compresserFlux(flux: FluxImporte[]): string | null {
  if (!flux.length) return null;
  const texte = enBase64(gzipSync(new TextEncoder().encode(JSON.stringify(flux)), { level: 6 }));
  return texte.length <= FLUX_MAX ? texte : null;
}

const echapperXml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * La trace GPS en GPX (position, altitude, heure, FC), pour la carte et le parcours. Null sans position. Un très long parcours est allégé (un point sur n)
 * pour rester sous la limite de 5 Mo des GPX de l'app.
 */
export function gpxDepuisFlux(flux: FluxImporte[], debut: Date | null, nom: string): string | null {
  const donnees = (type: FluxImporte['type']) => flux.find((f) => f.type === type)?.data;
  const pos = donnees('latlng') as ([number, number] | null)[] | undefined;
  if (!pos) return null;
  const temps = donnees('time') as number[] | undefined;
  const alt = donnees('altitude') as (number | null)[] | undefined;
  const fc = donnees('heartrate') as (number | null)[] | undefined;
  const indices = pos.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  if (indices.length < 2) return null;
  const entete = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Rush" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\n<trk><name>${echapperXml(nom.slice(0, 120))}</name><trkseg>\n`;
  const pied = '</trkseg></trk>\n</gpx>\n';
  const ligne = (i: number): string => {
    const [lat, lon] = pos[i] as [number, number];
    const a = alt?.[i];
    const t = debut && temps ? new Date(debut.getTime() + temps[i] * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
    const h = fc?.[i];
    return `<trkpt lat="${lat}" lon="${lon}">${a != null ? `<ele>${a}</ele>` : ''}${t ? `<time>${t}</time>` : ''}${h != null ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${h}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''}</trkpt>`;
  };
  const toutes = indices.map(ligne);
  const total = toutes.reduce((n, l) => n + l.length + 1, 0);
  const pas = Math.max(1, Math.ceil(total / (TAILLE_MAX_GPX - 4096))); // on mesure la vraie taille, puis on garde un point sur `pas`
  const lignes = toutes.filter((_, k) => k % pas === 0);
  return entete + lignes.join('\n') + '\n' + pied;
}

/** Ce que l'import apporte en plus du formulaire, prêt pour la base (colonnes de `activities`). Les champs absents sont omis : une saisie à la main n'écrit rien de tout ça. */
export interface DonneesImport {
  streams_gz?: string;
  streams_format?: string;
  streams_synced_at?: string;
  gpx_content?: string;
  gpx_name?: string;
  lap_details?: TourImporte[];
  avg_watts?: number;
  max_watts?: number;
  np?: number;
  max_heartrate?: number;
  avg_cadence?: number;
  calories?: number;
  kj?: number;
  avg_speed_kmh?: number;
}

/** De l'activité lue aux colonnes à écrire en plus. `nomFichier` sert de nom à la trace. */
export function donneesAEcrire(a: ActiviteImportee, nomFichier: string, maintenant = new Date()): DonneesImport {
  const d: DonneesImport = {};
  const gz = compresserFlux(a.flux);
  if (gz) Object.assign(d, { streams_gz: gz, streams_format: FORMAT_FLUX, streams_synced_at: maintenant.toISOString() });
  const gpx = gpxDepuisFlux(a.flux, a.debut, a.nom || nomFichier);
  if (gpx && gpx.length <= TAILLE_MAX_GPX) Object.assign(d, { gpx_content: gpx, gpx_name: nettoyer(nomFichier) });
  if (a.tours.length) d.lap_details = a.tours;
  if (a.extras) for (const [k, v] of Object.entries(a.extras)) if (v != null) (d as Record<string, number>)[k] = v;
  return d;
}

const entier = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * Relit ce qu'on s'apprête à écrire avec l'activité : liste fermée de colonnes, formes et bornes vérifiées. Tout ce qui n'est pas prévu est écarté, rien n'est cru sur parole
 * (un fichier piégé ne peut pas écrire autre chose que ces colonnes-là).
 */
export function verifierDonneesImport(brut: unknown): { ok: true; donnees: DonneesImport } | { ok: false; erreur: string } {
  const refus = (m: string) => ({ ok: false as const, erreur: m });
  if (brut == null || typeof brut !== 'object') return refus("Données d'import invalides.");
  const b = brut as Record<string, unknown>;
  const d: DonneesImport = {};

  if (b.streams_gz !== undefined) {
    if (typeof b.streams_gz !== 'string' || !b.streams_gz || b.streams_gz.length > FLUX_MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.streams_gz)) return refus('Les flux importés sont invalides.');
    if (b.streams_format !== FORMAT_FLUX) return refus('Le format des flux importés est invalide.');
    const quand = typeof b.streams_synced_at === 'string' ? new Date(b.streams_synced_at) : null;
    if (!quand || Number.isNaN(quand.getTime())) return refus('La date des flux importés est invalide.');
    d.streams_gz = b.streams_gz;
    d.streams_format = FORMAT_FLUX;
    d.streams_synced_at = quand.toISOString();
  }
  if (b.gpx_content !== undefined) {
    if (typeof b.gpx_content !== 'string' || b.gpx_content.length > TAILLE_MAX_GPX || !/<gpx[\s>]/i.test(b.gpx_content)) return refus('Le parcours importé est invalide.');
    if (typeof b.gpx_name !== 'string' || b.gpx_name.length > 120) return refus('Le nom du parcours importé est invalide.');
    d.gpx_content = b.gpx_content;
    d.gpx_name = b.gpx_name;
  }
  if (b.lap_details !== undefined) {
    if (!Array.isArray(b.lap_details) || b.lap_details.length > 5000) return refus('Les tours importés sont invalides.');
    const tours: TourImporte[] = [];
    for (const t of b.lap_details as Record<string, unknown>[]) {
      if (!t || typeof t !== 'object' || !entier(t.index, 1, 5000) || typeof t.name !== 'string' || t.name.length > 60) return refus('Les tours importés sont invalides.');
      if (!entier(t.elapsed_time, 0, 1_000_000) || !entier(t.moving_time, 0, 1_000_000) || !entier(t.distance, 0, 10_000_000)) return refus('Les tours importés sont invalides.');
      tours.push({ index: t.index, name: nettoyer(t.name, 60), elapsed_time: t.elapsed_time, moving_time: t.moving_time, distance: t.distance });
    }
    d.lap_details = tours;
  }
  const bornes: [keyof DonneesImport, number, number][] = [
    ['avg_watts', 1, 3000], ['max_watts', 1, 5000], ['np', 1, 3000], ['max_heartrate', 30, 250], ['avg_cadence', 1, 255], ['calories', 1, 30000], ['kj', 1, 100000],
  ];
  for (const [k, min, max] of bornes) {
    if (b[k] === undefined) continue;
    if (!entier(b[k], min, max)) return refus(`La valeur importée « ${k} » est invalide.`);
    (d as Record<string, number>)[k] = b[k] as number;
  }
  if (b.avg_speed_kmh !== undefined) {
    if (typeof b.avg_speed_kmh !== 'number' || !(b.avg_speed_kmh > 0 && b.avg_speed_kmh <= 300)) return refus('La vitesse moyenne importée est invalide.');
    d.avg_speed_kmh = b.avg_speed_kmh;
  }
  return { ok: true, donnees: d };
}
