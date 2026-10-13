// Parcours GPX : lecture sécurisée, statistiques, profil d'altitude et détection des montées. Fonctions pures, sans DOM ni réseau.
//
// Le fichier vient de l'utilisateur : on le traite comme non fiable. Lecture par motifs simples et bornés (pas d'interprétation XML
// complète, donc aucune entité externe ni expansion possible), taille limitée, coordonnées vérifiées. Rien n'est jamais inséré comme HTML.

export const TAILLE_MAX_GPX = 5 * 1024 * 1024; // 5 Mo
const POINTS_MAX = 300000;

const nombre = (v) => {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
};
const nettoyer = (t, max = 120) =>
  String(t || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Lit un fichier GPX (texte). Renvoie { points: [{ lat, lon, ele }], nom, erreur }.
 * `ele` vaut null si le point n'a pas d'altitude. Cherche les points de trace (trkpt), sinon de route (rtept), sinon de repère (wpt).
 */
export function lireGpx(texte) {
  const brut = typeof texte === 'string' ? texte : '';
  if (!brut) return { points: [], nom: '', erreur: 'Le fichier est vide.' };
  if (brut.length > TAILLE_MAX_GPX) return { points: [], nom: '', erreur: 'Le fichier est trop gros (5 Mo maximum).' };
  if (!/<gpx[\s>]/i.test(brut)) return { points: [], nom: '', erreur: "Ce fichier n'est pas un GPX." };

  const lire = (balise) => {
    const points = [];
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
const rad = (d) => (d * Math.PI) / 180;
/** Distance entre deux points en km (formule de haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Profil : un point par point GPX avec le kilomètre cumulé : [{ km, ele, lat, lon }]. Les altitudes absentes sont reprises du point précédent. */
export function profil(points) {
  const sortie = [];
  let km = 0;
  let derniereEle = points.find((p) => p.ele != null)?.ele ?? null;
  points.forEach((p, i) => {
    if (i > 0) km += distanceKm(points[i - 1], p);
    if (p.ele != null) derniereEle = p.ele;
    sortie.push({ km, ele: derniereEle, lat: p.lat, lon: p.lon });
  });
  return sortie;
}

/** Dénivelé positif et négatif « intelligent » : on ne compte un changement que s'il dépasse 3 m (filtre le bruit du GPS). */
export function denivele(serie, seuil = 3) {
  const alt = serie.map((p) => p.ele).filter((e) => e != null);
  if (alt.length < 2) return { gain: 0, perte: 0 };
  let gain = 0;
  let perte = 0;
  let reference = alt[0];
  for (let i = 1; i < alt.length; i++) {
    const d = alt[i] - reference;
    if (d > seuil) {
      gain += d;
      reference = alt[i];
    } else if (d < -seuil) {
      perte -= d;
      reference = alt[i];
    }
  }
  return { gain, perte };
}

/** Pente (en %) autour d'un point, sur une fenêtre d'environ 200 m. */
function penteAutour(serie, i, fenetreKm = 0.2) {
  let a = i;
  let b = i;
  // Au moins un voisin de chaque côté, même si les points sont plus espacés que la fenêtre
  while (a > 0 && (a === i || serie[i].km - serie[a - 1].km < fenetreKm / 2)) a--;
  while (b < serie.length - 1 && (b === i || serie[b + 1].km - serie[i].km < fenetreKm / 2)) b++;
  const dx = (serie[b].km - serie[a].km) * 1000;
  return dx > 0 && serie[a].ele != null && serie[b].ele != null ? ((serie[b].ele - serie[a].ele) / dx) * 100 : 0;
}

/**
 * Statistiques du parcours (ou d'une portion entre deux kilomètres) : { distanceKm, gain, perte, penteMoy, penteMax, penteMin, altMin, altMax, altDebut, altFin }.
 * Renvoie null s'il n'y a pas assez de points. `laps` répète le parcours (tours d'un circuit) pour la distance et le dénivelé.
 */
export function statistiques(serie, kmMin = 0, kmMax = Infinity, laps = 1) {
  const part = serie.filter((p) => p.km >= kmMin && p.km <= kmMax);
  if (part.length < 2) return null;
  const tours = Math.max(1, Math.round(laps) || 1);
  const { gain, perte } = denivele(part);
  const avecEle = part.filter((p) => p.ele != null);
  const dist = part[part.length - 1].km - part[0].km;
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < part.length; i++) {
    const s = penteAutour(part, i);
    if (s > max) max = s;
    if (s < min) min = s;
  }
  const debut = avecEle[0]?.ele ?? null;
  const fin = avecEle[avecEle.length - 1]?.ele ?? null;
  return {
    distanceKm: dist * tours,
    gain: gain * tours,
    perte: perte * tours,
    penteMoy: dist > 0 && debut != null && fin != null ? ((fin - debut) / (dist * 1000)) * 100 : 0,
    penteMax: Number.isFinite(max) ? max : 0,
    penteMin: Number.isFinite(min) ? min : 0,
    altMin: avecEle.length ? Math.min(...avecEle.map((p) => p.ele)) : null,
    altMax: avecEle.length ? Math.max(...avecEle.map((p) => p.ele)) : null,
    altDebut: debut,
    altFin: fin,
  };
}

/** Réduit une série à `cible` points au plus en gardant un point sur n (le premier et le dernier sont toujours gardés). */
export function reduire(serie, cible = 400) {
  if (serie.length <= cible) return serie;
  const pas = (serie.length - 1) / (cible - 1);
  return Array.from({ length: cible }, (_, i) => serie[Math.round(i * pas)]);
}

/**
 * Montées : [{ debutKm, finKm, distanceKm, gain, pente, altDebut, altFin }], dans l'ordre du parcours.
 * Une montée est une section qui gagne au moins 30 m, longue d'au moins 400 m, avec une pente moyenne d'au moins 3 %. Deux montées séparées par
 * une courte descente (moins de 15 % du gain) sont fusionnées. La série est d'abord simplifiée (extrémums relevés au seuil de 8 m).
 */
export function detecterMontees(serie) {
  const pts = serie.filter((p) => p.ele != null);
  if (pts.length < 3) return [];
  // 1) extrémums (creux et sommets) : on ne retient un changement de sens que s'il dépasse 8 m
  const SEUIL = 8;
  const ext = [];
  let sens = 0; // 0 = pas encore de direction, +1 = on monte, -1 = on descend
  let bas = pts[0];
  let haut = pts[0];
  let cand = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (sens === 0) {
      if (p.ele <= bas.ele) bas = p; // sur un plateau, le creux est le DERNIER point plat (début réel de la montée)
      if (p.ele >= haut.ele) haut = p;
      if (p.ele - bas.ele >= SEUIL) {
        ext.push(bas);
        sens = 1;
        cand = p;
      } else if (haut.ele - p.ele >= SEUIL) {
        ext.push(haut);
        sens = -1;
        cand = p;
      }
    } else if (sens === 1) {
      if (p.ele >= cand.ele) cand = p;
      else if (cand.ele - p.ele >= SEUIL) {
        ext.push(cand);
        sens = -1;
        cand = p;
      }
    } else if (p.ele <= cand.ele) cand = p;
    else if (p.ele - cand.ele >= SEUIL) {
      ext.push(cand);
      sens = 1;
      cand = p;
    }
  }
  ext.push(cand);
  // 2) segments montants entre un creux et le sommet suivant
  let montees = [];
  for (let i = 0; i < ext.length - 1; i++) {
    if (ext[i + 1].ele > ext[i].ele) montees.push({ debutKm: ext[i].km, finKm: ext[i + 1].km, altDebut: ext[i].ele, altFin: ext[i + 1].ele });
  }
  // 3) fusion de montées séparées par une courte descente
  const fusion = [];
  for (const m of montees) {
    const d = fusion[fusion.length - 1];
    if (d && m.altDebut < d.altFin) {
      const descente = d.altFin - m.altDebut;
      const gainD = d.altFin - d.altDebut;
      if (descente < 0.15 * gainD) {
        d.finKm = m.finKm;
        d.altFin = Math.max(d.altFin, m.altFin);
        continue;
      }
    }
    fusion.push({ ...m });
  }
  montees = fusion;
  return montees
    .map((m) => {
      const distance = m.finKm - m.debutKm;
      const gain = m.altFin - m.altDebut;
      return { debutKm: m.debutKm, finKm: m.finKm, distanceKm: distance, gain, pente: distance > 0 ? (gain / (distance * 1000)) * 100 : 0, altDebut: m.altDebut, altFin: m.altFin };
    })
    .filter((m) => m.gain >= 30 && m.distanceKm >= 0.4 && m.pente >= 3);
}

/** Texte d'une pente : « +5,2 % ». */
export const textePente = (p) => `${p >= 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')} %`;
