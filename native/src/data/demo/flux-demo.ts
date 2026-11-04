// Les STREAMS d'une séance de la démo : le temps, la distance, la vitesse, la fréquence cardiaque, la puissance, la cadence et l'altitude, seconde par seconde, générés de façon déterministe
// (le même identifiant de séance donne toujours les mêmes courbes). Ce ne sont pas des courbes décoratives : ils suivent un modèle de l'effort (vélo : la physique de la puissance, du poids, de la pente
// et de l'air ; course : un profil d'allure par type de séance ; natation : des longueurs de 25 m et des repos ; muscu et Hyrox : des séries et des stations) et sont recalés sur les chiffres de la séance
// (durée, distance, dénivelé, cardio moyen, puissance moyenne) : les moyennes d'un stream sont celles de la fiche. À partir d'eux, la démo calcule les mêmes courbes que le serveur (courbes-demo.ts).
// Les chiffres d'une séance qui n'en a pas (cardio, puissance, FTP) se déduisent du même modèle : voir `completerSeance`.
import type { Seance } from '../types.ts';
import { familleAffichage } from '../sports/familles.ts';

export interface Flux {
  /** Les secondes depuis le début (0, 1, 2… à 1 point par seconde ; 0, 5, 10… avec un pas de 5 s). */
  time: number[];
  /** La distance cumulée en mètres. */
  distance: number[];
  /** La vitesse en m/s. */
  velocity_smooth: number[];
  heartrate: number[];
  /** La puissance (W) : seulement à vélo. */
  watts: number[] | null;
  /** La cadence : tours de pédale par minute à vélo, pas par minute d'un pied à la course ; null sans cadence. */
  cadence: number[] | null;
  /** L'altitude en mètres. */
  altitude: number[];
}

/** L'athlète de la démo : sa FC max (celle du profil de démo), sa FC de repos, son poids et sa FTP du moment. */
export const ATHLETE_DEMO = { fcMax: 196, fcRepos: 52, poids: 72, vitesseSeuilCourse: 15 };

// --- Hasard déterministe ----------------------------------------------------------------------------------------------------

/** Un entier de 32 bits à partir d'un texte (FNV-1a). */
function graine(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Un nombre entre −1 et 1, toujours le même pour (graine, indice). */
function alea(g: number, i: number): number {
  let h = (g ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967295) * 2 - 1;
}

/** Un bruit lisse entre −1 et 1 (valeurs aléatoires toutes les `pas` secondes, reliées en douceur) : le même à n'importe quelle résolution. */
function bruit(g: number, t: number, pas: number): number {
  const i = Math.floor(t / pas);
  const f = t / pas - i;
  const u = f * f * (3 - 2 * f);
  return alea(g, i) * (1 - u) + alea(g, i + 1) * u;
}

const borner = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

// --- La FTP de l'athlète au fil des années -----------------------------------------------------------------------------------

const jourDe = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

/**
 * La FTP de l'athlète à une date : elle monte de 214 W (début 2021) à 252 W (2026) avec une saison (un creux en hiver, un pic en été), de quoi montrer l'évolution du niveau.
 * En dehors des années de la démo, elle reste bornée.
 */
export function ftpDemo(iso: string): number {
  const j = jourDe(iso.slice(0, 10));
  const progres = borner((j - jourDe('2021-01-01')) / (jourDe('2026-11-01') - jourDe('2021-01-01')), 0, 1.2);
  const saison = -7 * Math.cos((2 * Math.PI * (j - jourDe('2021-06-21'))) / 365.25); // pic au solstice d'été, creux au solstice d'hiver
  return Math.round(214 + 34 * progres + saison);
}

// --- L'altitude ------------------------------------------------------------------------------------------------------------

/** Un profil d'altitude : trois ondes (grandes montées, vallons, ondulations) à l'échelle voulue pour que le dénivelé positif fasse `denivele` mètres. */
function profilAltitude(g: number, dureeS: number, denivele: number): (t: number) => number {
  const ondes = [
    { periode: 1500 + 1500 * Math.abs(alea(g, 101)), phase: Math.PI * alea(g, 102), poids: 1 },
    { periode: 400 + 300 * Math.abs(alea(g, 103)), phase: Math.PI * alea(g, 104), poids: 0.45 },
    { periode: 120 + 90 * Math.abs(alea(g, 105)), phase: Math.PI * alea(g, 106), poids: 0.12 },
  ];
  const brut = (t: number): number => ondes.reduce((s, o) => s + o.poids * Math.sin((2 * Math.PI * t) / o.periode + o.phase), 0);
  const base = 140 + 120 * Math.abs(alea(g, 107));
  if (!(denivele > 0) || !(dureeS > 0)) return () => base;
  let gain = 0;
  let avant = brut(0);
  for (let t = 10; t <= dureeS; t += 10) {
    const x = brut(t);
    if (x > avant) gain += x - avant;
    avant = x;
  }
  const echelle = gain > 0 ? denivele / gain : 0;
  return (t) => base + echelle * brut(t);
}

// --- Les modèles de séance ------------------------------------------------------------------------------------------------

type Genre = 'velo' | 'course' | 'natation' | 'muscu' | 'hyrox' | 'glisse' | 'multisport' | 'autre';
function genreDe(s: Seance): Genre {
  if (s.sport === 'Triathlon' || s.sport === 'Duathlon') return 'multisport';
  const f = familleAffichage(s.sport);
  return f === 'velo' ? 'velo' : f === 'course' ? 'course' : f === 'natation' ? 'natation' : f === 'muscu' ? 'muscu' : f === 'hyrox' ? 'hyrox' : s.sport === 'RollerSki' || s.sport === 'NordicSki' ? 'glisse' : 'autre';
}

const moyenne = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** Les paramètres de l'air et du vélo (poids de l'ensemble 81 kg, CdA 0,32 m², roulement 0,005, rendement 97,5 %). */
const VELO = { masse: ATHLETE_DEMO.poids + 9, cda: 0.32, crr: 0.005, rho: 1.2, eta: 0.975, g: 9.81 };

/** La vitesse (m/s) d'un cycliste qui pousse `p` watts sur une pente `pente` (0,03 = 3 %) : on cherche la vitesse où la puissance de résistance égale celle des jambes (Newton). */
function vitessePuissance(p: number, pente: number, precedente: number): number {
  if (pente < -0.015 || p < 5) {
    // En descente ou à l'arrêt de pédalage : on se laisse aller, freiné par l'air et le roulement ; plafond de 16 m/s (58 km/h), on freine avant
    const r = VELO.masse * VELO.g * (VELO.crr + pente);
    const libre = r < 0 ? Math.sqrt((-2 * r) / (VELO.rho * VELO.cda)) : 0;
    return borner(p < 5 && pente >= -0.015 ? precedente * 0.97 : libre, 0.5, 16);
  }
  let v = Math.max(2, precedente);
  const f = (x: number): number => x * (0.5 * VELO.rho * VELO.cda * x * x + VELO.masse * VELO.g * (VELO.crr + pente)) - p * VELO.eta;
  for (let k = 0; k < 4; k++) {
    const d = 1.5 * VELO.rho * VELO.cda * v * v + VELO.masse * VELO.g * (VELO.crr + pente);
    v = borner(v - f(v) / (d || 1), 1, 16);
  }
  return v;
}

/** Quel profil d'effort pour un vélo : une sortie longue (avec un gros effort au milieu et un sprint) ou une sortie d'endurance. */
const sortieLongue = (s: Seance): boolean => /longue/i.test(String(s.name)) || s.moving_time >= 130 * 60;

/** Un type de course à pied d'après son nom : fractionné, tempo, ou footing. */
function typeCourse(s: Seance): 'fractionne' | 'tempo' | 'footing' {
  const n = String(s.name).toLowerCase();
  if (/fraction|interval|séries|series/.test(n)) return 'fractionne';
  if (/tempo|seuil/.test(n)) return 'tempo';
  return 'footing';
}

/** La FTP de la séance : celle de la fiche, sinon celle de l'athlète à la date de la séance. */
const ftpDe = (s: Seance): number => Number(s.ftp_at_time) > 0 ? Number(s.ftp_at_time) : ftpDemo(String(s.start_date_local).slice(0, 10));

/**
 * Le stream d'une séance. `pas` : la résolution en secondes (1 = comme Strava ; 5 pour calculer des moyennes sur beaucoup de séances sans coût). Les arrays suivent le même modèle quel que soit le pas.
 * Les moyennes (durée, distance, dénivelé, cardio, puissance) sont celles de la fiche quand elle les donne.
 */
export function genererFlux(s: Seance, pas = 1): Flux {
  const duree = Math.max(60, Math.round(Number(s.moving_time) || 0));
  const g = graine(String(s.id));
  const n = Math.floor(duree / pas) + 1;
  const genre = genreDe(s);
  const km = Number(s.distance_km) > 0 ? Number(s.distance_km) : 0;
  const altitude = profilAltitude(g, duree, Number(s.total_elevation_gain) || 0);
  const t = Array.from({ length: n }, (_, i) => i * pas);

  // 1) La vitesse (m/s), ou la puissance à vélo, selon le genre
  let v: number[];
  let watts: number[] | null = null;
  let cadence: number[] | null = null;
  const pente = (x: number): number => (altitude(x + 5) - altitude(x - 5)) / 10; // m d'altitude par seconde

  if (genre === 'velo') {
    const ftp = ftpDe(s);
    const cibleP = Number(s.avg_watts) > 0 ? Number(s.avg_watts) : 0.66 * ftp * (sortieLongue(s) ? 0.96 : 1);
    const longue = sortieLongue(s);
    const mi = duree * 0.5;
    const forme = (x: number): number => {
      let f = 1 + 0.12 * bruit(g, x, 30) + 0.07 * bruit(g + 1, x, 6);
      if (longue) {
        if (x > mi && x < mi + 20 * 60) f *= 1.12; // un gros effort de 20 minutes au milieu de la sortie
        if (x > duree - 12) f *= 2.6; // un sprint final de 12 secondes
      } else if ((x / 60) % 25 > 21) f *= 1.18; // des relances toutes les 25 minutes
      return f;
    };
    const brut: number[] = new Array(n);
    watts = new Array(n);
    v = new Array(n);
    let vPrec = 7;
    for (let i = 0; i < n; i++) {
      const x = t[i];
      const p0 = borner(pente(x) / Math.max(vPrec, 2), -0.18, 0.18); // la pente : mètres montés par mètre roulé
      // Une montée demande plus de watts, une descente se fait sans pédaler ; des arrêts de pédalage ici et là
      let p = cibleP * forme(x) * (1 + 1.5 * Math.max(0, p0)); // une montée demande plus de watts, sans excès
      if (p0 < -0.02 || bruit(g + 2, x, 40) > 0.88) p = 0;
      brut[i] = p;
      v[i] = vPrec = vitessePuissance(p, p0, vPrec);
    }
    // On recale la puissance moyenne (watts de la fiche, ou 66 % de la FTP) et la vitesse moyenne (distance de la fiche)
    const moyP = moyenne(brut);
    const kP = moyP > 0 ? cibleP / moyP : 1;
    // Aucun cycliste de la démo ne dépasse 1 100 W (son sprint) ni ne tient 20 minutes bien au-dessus de sa FTP
    for (let i = 0; i < n; i++) watts[i] = Math.round(Math.min(1100, brut[i] * kP));
    if (km > 0) {
      const kV = (km * 1000) / (duree) / (moyenne(v) || 1);
      for (let i = 0; i < n; i++) v[i] = Math.min(16, v[i] * kV); // jamais plus de 58 km/h, même en descente
    }
    cadence = watts.map((p, i) => (p < 8 ? 0 : Math.round(borner(82 + 16 * (p / cibleP - 1) + 5 * bruit(g + 3, t[i], 5), 55, 118))));
  } else if (genre === 'course' || genre === 'glisse' || genre === 'multisport') {
    const vMoy = km > 0 ? (km * 1000) / duree : genre === 'glisse' ? 4.3 : 3.0;
    const type = genre === 'course' ? typeCourse(s) : 'footing';
    const chauffe = type === 'footing' ? 0 : 12 * 60;
    const retour = type === 'footing' ? 0 : 8 * 60;
    const forme = (x: number): number => {
      let f = 1 + 0.025 * bruit(g, x, 20);
      if (type === 'footing') f *= 1.04 - 0.08 * (x / duree); // un léger ralentissement
      else if (x < chauffe) f *= 0.84 + 0.1 * (x / chauffe);
      else if (x > duree - retour) f *= 0.82;
      else if (type === 'fractionne') f *= (x - chauffe) % 300 < 180 ? 1.26 : 0.68; // 3 minutes vite, 2 minutes de trot
      else f *= 1.12; // tempo : un long bloc à allure soutenue
      return f;
    };
    v = t.map((x) => {
      const p0 = pente(x) / Math.max(vMoy, 1);
      return vMoy * forme(x) * borner(1 - 5 * p0, 0.6, 1.35);
    });
    const kV = vMoy / (moyenne(v) || 1);
    v = v.map((x) => x * kV);
    cadence = v.map((x, i) => Math.round(borner(76 + 1.6 * x + 2 * bruit(g + 3, t[i], 8), 60, 100)));
  } else if (genre === 'natation') {
    // Des longueurs de 25 m : chaque longueur dure un peu plus ou un peu moins, avec des repos de 15 à 40 s entre les séries (le chrono continue, la distance non)
    const total = km > 0 ? km * 1000 : 1500;
    const longueurs = Math.max(1, Math.round(total / 25));
    const nage = Math.max(15, ((duree * 0.9) / longueurs)); // une longueur nagée (s)
    const repos = Math.max(0, duree - nage * longueurs); // le repos total
    const parSerie = Math.max(2, Math.round(longueurs / Math.max(1, Math.round(longueurs / 4)))); // longueurs entre deux repos (4 = 100 m)
    v = new Array(n).fill(0);
    const debuts: number[] = []; // l'instant de chaque début de longueur
    let x = 0;
    for (let k = 0; k < longueurs; k++) {
      const dur = nage * (1 + 0.04 * alea(g, 200 + k));
      debuts.push(x);
      x += dur;
      if ((k + 1) % parSerie === 0 && k + 1 < longueurs) x += (repos / Math.max(1, Math.floor(longueurs / parSerie))) * (1 + 0.2 * alea(g, 300 + k));
    }
    const finNage = x;
    const kT = finNage > 0 ? duree / finNage : 1;
    for (let k = 0; k < longueurs; k++) {
      const debut = debuts[k] * kT;
      const fin = (k + 1 < longueurs ? debuts[k + 1] : finNage) * kT;
      const nageK = Math.min(fin, debut + nage * kT * (1 + 0.04 * alea(g, 200 + k)));
      for (let i = 0; i < n; i++) if (t[i] >= debut && t[i] < nageK) v[i] = 25 / Math.max(1, nageK - debut);
    }
  } else if (genre === 'hyrox') {
    // 8 tours : un kilomètre de course (ou la part qui tient dans la séance) puis une station (sans déplacement)
    const tours = Math.max(2, Math.min(8, Math.round(duree / 600)));
    const duTour = duree / tours;
    const partCourse = 0.52;
    v = t.map((x) => {
      const k = x % duTour;
      return k < duTour * partCourse ? (1000 / (duTour * partCourse)) * (1 + 0.03 * bruit(g, x, 10)) : 0;
    });
  } else if (genre === 'muscu') {
    v = new Array(n).fill(0);
  } else {
    v = new Array(n).fill(km > 0 ? (km * 1000) / duree : 0);
  }

  // 2) La distance : la somme des vitesses (en natation, par sauts de 25 m à chaque mur)
  const distance: number[] = new Array(n);
  if (genre === 'natation') {
    let cumul = 0;
    let longueur = 0;
    for (let i = 0; i < n; i++) {
      cumul += v[i] * pas;
      const entiere = Math.floor(cumul / 25 + 1e-6) * 25;
      distance[i] = entiere;
      longueur = entiere;
    }
    void longueur;
  } else {
    let cumul = 0;
    for (let i = 0; i < n; i++) {
      distance[i] = Math.round(cumul * 10) / 10;
      cumul += v[i] * pas;
    }
  }

  // 3) La fréquence cardiaque : un effort cible, que le cœur suit avec du retard (35 s), un peu de dérive en fin de séance ; recalée sur la moyenne de la fiche
  const hrCible = new Array<number>(n);
  const vRef = genre === 'velo' ? 0 : Math.max(0.5, moyenne(v));
  for (let i = 0; i < n; i++) {
    const x = t[i];
    let effort: number;
    if (genre === 'velo') effort = (watts?.[i] ?? 0) / Math.max(1, ftpDe(s)); // 0 à 1,2 et plus
    else if (genre === 'muscu') effort = 0.35 + 0.35 * Math.max(0, Math.sin((2 * Math.PI * x) / 210)); // une série d'une minute, deux minutes de repos
    else if (genre === 'hyrox') effort = v[i] > 0 ? 0.85 : 0.95;
    else if (genre === 'natation') effort = v[i] > 0 ? 0.55 : 0.3;
    else effort = Math.max(0.2, (v[i] / vRef) * 0.62); // la course et le reste : l'effort suit la vitesse relative
    hrCible[i] = effort;
  }
  const hr: number[] = new Array(n);
  const alpha = 1 - Math.exp(-pas / 35);
  let etat = hrCible[0];
  for (let i = 0; i < n; i++) {
    etat += (hrCible[i] - etat) * alpha;
    const derive = 1 + 0.06 * Math.max(0, t[i] / 3600 - 0.5); // +6 % par heure au-delà de 30 minutes
    hr[i] = etat * derive;
  }
  // Moyenne cible : la fiche, sinon un cardio de croisière pour le genre (dépend du niveau de l'effort)
  const fcFiche = Number(s.avg_heartrate) > 0 ? Number(s.avg_heartrate) : cardioMoyenDemo(s);
  const moyHr = moyenne(hr);
  const ecartHr = (fcFiche - ATHLETE_DEMO.fcRepos) / (moyHr || 1);
  const heartrate = hr.map((h, i) => Math.round(borner(ATHLETE_DEMO.fcRepos + h * ecartHr + 1.5 * bruit(g + 4, t[i], 3), 50, ATHLETE_DEMO.fcMax)));

  return { time: t, distance, velocity_smooth: v.map((x) => Math.round(x * 100) / 100), heartrate, watts, cadence, altitude: t.map((x) => Math.round(altitude(x) * 10) / 10) };
}

// --- Les chiffres déduits du modèle ------------------------------------------------------------------------------------------

/** Le cardio moyen d'une séance qui n'en donne pas : un modèle par genre (vélo : selon l'intensité de la puissance, course : selon l'allure, natation et muscu : constants avec un peu de variété). */
export function cardioMoyenDemo(s: Seance): number {
  const g = graine(String(s.id));
  const aleatoire = 3 * alea(g, 11);
  const genre = genreDe(s);
  const duree = Math.max(60, Number(s.moving_time) || 3600);
  if (genre === 'velo') {
    const km = Number(s.distance_km) || (duree / 3600) * 27;
    const vitesse = km / (duree / 3600); // km/h
    const montee = (Number(s.total_elevation_gain) || 0) / Math.max(km, 1); // m/km
    const intensite = borner(0.55 + (vitesse - 22) * 0.012 + montee * 0.0025, 0.5, 0.95);
    return Math.round(128 + (intensite - 0.55) * 120 + aleatoire);
  }
  if (genre === 'course' || genre === 'glisse' || genre === 'multisport') {
    const km = Number(s.distance_km) || (duree / 3600) * 11;
    const vitesse = km / (duree / 3600);
    return Math.round(140 + (vitesse - 10.6) * 8.5 + aleatoire);
  }
  if (genre === 'natation') return Math.round(128 + aleatoire);
  if (genre === 'hyrox') return Math.round(158 + aleatoire);
  if (genre === 'muscu') return Math.round(112 + aleatoire);
  return Math.round(120 + aleatoire);
}

/** La puissance moyenne d'une sortie à vélo qui n'en donne pas : celle qu'il faut pour tenir sa vitesse moyenne sur son dénivelé (même physique que le stream), en watts entiers. */
export function puissanceMoyenneDemo(s: Seance): number {
  const duree = Math.max(60, Number(s.moving_time) || 3600);
  const km = Number(s.distance_km) || (duree / 3600) * 27;
  const v = (km * 1000) / duree;
  const montee = (Number(s.total_elevation_gain) || 0) / Math.max(km * 1000, 1); // pente moyenne montée
  // Dans le stream, une partie de la montée est « rendue » en descente sans pédaler : on compte 50 % de l'énergie de montée
  const pente = 0.5 * montee;
  return Math.round(Math.max(90, (v * (0.5 * VELO.rho * VELO.cda * v * v + VELO.masse * VELO.g * (VELO.crr + pente))) / VELO.eta));
}

/**
 * Une séance de la démo avec ses chiffres complets : cardio moyen et maximal, et pour un vélo la puissance moyenne, la puissance normalisée, la FTP du jour et la mention « capteur de puissance ».
 * Les chiffres déjà là ne bougent pas. Aucun stream n'est généré (le calcul est celui du modèle) : on peut compléter des milliers de séances au démarrage.
 */
export function completerSeance(s: Seance): Seance {
  const genre = genreDe(s);
  const fc = Number(s.avg_heartrate) > 0 ? Number(s.avg_heartrate) : cardioMoyenDemo(s);
  const sortie: Seance = { ...s, avg_heartrate: fc, max_heartrate: s.max_heartrate ?? Math.min(ATHLETE_DEMO.fcMax, Math.round(fc + (genre === 'muscu' ? 36 : genre === 'natation' ? 24 : 32))) };
  if (genre === 'velo') {
    const watts = Number(s.avg_watts) > 0 ? Number(s.avg_watts) : puissanceMoyenneDemo(s);
    sortie.avg_watts = watts;
    sortie.np = Number(s.np) > 0 ? s.np : Math.round(watts * (sortieLongue(s) ? 1.1 : 1.06));
    sortie.ftp_at_time = Number(s.ftp_at_time) > 0 ? s.ftp_at_time : ftpDemo(String(s.start_date_local).slice(0, 10));
    sortie.device_watts = true;
  }
  return sortie;
}
