// Analyse des prédictions de temps en course à pied : ton niveau (VDOT de Jack Daniels), tes temps probables sur 5 km,
// 10 km, semi et marathon, tes allures d'entraînement, ta progression et l'écart à ton objectif. Fonctions pures.
import { familleAffichage } from '../data/familles.js';
import { dateIsoLocale } from '../utils/format.js';
import { arrondi, decalerJour, ecartJours, formatTemps, formatAllure, moyenne, regression, somme } from './maths.js';

const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');

// --- Équations de Daniels & Gilbert (1979) ---

/** Consommation d'oxygène (ml/kg/min) à la vitesse v (m/min). */
export const vo2AVitesse = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Part du VO2max qu'on peut tenir pendant t minutes. */
export const fractionTenable = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

/** VDOT d'une performance : distance (m) et temps (s). */
export function vdotPerformance(distanceM, tempsS) {
  const t = tempsS / 60;
  return vo2AVitesse(distanceM / t) / fractionTenable(t);
}

/** Temps (s) que donne un VDOT sur une distance (m) : on cherche par dichotomie (le VDOT décroît quand le temps augmente). */
export function tempsPourVdot(vdot, distanceM) {
  let bas = distanceM / 10; // 10 m/s = 36 km/h : impossible à tenir, trop rapide
  let haut = distanceM * 1.5; // 0,67 m/s = 2,4 km/h : trop lent
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2;
    if (vdotPerformance(distanceM, milieu) > vdot) bas = milieu;
    else haut = milieu;
  }
  return (bas + haut) / 2;
}

/** Vitesse (m/min) à laquelle on consomme `vo2` : on inverse l'équation du second degré. */
export function vitessePourVo2(vo2) {
  const a = 0.000104;
  const b = 0.182258;
  return (-b + Math.sqrt(b * b + 4 * a * (4.6 + vo2))) / (2 * a);
}
const secParKm = (vo2) => (1000 / vitessePourVo2(vo2)) * 60; // 1000 m ÷ (m/min) = minutes → ×60 = secondes

/** Allures d'entraînement (secondes par km) pour un VDOT. */
export function allures(vdot, secMarathonParKm) {
  return {
    facile: { de: secParKm(vdot * 0.72), a: secParKm(vdot * 0.62) },
    marathon: secMarathonParKm,
    seuil: secParKm(vdot * 0.88),
    intervalles: secParKm(vdot * 0.98),
  };
}

const DISTANCES = [
  { cle: '5k', label: '5 km', m: 5000 },
  { cle: '10k', label: '10 km', m: 10000 },
  { cle: 'semi', label: 'Semi-marathon', m: 21097.5 },
  { cle: 'marathon', label: 'Marathon', m: 42195 },
];

const EST_COURSE = (s) => familleAffichage(s.sport) === 'course';

/** Efforts exploitables : sorties de course d'au moins 3 km, avec leur VDOT et leur « qualité » (cardio relatif à la FC max). */
export function effortsCourse(seances, hrMax, aujourdhui = new Date(), jours = 400) {
  const fin = dateIsoLocale(aujourdhui);
  return seances
    .filter((s) => EST_COURSE(s) && Number(s.distance_km) >= 3 && Number(s.moving_time) > 0)
    .map((s) => {
      const iso = String(s.start_date_local).slice(0, 10);
      const distanceM = Number(s.distance_km) * 1000;
      const hr = hrMax && s.avg_heartrate ? s.avg_heartrate / hrMax : null;
      return { id: s.id, nom: s.name || 'Sortie', iso, jours: ecartJours(iso, fin), distanceM, tempsS: Number(s.moving_time), vdot: vdotPerformance(distanceM, Number(s.moving_time)), hr, course: s.category === 'competition' };
    })
    .filter((e) => e.jours >= 0 && e.jours <= jours && e.vdot > 20 && e.vdot < 90)
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

/**
 * Niveau de référence à une date : le 90e centile des VDOT des efforts d'au moins 5 km des 90 jours précédents.
 * (Une sortie d'entraînement sous-estime toujours ton niveau : on regarde donc tes meilleures, pas la moyenne.)
 * Confiance : haute si un effort proche du maximum (cardio ≥ 88 % de la FC max, ou compétition), moyenne à partir de 80 %, sinon faible.
 */
export function niveauA(efforts, iso, fenetre = 90) {
  const utiles = efforts.filter((e) => e.iso <= iso && ecartJours(e.iso, iso) <= fenetre && e.distanceM >= 5000);
  if (utiles.length < 2) return null;
  const tri = utiles.map((e) => e.vdot).sort((a, b) => a - b);
  const rang = Math.min(tri.length - 1, Math.floor(0.9 * (tri.length - 1) + 0.5));
  const vdot = tri[rang];
  const forts = utiles.filter((e) => e.course || (e.hr != null && e.hr >= 0.88));
  const moyens = utiles.filter((e) => e.hr != null && e.hr >= 0.8);
  const confiance = forts.length ? 'haute' : moyens.length ? 'moyenne' : 'faible';
  return { vdot, confiance, nbEfforts: utiles.length, meilleurEffort: utiles.reduce((m, e) => (e.vdot > m.vdot ? e : m), utiles[0]) };
}

/** Kilométrage hebdomadaire moyen sur les 8 dernières semaines. */
export function kmParSemaine(seances, aujourdhui = new Date()) {
  const fin = dateIsoLocale(aujourdhui);
  const debut = decalerJour(fin, -55);
  const km = somme(seances.filter((s) => EST_COURSE(s) && String(s.start_date_local).slice(0, 10) >= debut).map((s) => Number(s.distance_km) || 0));
  return km / 8;
}

/** Majoration du temps de marathon quand le volume est faible (le VDOT suppose un entraînement de marathonien). */
export function majorationMarathon(kmSemaine) {
  if (kmSemaine >= 55) return 0;
  if (kmSemaine >= 40) return 0.025;
  if (kmSemaine >= 25) return 0.05;
  return 0.09;
}

export function analyserPredictions({ seances, objectifs = [], hrMax = null, aujourdhui = new Date(), nomSport = '' } = {}) {
  const fin = dateIsoLocale(aujourdhui);
  const methode = [
    { titre: 'VDOT (Jack Daniels)', texte: 'Un « niveau de forme » en un seul chiffre, déduit de tes performances : on calcule l\'oxygène que ton allure demande, divisé par la part du maximum qu\'on peut tenir sur cette durée. Deux courses au même VDOT sont de la même valeur, quelle que soit la distance.' },
    { titre: 'Pourquoi le 90e centile', texte: 'Une sortie d\'entraînement est presque toujours plus lente que ce dont tu es capable. On part donc de tes meilleures sorties des 90 derniers jours (le 90e centile), pas de ta moyenne. Plus ton cardio était proche du maximum, plus l\'estimation est fiable.' },
    { titre: 'Temps prédits', texte: 'On cherche le temps pour lequel le même VDOT donne la distance voulue. Pour le marathon, on ajoute une marge quand ton volume hebdomadaire est faible : le VDOT suppose un entraînement de marathonien.' },
    { titre: 'Allures d\'entraînement', texte: 'Facile : 62 à 72 % de ton VO2max. Seuil : 88 %, le « confortablement dur » tenable environ une heure. Intervalles : 98 %, proche de ta vitesse maximale aérobie.' },
    { titre: 'Progression', texte: 'On recalcule ton niveau à la fin de chaque mois avec les 90 jours précédents, puis on trace la tendance. Une progression saine est de 0,5 à 1,5 % de VDOT par mois chez un coureur régulier.' },
  ];
  const efforts = effortsCourse(seances, hrMax, aujourdhui);
  const actuel = niveauA(efforts, fin);
  if (!actuel) {
    return {
      id: 'predictions',
      insuffisant: true,
      verdict: { niveau: 'info', titre: 'Pas encore assez de sorties', texte: 'Il faut au moins deux sorties de course de 5 km ou plus sur les 3 derniers mois pour estimer ton niveau. Cours un peu plus longtemps, l\'analyse se remplit toute seule.' },
      chiffres: [],
      graphiques: [],
      lectures: [],
      conseils: [],
      methode,
    };
  }

  const kmSemaine = kmParSemaine(seances, aujourdhui);
  const plus = majorationMarathon(kmSemaine);
  const predictions = DISTANCES.map((d) => {
    let t = tempsPourVdot(actuel.vdot, d.m);
    if (d.cle === 'marathon') t *= 1 + plus;
    return { ...d, secondes: Math.round(t), allure: t / (d.m / 1000) };
  });
  const zones = allures(actuel.vdot, predictions[3].allure);

  // --- Progression : niveau à la fin de chacun des 12 derniers mois ---
  const points = [];
  for (let m = 11; m >= 0; m--) {
    const iso = decalerJour(fin, -m * 30);
    const n = niveauA(efforts, iso);
    if (n) points.push({ iso, vdot: n.vdot });
  }
  const tendance = points.length >= 3 ? regression(points.map((p) => p.vdot)) : null;
  const penteMois = tendance ? tendance.pente : null; // VDOT par pas de 30 jours
  const penteRelative = penteMois != null ? (penteMois / actuel.vdot) * 100 : null; // % par mois
  const fiable = tendance && tendance.r2 > 0.3 && points.length >= 4;

  // --- Objectif : la prochaine compétition de course ---
  const prochaine = objectifs
    .filter((o) => o.date > fin && familleAffichage(o.sport) === 'course' && Number(o.km) > 0 && Number(o.duration) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  let objectif = null;
  if (prochaine) {
    const requis = vdotPerformance(Number(prochaine.km) * 1000, Number(prochaine.duration) * 60);
    const ecartPct = ((requis - actuel.vdot) / actuel.vdot) * 100;
    const mois = ecartJours(fin, prochaine.date) / 30;
    const gainPossible = fiable && penteRelative > 0 ? Math.min(penteRelative, 2) * mois : Math.min(1 * mois, 4); // sans tendance fiable : 1 % par mois, plafonné
    const marge = gainPossible - ecartPct;
    objectif = { nom: prochaine.name, date: prochaine.date, km: Number(prochaine.km), duree: Number(prochaine.duration) * 60, requis, ecartPct, mois, gainPossible, marge, tempsActuel: tempsPourVdot(actuel.vdot, Number(prochaine.km) * 1000) };
  }

  // --- Verdict ---
  const confianceTexte = { haute: 'fiable (tu as couru près de ton maximum)', moyenne: 'plutôt fiable', faible: 'prudente : tes sorties étaient toutes tranquilles, ton vrai niveau est sans doute meilleur' };
  let verdict;
  if (penteRelative != null && fiable && penteRelative > 0.4) verdict = { niveau: 'ok', titre: 'Tu progresses', texte: `Ton niveau (VDOT ${virgule(actuel.vdot)}) monte d'environ ${virgule(penteRelative)} % par mois. Estimation ${confianceTexte[actuel.confiance]}.` };
  else if (penteRelative != null && fiable && penteRelative < -0.4) verdict = { niveau: 'attention', titre: 'Ton niveau baisse', texte: `Ton niveau (VDOT ${virgule(actuel.vdot)}) recule d'environ ${virgule(-penteRelative)} % par mois. Manque de régularité, de qualité, ou fatigue accumulée : regarde l'analyse de la charge.` };
  else verdict = { niveau: 'ok', titre: 'Niveau stable', texte: `Ton niveau est de VDOT ${virgule(actuel.vdot)}. Estimation ${confianceTexte[actuel.confiance]}.` };

  const dix = predictions[1];
  const chiffres = [
    { etiquette: 'VDOT', valeur: virgule(actuel.vdot), unite: '', note: penteRelative != null && fiable ? `${penteRelative >= 0 ? '+' : ''}${virgule(penteRelative)} % par mois` : 'tendance incertaine', ton: penteRelative != null && fiable ? (penteRelative >= 0 ? 'ok' : 'alerte') : 'neutre' },
    { etiquette: '5 km', valeur: formatTemps(predictions[0].secondes), unite: '', note: formatAllure(predictions[0].allure), ton: 'neutre' },
    { etiquette: '10 km', valeur: formatTemps(dix.secondes), unite: '', note: formatAllure(dix.allure), ton: 'neutre' },
    { etiquette: 'Semi', valeur: formatTemps(predictions[2].secondes), unite: '', note: formatAllure(predictions[2].allure), ton: 'neutre' },
    { etiquette: 'Marathon', valeur: formatTemps(predictions[3].secondes), unite: '', note: plus > 0 ? `+${Math.round(plus * 100)} % (volume faible)` : formatAllure(predictions[3].allure), ton: plus > 0 ? 'alerte' : 'neutre' },
    { etiquette: 'Confiance', valeur: actuel.confiance === 'haute' ? 'Haute' : actuel.confiance === 'moyenne' ? 'Moyenne' : 'Faible', unite: '', note: `${actuel.nbEfforts} sorties de 5 km et plus`, ton: actuel.confiance === 'faible' ? 'alerte' : 'ok' },
  ];

  // --- Graphiques ---
  const graphiques = [
    {
      type: 'tableau',
      titre: 'Tes temps prédits',
      description: `D'après tes meilleures sorties des 90 derniers jours (VDOT ${virgule(actuel.vdot)}).`,
      colonnes: ['Distance', 'Temps', 'Allure'],
      lignes: predictions.map((p) => [p.label, formatTemps(p.secondes, true), formatAllure(p.allure)]),
    },
    {
      type: 'tableau',
      titre: 'Tes allures d\'entraînement',
      description: 'Pour chaque type de séance, l\'allure à viser.',
      colonnes: ['Séance', 'Allure', 'À quoi ça sert'],
      lignes: [
        ['Footing facile', `${formatAllure(zones.facile.de).replace('/km', '')} à ${formatAllure(zones.facile.a)}`, 'Construire la base sans se fatiguer'],
        ['Allure marathon', formatAllure(zones.marathon), 'Habituer le corps à l\'effort long'],
        ['Seuil', formatAllure(zones.seuil), 'Repousser l\'endurance : 20 à 40 min d\'effort continu'],
        ['Intervalles', formatAllure(zones.intervalles), 'Monter ton maximum aérobie : répétitions de 3 à 5 min'],
      ],
    },
  ];
  if (points.length >= 3) {
    graphiques.push({
      type: 'lignes',
      titre: 'Évolution de ton niveau (VDOT)',
      description: 'Ton niveau à la fin de chaque mois, d\'après tes meilleures sorties des 90 jours précédents.',
      etiquettes: points.map((p) => p.iso),
      series: [{ nom: 'VDOT', couleur: 'var(--sport-course)', valeurs: points.map((p) => arrondi(p.vdot, 1)) }],
    });
  }
  const tops = [...efforts].filter((e) => e.jours <= 120 && e.distanceM >= 5000).sort((a, b) => b.vdot - a.vdot).slice(0, 5);
  if (tops.length) {
    graphiques.push({
      type: 'tableau',
      titre: 'Tes meilleures sorties récentes',
      description: 'Celles qui définissent ton niveau actuel.',
      colonnes: ['Date', 'Sortie', 'Distance', 'Temps', 'VDOT'],
      lignes: tops.map((e) => [e.iso.slice(8) + '/' + e.iso.slice(5, 7), e.nom, `${virgule(e.distanceM / 1000)} km`, formatTemps(e.tempsS, true), virgule(e.vdot)]),
    });
  }

  // --- Lectures ---
  const lectures = [];
  lectures.push(`Ta meilleure sortie récente : « ${actuel.meilleurEffort.nom} », ${virgule(actuel.meilleurEffort.distanceM / 1000)} km en ${formatTemps(actuel.meilleurEffort.tempsS, true)} (VDOT ${virgule(actuel.meilleurEffort.vdot)}).`);
  lectures.push(`Ton volume est d'environ ${Math.round(kmSemaine)} km de course par semaine${plus > 0 ? ` : trop bas pour un marathon au niveau prédit, d'où la marge de ${Math.round(plus * 100)} % sur ce temps` : ''}.`);
  if (penteRelative != null) lectures.push(fiable ? `Sur la durée, ton niveau ${penteRelative >= 0 ? 'monte' : 'baisse'} de ${virgule(Math.abs(penteRelative))} % par mois (tendance ${tendance.r2 > 0.6 ? 'nette' : 'modérée'}).` : 'La tendance de ton niveau est trop irrégulière pour être lue avec certitude.');
  if (objectif) {
    lectures.push(`Pour « ${objectif.nom} » (${virgule(objectif.km)} km en ${formatTemps(objectif.duree, true)}), il faut un VDOT de ${virgule(objectif.requis)}. Tu es à ${virgule(actuel.vdot)}, soit ${objectif.ecartPct <= 0 ? `${virgule(-objectif.ecartPct)} % de marge` : `${virgule(objectif.ecartPct)} % à gagner`}. À ton rythme actuel, tu gagnerais environ ${virgule(objectif.gainPossible)} % d'ici la course.`);
  }

  // --- Conseils ---
  const conseils = [];
  if (objectif) {
    if (objectif.ecartPct <= 0) conseils.push({ priorite: 'info', titre: 'Ton objectif est déjà à ta portée', texte: `D'après ton niveau, tu courrais ${virgule(objectif.km)} km en ${formatTemps(objectif.tempsActuel, true)}, plus vite que ton objectif de ${formatTemps(objectif.duree, true)}. Tu peux viser plus haut ou sécuriser la course.` });
    else if (objectif.marge >= 0) conseils.push({ priorite: 'moyenne', titre: 'Objectif réaliste', texte: `Il te manque ${virgule(objectif.ecartPct)} % de niveau et tu en gagneras environ ${virgule(objectif.gainPossible)} % d'ici la course : c'est jouable si tu restes régulier. Une séance de seuil par semaine est le levier le plus efficace.` });
    else if (objectif.marge > -3) conseils.push({ priorite: 'haute', titre: 'Objectif ambitieux', texte: `Il te manque ${virgule(objectif.ecartPct)} % de niveau pour ${formatTemps(objectif.duree, true)} et tu en gagneras environ ${virgule(objectif.gainPossible)} %. Ajoute une séance d'intervalles par semaine et sois très régulier. Garde en tête un temps de repli : ${formatTemps(tempsPourVdot(actuel.vdot * (1 + objectif.gainPossible / 100), objectif.km * 1000), true)}.` });
    else conseils.push({ priorite: 'haute', titre: 'Objectif trop loin pour cette échéance', texte: `Il faudrait gagner ${virgule(objectif.ecartPct)} % de niveau en ${Math.round(objectif.mois * 4.3)} semaines, alors qu'une progression saine donne environ ${virgule(objectif.gainPossible)} %. Vise plutôt ${formatTemps(tempsPourVdot(actuel.vdot * (1 + objectif.gainPossible / 100), objectif.km * 1000), true)}, ou décale l'objectif.` });
  }
  if (actuel.confiance === 'faible') conseils.push({ priorite: 'moyenne', titre: 'Fais un test pour affiner', texte: `Toutes tes sorties récentes étaient tranquilles : ton niveau est probablement sous-estimé. Un 5 km à fond (ou un effort de 20 minutes) donnerait une prédiction beaucoup plus précise. Vise ${formatAllure(zones.intervalles * 1.03)} sur chaque kilomètre.` });
  if (plus >= 0.05) conseils.push({ priorite: 'moyenne', titre: 'Le marathon demande plus de volume', texte: `À ${Math.round(kmSemaine)} km par semaine, le marathon prédit est majoré de ${Math.round(plus * 100)} %. Monte progressivement vers ${Math.round(Math.max(40, kmSemaine * 1.25))} km par semaine (jamais plus de 10 % de plus d'une semaine à l'autre).` });
  if (penteRelative != null && fiable && penteRelative < -0.4) conseils.push({ priorite: 'haute', titre: 'Relance ta progression', texte: 'Ton niveau recule : remets une séance de qualité par semaine (seuil ou intervalles) en plus de ta sortie longue, et vérifie que tu récupères assez.' });
  if (penteRelative != null && fiable && penteRelative > 1.5) conseils.push({ priorite: 'moyenne', titre: 'Belle progression, protège-la', texte: 'Tu progresses vite : c\'est bon signe, mais c\'est aussi la zone où l\'on se blesse. Respecte une semaine plus légère toutes les 3 ou 4 semaines.' });
  conseils.push({ priorite: 'info', titre: 'Tes séances clés', texte: `Seuil : 3 × 10 min à ${formatAllure(zones.seuil)} avec 2 min de trot. Intervalles : 5 × 1 000 m à ${formatAllure(zones.intervalles)} avec 3 min de récupération. Le reste en footing à ${formatAllure(zones.facile.de)} ou plus lent.` });
  const ordre = { haute: 0, moyenne: 1, faible: 2, info: 3 };
  conseils.sort((a, b) => ordre[a.priorite] - ordre[b.priorite]);

  return { id: 'predictions', insuffisant: false, verdict, chiffres, graphiques, lectures, conseils, methode, brut: { actuel, predictions, zones, kmSemaine, plus, points, penteRelative, fiable, objectif, tops } };
}
