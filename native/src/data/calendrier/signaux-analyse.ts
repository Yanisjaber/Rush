import type { FluxBruts } from '../outils/courbes-sortie.ts';
import type { MesureZones } from '../outils/repartition-zones.ts';

// Les chiffres qu'on envoie au coach pour qu'il analyse UNE sortie (page 4). Que des nombres et un type de séance fermé : jamais le nom de la sortie
// ni ses notes (le serveur ne les veut pas, et rien d'externe ne doit finir dans la consigne du modèle). Fonctions pures : aucun écran, aucun réseau.
// Le serveur relit chaque nombre (bornes) : voir supabase/functions/_shared/analyse-sortie.ts (lireSignaux).

export type TypeSeance = 'footing' | 'fractionne' | 'longue' | 'competition' | 'autre';

export interface SignauxAnalyse {
  type: TypeSeance;
  /** Allure de chaque kilomètre complet (secondes par km), course seulement. */
  allures_km?: number[];
  /** Cœur moyen de chaque kilomètre (bpm), même longueur ; seulement si chaque km en a un. */
  fc_km?: number[];
  fc_max?: number;
  derive_pct?: number;
  /** Part du temps dans chacune des 5 zones de cœur, en %. */
  zones_pct?: number[];
  zones_estimees?: boolean;
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Le type de la séance, deviné d'après son nom (le nom reste ici : il n'est jamais envoyé) et, à défaut, sa durée.
 * Une sortie de plus d'1 h 30 sans autre indice est une sortie longue.
 */
export function typeDeSeance(nom: string | null | undefined, dureeS: number | null | undefined): TypeSeance {
  const n = sansAccent(String(nom ?? ''));
  if (/\b(fraction|vma|interval|serie|series|fartlek|pyramide|cotes?|cote)\b|\d\s*x\s*\d/.test(n)) return 'fractionne';
  if (/\b(competition|course|race|10\s?k|5\s?k|semi|marathon|trail)\b|\b(10|5)\s?km\b/.test(n)) return 'competition';
  if (/\b(sortie longue|longue|sl)\b/.test(n)) return 'longue';
  if (/\b(footing|ef|endurance|recup|recuperation|facile|decrassage|reprise)\b/.test(n)) return 'footing';
  return Number(dureeS) >= 5400 ? 'longue' : 'autre';
}

/** Le plus grand nombre de kilomètres complets lus (garde-fou : le serveur en accepte 100). */
const KM_MAX = 100;
/** Sous cette vitesse (m/s, 2,2 km/h), le point est un arrêt. */
const VITESSE_ARRET = 0.6;

/**
 * Allure et cœur de chaque kilomètre complet, tirés des flux (temps, vitesse, cœur). La distance se reconstitue en sommant vitesse × temps ;
 * une pause (écart plus grand que 3 fois l'écart habituel) ne compte ni dans la durée ni dans la distance. Null sans flux de vitesse exploitable.
 */
export function kilometres(brut: FluxBruts | null | undefined): { allures: number[]; fc: number[] | null } | null {
  const t = brut?.temps;
  const v = brut?.vitesse;
  if (!t || !v || t.length !== v.length || t.length < 30) return null;
  const n = t.length;
  const ecarts = t.slice(1).map((x, i) => x - t[i]).filter((e) => e > 0);
  if (!ecarts.length) return null;
  const mediane = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)];
  const fc = brut?.fc && brut.fc.length === n ? brut.fc : null;

  const allures: number[] = [];
  const fcs: number[] = [];
  let dist = 0; // mètres cumulés
  let duree = 0; // secondes de mouvement cumulées
  let kmDebutDuree = 0;
  let fcSomme = 0;
  let fcTemps = 0;
  let fcManque = false;
  for (let i = 0; i < n - 1 && allures.length < KM_MAX; i++) {
    const dt = Math.min(Math.max(0, t[i + 1] - t[i]), mediane * 3);
    const vit = Number.isFinite(v[i]) && v[i] > VITESSE_ARRET ? v[i] : 0;
    if (dt <= 0) continue;
    const pas = vit * dt;
    // Le point qui franchit le kilomètre : on place le franchissement à la fraction de pas qu'il faut
    let reste = pas;
    let dtReste = dt;
    while (reste > 0 && Math.floor((dist + reste) / 1000) > Math.floor(dist / 1000) && allures.length < KM_MAX) {
      const versBorne = (Math.floor(dist / 1000) + 1) * 1000 - dist;
      const part = versBorne / pas;
      const dtPart = dt * part;
      const finDuree = duree + (dt - dtReste) + dtPart;
      allures.push(finDuree - kmDebutDuree);
      if (fc) fcs.push(fcTemps > 0 && !fcManque ? fcSomme / fcTemps : 0);
      kmDebutDuree = finDuree;
      fcSomme = 0;
      fcTemps = 0;
      fcManque = false;
      dist += versBorne;
      reste -= versBorne;
      dtReste = dt - (dt - dtReste) - dtPart;
    }
    dist += reste;
    duree += dt;
    if (fc && vit > 0) {
      const c = fc[i];
      if (Number.isFinite(c) && c >= 30 && c <= 230) {
        fcSomme += c * dt;
        fcTemps += dt;
      } else fcManque = true;
    }
  }
  if (allures.length < 2) return null;
  return { allures: allures.map((s) => Math.round(s)), fc: fc && fcs.length === allures.length && fcs.every((x) => x > 0) ? fcs.map((x) => Math.round(x)) : null };
}

/** Le temps par zone de cœur ramené à 5 zones (la zone 5 regroupe 5a, 5b et 5c), en % ; null sans zones. */
export function zonesSurCinq(mesure: MesureZones | undefined): number[] | null {
  if (!mesure || mesure.zones.length < 5) return null;
  const total = mesure.zones.reduce((n, z) => n + z.secondes, 0);
  if (!(total > 0)) return null;
  const parts = mesure.zones.map((z) => (z.secondes / total) * 100);
  const cinq = [parts[0], parts[1], parts[2], parts[3], parts.slice(4).reduce((a, b) => a + b, 0)];
  return cinq.map((x) => Math.round(x * 10) / 10);
}

export interface EntreeSignaux {
  nom: string | null;
  dureeS: number | null;
  famille: 'course' | 'velo';
  brut: FluxBruts | null | undefined;
  derivePct: number | null;
  mesureCoeur: MesureZones | undefined;
  /** La FC de référence des zones est estimée (pas saisie dans le profil). */
  zonesEstimees: boolean;
}

export function signauxAnalyse(e: EntreeSignaux): SignauxAnalyse {
  const s: SignauxAnalyse = { type: typeDeSeance(e.nom, e.dureeS) };
  if (e.famille === 'course') {
    const km = kilometres(e.brut);
    if (km) {
      s.allures_km = km.allures;
      if (km.fc) s.fc_km = km.fc;
    }
  }
  const fcs = (e.brut?.fc ?? []).filter((c) => Number.isFinite(c) && c >= 80 && c <= 230);
  if (fcs.length > 20) s.fc_max = Math.round(Math.max(...fcs));
  if (e.derivePct != null && Number.isFinite(e.derivePct) && e.derivePct >= -30 && e.derivePct <= 60) s.derive_pct = e.derivePct;
  const zones = zonesSurCinq(e.mesureCoeur);
  if (zones) {
    s.zones_pct = zones;
    if (e.zonesEstimees) s.zones_estimees = true;
  }
  return s;
}
