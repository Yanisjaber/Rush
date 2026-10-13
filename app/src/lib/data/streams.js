// Streams d'une séance (courbes seconde par seconde) : décodage, réduction, zones.
// Format stocké en base (activities.streams_gz) : base64(gzip(JSON)), où le JSON est soit un tableau
// [{ type, data }], soit un objet { type: { data } } ou { type: [...] } (voir strava-streams).

/** Décompresse une chaîne base64(gzip(JSON)) en objet JavaScript. */
export async function decoderStreams(base64) {
  const bin = atob(base64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  const flux = new DecompressionStream('gzip');
  const ecrivain = flux.writable.getWriter();
  ecrivain.write(octets);
  ecrivain.close();
  const texte = await new Response(flux.readable).text();
  return JSON.parse(texte);
}

/** Valeurs d'un type de stream (« watts », « heartrate », « altitude »…), ou null s'il n'existe pas. */
export function extraireStream(streams, type) {
  if (!streams) return null;
  let brut = null;
  if (Array.isArray(streams)) {
    const s = streams.find((x) => x && x.type === type);
    brut = s ? s.data : null;
  } else if (Object.hasOwn(streams, type)) {
    const s = streams[type];
    brut = Array.isArray(s) ? s : s && Array.isArray(s.data) ? s.data : null;
  }
  return Array.isArray(brut) && brut.length ? brut : null;
}

/**
 * Réduit une série à `cible` points en moyennant des paquets de valeurs voisines.
 * Les séances de plusieurs heures ont des dizaines de milliers de points : inutile (et lent) de tout tracer.
 */
export function reduire(valeurs, cible = 300) {
  if (!valeurs) return [];
  if (valeurs.length <= cible) return valeurs.map((v) => (v == null || Number.isNaN(v) ? null : v));
  const pas = valeurs.length / cible;
  const sortie = new Array(cible);
  for (let i = 0; i < cible; i++) {
    const debut = Math.floor(i * pas);
    const fin = Math.min(valeurs.length, Math.floor((i + 1) * pas));
    let somme = 0;
    let n = 0;
    for (let j = debut; j < fin; j++) {
      const v = valeurs[j];
      if (v != null && !Number.isNaN(v)) {
        somme += v;
        n++;
      }
    }
    sortie[i] = n ? somme / n : null;
  }
  return sortie;
}

/** Moyenne et maximum d'une série (valeurs absentes ignorées). */
export function statistiques(valeurs) {
  let somme = 0;
  let n = 0;
  let max = -Infinity;
  for (const v of valeurs || []) {
    if (v == null || Number.isNaN(v)) continue;
    somme += v;
    n++;
    if (v > max) max = v;
  }
  return n ? { moyenne: somme / n, max } : null;
}

// --- Zones d'intensité ---------------------------------------------------------------------------------------------
// Les zones ne sont jamais stockées : elles sont recalculées à l'affichage à partir de la FTP et de la FC au seuil (zones cardio : voir profil.js).

/** Zones de puissance (modèle de Coggan) en pourcentage de la FTP : [borne basse incluse, borne haute exclue]. */
export const ZONES_PUISSANCE = [
  { nom: 'Z1 Récupération', min: 0, max: 0.55 },
  { nom: 'Z2 Endurance', min: 0.55, max: 0.75 },
  { nom: 'Z3 Tempo', min: 0.75, max: 0.9 },
  { nom: 'Z4 Seuil', min: 0.9, max: 1.05 },
  { nom: 'Z5 VO2max', min: 1.05, max: 1.2 },
  { nom: 'Z6 Anaérobie', min: 1.2, max: 1.5 },
  { nom: 'Z7 Sprint', min: 1.5, max: Infinity },
];

/**
 * Temps passé dans chaque zone. `valeurs` : une valeur par seconde ; `reference` : FTP ou FC au seuil.
 * Renvoie [{ nom, secondes, part }] (part entre 0 et 1), ou null sans données ni référence.
 */
export function tempsParZone(valeurs, reference, zones) {
  if (!valeurs || !valeurs.length || !(reference > 0)) return null;
  const secondes = new Array(zones.length).fill(0);
  let total = 0;
  for (const v of valeurs) {
    if (v == null || Number.isNaN(v)) continue;
    const ratio = v / reference;
    const i = zones.findIndex((z) => ratio >= z.min && ratio < z.max);
    if (i >= 0) {
      secondes[i]++;
      total++;
    }
  }
  if (!total) return null;
  return zones.map((z, i) => ({ nom: z.nom, secondes: secondes[i], part: secondes[i] / total }));
}
