// Analyse avancée d'une sortie à partir de sa courbe de puissance (une valeur par seconde) : séquences, meilleures puissances, W'bal.
// Fonctions pures, sans DOM ni réseau.
import { normaliser } from './structure.js';

const propre = (watts) => (watts || []).map((v) => (v == null || Number.isNaN(Number(v)) ? 0 : Math.max(0, Number(v))));

/** Sommes cumulées d'une série (pour moyenner n'importe quelle fenêtre en un calcul). */
function cumul(valeurs) {
  const c = new Float64Array(valeurs.length + 1);
  for (let i = 0; i < valeurs.length; i++) c[i + 1] = c[i] + valeurs[i];
  return c;
}

/** Meilleure puissance moyenne sur `duree` secondes dans toute la série (0 si la série est plus courte). */
function meilleureMoyenne(c, n, duree) {
  if (duree > n || duree < 1) return 0;
  let meilleur = 0;
  for (let t = 0; t + duree <= n; t++) {
    const m = (c[t + duree] - c[t]) / duree;
    if (m > meilleur) meilleur = m;
  }
  return meilleur;
}

/** Durées proposées pour les meilleures puissances : 5 s, 30 s, 1, 5, 10, 20 et 60 min. */
export const DUREES_RECORDS = [5, 30, 60, 300, 600, 1200, 3600];

/** Meilleures puissances moyennes par durée : [{ duree (s), watts }] ; les durées plus longues que la sortie sont omises. */
export function meilleuresPuissances(watts, durees = DUREES_RECORDS) {
  const w = propre(watts);
  const c = cumul(w);
  return durees.filter((d) => d <= w.length).map((d) => ({ duree: d, watts: Math.round(meilleureMoyenne(c, w.length, d)) }));
}

/** « 5 s », « 30 s », « 1 min », « 20 min », « 1 h ». */
export function texteDuree(s) {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

/** Position d'une valeur du jour parmi les records : 'record' (≥ tout-temps), 'proche' (≥ 95 %), ou null. */
export function statutRecord(valeur, recordTout) {
  if (!(valeur > 0) || !(recordTout > 0)) return null;
  if (valeur >= recordTout) return 'record';
  return valeur >= recordTout * 0.95 ? 'proche' : null;
}

// --- Séquences ------------------------------------------------------------------------------------------------------------

const NOMS_ZONE = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VO2max', 'Anaérobie', 'Sprint'];
const zoneDe = (w, ftp) => {
  const p = (w / ftp) * 100;
  if (p < 55) return 0;
  if (p < 76) return 1;
  if (p < 91) return 2;
  if (p < 106) return 3;
  if (p < 121) return 4;
  if (p < 151) return 5;
  return 6;
};

/** Moyenne glissante sur ±demi secondes. */
function lisser(valeurs, demi) {
  const n = valeurs.length;
  const c = cumul(valeurs);
  return valeurs.map((_, i) => {
    const a = Math.max(0, i - demi);
    const b = Math.min(n, i + demi + 1);
    return (c[b] - c[a]) / (b - a);
  });
}

/**
 * Détecte les blocs d'une sortie à partir de la puissance, au format des séances structurées (voir structure.js) : chaque bloc est un
 * segment de zone constante, à sa vraie durée. Heuristique approximative (méthode historique) :
 *  1. lissage léger, puis découpage en paquets de 5 s classés par zone ;
 *  2. les paquets consécutifs de même zone forment des segments ;
 *  3. les segments trop courts (moins de 10 s en sprint, 45 s sinon) sont absorbés par le voisin de puissance la plus proche ;
 *  4. les blocs voisins de même zone sont fusionnés, puis nommés (échauffement, retour au calme, sprint, zone).
 * Renvoie [] si la sortie fait moins de 3 minutes ou si la FTP manque.
 */
export function detecterSequences(watts, ftp) {
  const f = Number(ftp) > 0 ? Number(ftp) : 0;
  const brut = propre(watts);
  const n = brut.length;
  if (!f || n < 180) return [];
  const lisse = lisser(brut, 2);

  const PAS = 5;
  const paquets = [];
  for (let s = 0; s < n; s += PAS) {
    const fin = Math.min(n, s + PAS);
    let somme = 0;
    for (let k = s; k < fin; k++) somme += lisse[k];
    paquets.push({ duree: fin - s, somme });
  }
  const fusionner = (liste) => {
    const sortie = [];
    for (const g of liste) {
      const dernier = sortie[sortie.length - 1];
      const z = zoneDe(g.somme / g.duree, f);
      if (dernier && dernier.z === z) {
        dernier.duree += g.duree;
        dernier.somme += g.somme;
      } else sortie.push({ z, duree: g.duree, somme: g.somme });
    }
    for (const s of sortie) {
      s.w = s.somme / Math.max(1, s.duree);
      s.z = zoneDe(s.w, f);
    }
    return sortie;
  };
  let segments = fusionner(paquets);

  // Absorption des segments trop courts : le plus court d'abord, dans le voisin de puissance la plus proche
  const dureeMini = (s) => ((s.w / f) * 100 >= 170 ? 10 : 45);
  for (let garde = 0; segments.length > 1 && garde < 5000; garde++) {
    let cible = -1;
    let plusCourt = Infinity;
    segments.forEach((s, i) => {
      if (s.duree < dureeMini(s) && s.duree < plusCourt) {
        plusCourt = s.duree;
        cible = i;
      }
    });
    if (cible === -1) break;
    const avant = segments[cible - 1];
    const apres = segments[cible + 1];
    const vers = !avant ? apres : !apres ? avant : Math.abs(avant.w - segments[cible].w) <= Math.abs(apres.w - segments[cible].w) ? avant : apres;
    if (!vers) break;
    vers.duree += segments[cible].duree;
    vers.somme += segments[cible].somme;
    segments.splice(cible, 1);
    segments = fusionner(segments);
  }
  if (!segments.length) return [];

  // Un segment = un bloc ; puis fusion des blocs voisins de même zone (durée additive, puissance moyenne pondérée)
  let blocs = segments.map((g) => ({ duree: g.duree, pct: Math.round((g.w / f) * 100) }));
  blocs = blocs.filter((b) => b.duree >= (b.pct >= 170 ? 10 : 45));
  const fusionnes = [];
  for (const b of blocs) {
    const dernier = fusionnes[fusionnes.length - 1];
    if (dernier && zoneDe((dernier.pct * f) / 100, f) === zoneDe((b.pct * f) / 100, f)) {
      const total = dernier.duree + b.duree;
      dernier.pct = Math.round((dernier.pct * dernier.duree + b.pct * b.duree) / total);
      dernier.duree = total;
    } else fusionnes.push({ ...b });
  }

  const bruts = fusionnes.map((b, i) => {
    const z = zoneDe((b.pct * f) / 100, f);
    let nom = NOMS_ZONE[z] || 'Bloc';
    if (i === 0 && z <= 2) nom = 'Échauffement';
    else if (i === fusionnes.length - 1 && z <= 2) nom = 'Retour au calme';
    else if (z >= 4 && b.duree <= 50) nom = 'Sprint';
    return { type: 'steady', name: nom, reps: 1, metric: 'power', unit: 'pct', work: { min: Math.round((b.duree / 60) * 100) / 100, int: b.pct, intHi: null } };
  });
  return normaliser(bruts, 'power');
}

// --- W'bal ----------------------------------------------------------------------------------------------------------------

/**
 * Estime la puissance critique (watts) et W' (joules) d'une sortie par régression sur ses meilleures puissances (2 à 20 min) :
 * P(t) = CP + W'/t. Fiable seulement si la sortie contient un effort assez dur ; sinon renvoie null.
 */
export function estimerCpWprime(watts, ftp) {
  const w = propre(watts);
  const f = Number(ftp) > 0 ? Number(ftp) : 250;
  const c = cumul(w);
  const n = w.length;
  const meilleur = (d) => meilleureMoyenne(c, n, d);
  const dur = meilleur(300) >= f * 0.86 || meilleur(60) >= f * 1.15 || meilleur(1200) >= f * 0.84;
  if (!dur) return null;
  const durees = [120, 180, 240, 300, 420, 600, 720, 900, 1200].filter((d) => d <= n);
  if (durees.length < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const d of durees) {
    const x = 1 / d;
    const y = meilleur(d);
    sx += x; sy += y; sxy += x * y; sxx += x * x;
  }
  const k = durees.length;
  const pente = (k * sxy - sx * sy) / (k * sxx - sx * sx);
  const origine = (sy - pente * sx) / k;
  if (!Number.isFinite(origine) || origine <= 0 || !Number.isFinite(pente) || pente <= 0) return null;
  return { cp: Math.round(origine), wprime: Math.round(pente) };
}

/**
 * W'bal : réserve de travail au-dessus de la puissance critique, seconde par seconde (modèle de Skiba).
 * Au-dessus de CP on puise dans W' ; en dessous, W' se reconstitue avec une constante de temps qui dépend de l'écart moyen sous CP.
 *  watts : puissance par seconde · cp : watts · wprime : joules
 * Renvoie { serie (joules restants à chaque seconde), minimum, epuisement (joules puisés au plus fort), pctEpuise (0 à 100) } ou null.
 */
export function wbal(watts, cp, wprime) {
  const w = propre(watts);
  const CP = Number(cp);
  const WP = Number(wprime);
  if (!w.length || !(CP > 0) || !(WP > 0)) return null;
  let somme = 0;
  let nb = 0;
  for (const v of w) if (v < CP) { somme += v; nb++; }
  const ecart = nb ? CP - somme / nb : 0;
  const tau = 546 * Math.exp(-0.01 * ecart) + 316;
  const recup = 1 - Math.exp(-1 / tau);
  let bal = WP;
  let minimum = WP;
  const serie = new Array(w.length);
  for (let i = 0; i < w.length; i++) {
    if (w[i] > CP) bal -= w[i] - CP;
    else bal += (WP - bal) * recup;
    if (bal > WP) bal = WP;
    if (bal < minimum) minimum = bal;
    serie[i] = bal;
  }
  const epuisement = Math.min(WP, WP - minimum);
  return { serie, minimum, epuisement, pctEpuise: Math.min(100, Math.round((Math.max(0, WP - minimum) / WP) * 100)) };
}
