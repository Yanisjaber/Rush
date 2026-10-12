// Données d'exemple pour le mode démo (?demo dans l'adresse) : mêmes formes que les réponses de l'API,
// générées de façon déterministe. Elles servent à montrer et à tester l'interface sans être connecté.
import { dateIsoLocale } from '../utils/format.js';
import { appliquerTout } from './retouches.js';

// Modifications faites en démo (sorties saisies, retouches) : gardées en mémoire et réappliquées à chaque lecture des données d'exemple.
export const ajoutsDemo = { manuelles: [], retouches: Object.create(null) };

export function donneesDemo(aujourdhui = new Date()) {
  const seances = [];
  const quotidien = {}; // date ISO → points de charge du jour

  // Semaine type : lundi muscu, mardi course, mercredi vélo, jeudi course, vendredi muscu, samedi course, dimanche vélo
  const modele = {
    1: { sport: 'WeightTraining', nom: 'Push', min: 65, tss: 55 },
    2: { sport: 'Run', nom: 'Fractionné', min: 55, tss: 70 },
    3: { sport: 'Ride', nom: 'Endurance vélo', min: 90, tss: 62 },
    4: { sport: 'Run', nom: 'Footing facile', min: 50, tss: 40 },
    5: { sport: 'WeightTraining', nom: 'Pull', min: 60, tss: 50 },
    6: { sport: 'Run', nom: 'Sortie tempo', min: 60, tss: 78 },
    0: { sport: 'Ride', nom: 'Sortie longue', min: 150, tss: 95 },
  };

  for (let i = 83; i >= 0; i--) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const m = modele[d.getDay()];
    // un jour sur neuf de repos en plus, pour une régularité réaliste
    if (!m || (i * 7) % 9 === 0) continue;
    const variation = 0.85 + ((i * 13) % 30) / 100;
    const iso = dateIsoLocale(d);
    const tss = Math.round(m.tss * variation);
    quotidien[iso] = (quotidien[iso] || 0) + tss;
    // La vitesse en course progresse doucement sur 12 semaines (de 10,6 à 11,8 km/h) : de quoi montrer l'efficacité
    const vitesseCourse = 10.6 + ((83 - i) / 83) * 1.2;
    const distance = m.sport === 'Run' ? (m.min / 60) * vitesseCourse : m.sport === 'Ride' ? (m.min / 60) * 27 : null;
    seances.push({
      id: `demo-${iso}`,
      name: m.nom,
      sport: m.sport,
      start_date_local: `${iso}T18:00:00+00:00`,
      moving_time: Math.round(m.min * 60 * variation),
      distance_km: distance ? Math.round(distance * variation * 100) / 100 : null,
      total_elevation_gain: m.sport === 'WeightTraining' ? null : Math.round(40 + ((i * 17) % 200)),
      avg_heartrate: 142 + ((i * 3) % 18),
      ftp_at_time: m.sport === 'Ride' ? 250 : null,
      avg_watts: m.sport === 'Ride' ? 135 + ((i * 5) % 40) : null,
      np: m.sport === 'Ride' ? 142 + ((i * 7) % 40) : null,
      tss,
      category: 'entrainement',
    });
  }
  seances.splice(0, seances.length, ...appliquerTout([...seances, ...ajoutsDemo.manuelles], ajoutsDemo.retouches));
  seances.sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1));

  // CTL (42 jours) et ATL (7 jours) : moyennes exponentielles de la charge quotidienne
  const metriques = [];
  let ctl = 18;
  let atl = 18;
  for (let i = 89; i >= 0; i--) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const iso = dateIsoLocale(d);
    const charge = quotidien[iso] || 0;
    ctl += (charge - ctl) / 42;
    atl += (charge - atl) / 7;
    metriques.push({
      iso_date: iso,
      tss: charge,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
      duration_min: 0,
      activity_count: charge ? 1 : 0,
    });
  }

  return {
    profil: { display_name: 'Yanis', ftp: null, hr_max: 196, lthr: null, weight: null },
    metriques,
    seances,
    puissance: [
      { duration_s: 5, watts_90d: 674, watts_alltime: 790 },
      { duration_s: 15, watts_90d: 560, watts_alltime: 640 },
      { duration_s: 30, watts_90d: 470, watts_alltime: 520 },
      { duration_s: 60, watts_90d: 380, watts_alltime: 430 },
      { duration_s: 300, watts_90d: 290, watts_alltime: 330 },
      { duration_s: 600, watts_90d: 255, watts_alltime: 290 },
      { duration_s: 1200, watts_90d: 232, watts_alltime: 270 },
      { duration_s: 3600, watts_90d: 205, watts_alltime: 245 },
    ],
    planifiees: [
      { id: 'demo-p1', name: 'Fractionné 8 × 400 m', date: dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 1)), sport: 'Run', duration: 55, tss: 70, category: 'entrainement', km: null },
      { id: 'demo-p2', name: 'Endurance vélo', date: dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 2)), sport: 'Ride', duration: 90, tss: 62, category: 'entrainement', km: null },
      { id: 'demo-p3', name: 'Sortie longue', date: dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 6)), sport: 'Ride', duration: 180, tss: 95, category: 'entrainement', km: null },
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', duration: 40, tss: null, category: 'competition', km: 10.15 },
    ],
    objectifs: [
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', km: 10.15, d_plus: 42, priority: 'A', duration: 40, category: 'competition' },
    ],
  };
}

/**
 * Streams d'exemple pour le mode démo (une valeur par seconde), au même format que ceux de Strava :
 * [{ type, data }]. Muscu : pas de courbes (renvoie null), comme une vraie séance de force sur Strava.
 */
export function streamsDemo(seance) {
  if (!seance || seance.sport === 'WeightTraining') return null;
  const n = Math.max(600, Math.round(seance.moving_time || 3600));
  const velo = seance.sport === 'Ride';
  const temps = Array.from({ length: n }, (_, i) => i);
  const altitude = temps.map((i) => 120 + 38 * Math.sin(i / 380) + 14 * Math.sin(i / 97 + 1) + i * 0.004);
  const watts = velo ? temps.map((i) => Math.max(0, Math.round(150 + 55 * Math.sin(i / 70) + 35 * Math.sin(i / 23) + (i % 900 > 640 ? 80 : 0)))) : null;
  const vitesse = temps.map((i) => (velo ? 7.4 + 1.6 * Math.sin(i / 90) : 3.1 + 0.35 * Math.sin(i / 120) + (i > n * 0.8 ? 0.3 : 0)));
  const fc = temps.map((i) => Math.round(118 + 38 * (1 - Math.exp(-i / 420)) + 6 * Math.sin(i / 60)));
  let d = 0;
  const distance = vitesse.map((v) => (d += v));
  const streams = [
    { type: 'time', data: temps },
    { type: 'altitude', data: altitude.map((v) => Math.round(v * 10) / 10) },
    { type: 'velocity_smooth', data: vitesse.map((v) => Math.round(v * 100) / 100) },
    { type: 'heartrate', data: fc },
    { type: 'distance', data: distance.map((v) => Math.round(v)) },
  ];
  if (watts) streams.push({ type: 'watts', data: watts });
  return streams;
}

/** Segments d'une nuit d'exemple : [début_min, fin_min, niveau] (0 profond, 1 léger, 2 paradoxal, 3 éveillé). */
function segmentsDemo(totalMin, i) {
  const segs = [];
  let t = 0;
  const ajoute = (duree, niveau) => {
    const fin = Math.min(totalMin, t + duree);
    if (fin > t) segs.push([t, fin, niveau]);
    t = fin;
  };
  ajoute(6 + (i % 5) * 4, 3); // endormissement
  let cycle = 0;
  while (t < totalMin) {
    ajoute(18 + ((i + cycle) % 4) * 3, 1);
    ajoute(Math.max(8, 38 - cycle * 8), 0);
    ajoute(15 + ((i * 3 + cycle) % 5) * 3, 1);
    ajoute(8 + cycle * 7, 2);
    if ((i + cycle) % 3 === 0) ajoute(3, 3);
    cycle++;
  }
  return segs;
}

/** FC minute par minute d'une nuit d'exemple ([minute, bpm]). */
export function fcNuitDemo(nuit) {
  const total = Math.round(((nuit?.total_sec || 25000) + (nuit?.awake_sec || 0)) / 60);
  const base = Number(nuit?.avg_heart_rate) || 54;
  const graine = String(nuit?.date || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: total }, (_, m) => [m, Math.round(base + 6 * Math.exp(-m / 90) + 3 * Math.sin((m + graine) / 22) + ((m * 7 + graine) % 5) / 2)]);
}

/** Nuits d'exemple (la plus récente d'abord), même forme que les lignes de garmin_sleep. */
export function sommeilDemo(aujourdhui = new Date(), nombre = 45) {
  const nuits = [];
  for (let i = 0; i < nombre; i++) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const veille = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    const total = 6 * 3600 + 20 * 60 + ((i * 37) % 11) * 360; // 6h20 à 7h56
    const eveille = 900 + ((i * 7) % 5) * 240;
    const couche = 22 * 60 + 40 + ((i * 17) % 9) * 8 + (i % 7 === 5 || i % 7 === 6 ? 50 : 0); // coucher plus tard le week-end
    const leve = (couche + (total + eveille) / 60) % 1440;
    const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
    nuits.push({
      date: dateIsoLocale(d),
      bedtime: `${dateIsoLocale(veille)} ${hm(couche)}`,
      wake_time: `${dateIsoLocale(d)} ${hm(leve)}`,
      total_sec: total,
      deep_sec: Math.round(total * (0.12 + ((i * 5) % 7) / 100)),
      rem_sec: Math.round(total * (0.18 + ((i * 3) % 6) / 100)),
      light_sec: Math.round(total * 0.62),
      awake_sec: eveille,
      awake_count: 1 + (i % 5),
      restless_count: 20 + ((i * 11) % 40),
      avg_stress: 18 + (i % 9) + (i % 6 === 0 ? 14 : 0),
      avg_heart_rate: 52 + (i % 5),
      resting_heart_rate: 48 + (i % 4),
      body_battery_change: 48 + ((i * 5) % 30),
      hrv_avg: 58 + ((i * 3) % 14) - (i > 20 ? 4 : 0) - (i === 0 ? 9 : 0),
      hrv_status: 'BALANCED',
      resp_avg: 14 + (i % 4) * 0.5,
      resp_min: 11 + (i % 3),
      resp_max: 18 + (i % 3),
      spo2_avg: 94 + (i % 4),
      score: 66 + ((i * 11) % 24),
      score_qualifier: 'GOOD',
      segments: segmentsDemo(Math.round((total + eveille) / 60), i),
    });
  }
  return nuits;
}

/** Compétitions d'exemple : à venir (activity_planned) et déjà courues (activités marquées « competition »). */
export function competitionsDemo(aujourdhui = new Date()) {
  const jour = (delta) => dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + delta));
  const prevue = (id, name, delta, sport, priority, km, d_plus, duration, type, notes = null) => ({
    id, name, date: jour(delta), start_date_local: `${jour(delta)}T09:00:00`, sport, priority, km, d_plus, duration, type, notes, category: 'competition',
  });
  return {
    prevues: [
      prevue('demo-comp-b1', 'Cyclo des Vignes', 27, 'Ride', 'B', 82, 850, 150, 'Cyclosportive', 'Sortie test avant la saison.'),
      prevue('demo-ramonville', 'Ronde de Ramonville', 62, 'Run', 'A', 10.15, 42, 40, 'Route', "Objectif de l'automne : passer sous les 40 minutes."),
      prevue('demo-comp-b2', 'Trail des Crêtes', 120, 'TrailRun', 'B', 24, 1300, 195, 'Trail'),
    ],
    courues: [
      { id: 'demo-comp-c1', name: '10 km de Blagnac', sport: 'Run', start_date_local: `${jour(-43)}T09:00:00+00:00`, moving_time: 2472, distance_km: 10, total_elevation_gain: 38, avg_heartrate: 176, avg_watts: null, np: null, tss: 71, category: 'competition', priority: 'A', result_place: null, result_total: null, result_catev: null },
      { id: 'demo-comp-c2', name: 'Cyclo de la Garonne', sport: 'Ride', start_date_local: `${jour(-22)}T08:30:00+00:00`, moving_time: 15300, distance_km: 82, total_elevation_gain: 850, avg_heartrate: 158, avg_watts: 205, np: 225, tss: 210, category: 'competition', priority: 'B', result_place: null, result_total: null, result_catev: null },
    ],
  };
}

/** Activités d'exemple sur 3 ans (forme des lignes de la table activities), pour le bilan en démo. */
export function activitesBilanDemo(maintenant = new Date()) {
  const lignes = [];
  const modele = [
    null,
    { sport: 'Run', min: 55, km: 10.5, d: 60 },
    { sport: 'WeightTraining', min: 55, km: 0, d: 0 },
    { sport: 'Run', min: 45, km: 8.2, d: 40 },
    { sport: 'Swim', min: 45, km: 1.8, d: 0 },
    { sport: 'Ride', min: 80, km: 36, d: 250 },
    { sport: 'Ride', min: 160, km: 72, d: 900 },
  ];
  for (let a = maintenant.getFullYear() - 2; a <= maintenant.getFullYear(); a++) {
    const progression = 0.78 + (a - (maintenant.getFullYear() - 2)) * 0.12; // l'athlète s'entraîne un peu plus chaque année
    for (let j = 0; j < 366; j++) {
      const d = new Date(a, 0, 1 + j, 12);
      if (d.getFullYear() !== a || d > maintenant) continue;
      const m = modele[d.getDay() === 0 ? 6 : d.getDay()];
      if (!m || (j * 7 + a) % 9 === 0) continue; // un jour sur neuf de repos en plus
      const v = (0.85 + ((j * 13) % 30) / 100) * progression;
      lignes.push({
        id: `demo-bilan-${a}-${j}`,
        name: `${m.sport === 'Ride' ? 'Sortie vélo' : m.sport === 'Run' ? 'Footing' : m.sport === 'Swim' ? 'Natation' : 'Séance'} ${j}`,
        sport: m.sport,
        start_date_local: `${dateIsoLocale(d)}T18:00:00+00:00`,
        moving_time: Math.round(m.min * 60 * v),
        distance_km: m.km ? Math.round(m.km * v * 100) / 100 : null,
        total_elevation_gain: m.d ? Math.round(m.d * v) : null,
        tss: Math.round(m.min * 0.9 * v),
      });
    }
  }
  return lignes;
}

/** Objectifs annuels d'exemple. */
export function objectifsAnnuelsDemo(maintenant = new Date()) {
  const annee = maintenant.getFullYear();
  return [
    { id: 'demo-g1', annee, sport: 'course', template: 'run_dist', target: 1500 },
    { id: 'demo-g2', annee, sport: 'cyclisme', template: 'cyc_dist', target: 8000 },
    { id: 'demo-g3', annee, sport: 'tous', template: 'all_hours', target: 380 },
    { id: 'demo-g4', annee, sport: 'course', template: 'run_10k', target: 40, currentManual: 42.5 },
  ];
}

/** Modèles de séances d'exemple (forme des lignes de activity_template). */
export function modelesDemo() {
  return [
    { id: 'demo-m1', sport: 'cyclisme', sport_raw: 'Ride', name: '4×4 VO2max', duration_min: 53, tss: 48, description: 'Après un bon échauffement.', rpe: 8, distance_km: null, dplus: null, structure: [
      { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'power', unit: 'zone', work: { min: 15, int: 40, intHi: 55 } },
      { type: 'interval', name: '4×4 VO2', reps: 4, metric: 'power', unit: 'zone', work: { min: 4, int: 106, intHi: 120 }, rec: { min: 3, int: 40, intHi: 55 } },
      { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'power', unit: 'zone', work: { min: 10, int: 40, intHi: 55 } },
    ] },
    { id: 'demo-m2', sport: 'cyclisme', sport_raw: 'Ride', name: 'Endurance 2 h', duration_min: 120, tss: 85, description: null, rpe: 4, distance_km: 55, dplus: null, structure: null },
    { id: 'demo-m3', sport: 'course', sport_raw: 'Run', name: 'Footing facile', duration_min: 50, tss: 40, description: 'Aisance respiratoire.', rpe: 3, distance_km: 9, dplus: null, structure: null },
    { id: 'demo-m4', sport: 'musculation', sport_raw: 'WeightTraining', name: 'Haut du corps', duration_min: 60, tss: 45, description: null, rpe: 6, distance_km: null, dplus: null, structure: null },
  ];
}

/** Séance prévue d'exemple pour la démo de « Prévu contre réalisé » (sortie vélo : 4×4 min). */
export function prevueDemo(seance) {
  const jour = String(seance.start_date_local).slice(0, 10);
  return {
    id: 'demo-prevue',
    name: 'Séance VO2 : 4×4 min',
    date: jour,
    sport: 'Ride',
    duration: 60,
    tss: 58,
    km: null,
    category: 'entrainement',
    structure: [
      { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'power', unit: 'zone', work: { min: 12, int: 45, intHi: 55 } },
      { type: 'interval', name: '4×4 VO2', reps: 4, metric: 'power', unit: 'zone', work: { min: 4, int: 106, intHi: 120 }, rec: { min: 3, int: 40, intHi: 55 } },
      { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'power', unit: 'zone', work: { min: 8, int: 40, intHi: 55 } },
    ],
  };
}

/** Licence et palmarès Open Dossard d'exemple (forme des résultats normalisés par opendossard.js). */
export function palmaresDemo(maintenant = new Date()) {
  const an = maintenant.getFullYear();
  const r = (annee, mois, jour, nom, place, total, categorie = '3') => ({ date: `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`, nom, place, total, categorie, idCompetition: null, source: 'od' });
  return {
    licence: { id: 'demo-licence', numero: '1234567', prenom: 'Yanis', nom: 'Jaber', club: 'UV Toulouse', departement: '31' },
    resultats: [
      r(an, 9, 20, 'Grand Prix de Ramonville', 3, 52),
      r(an, 8, 30, 'Critérium de Blagnac', 1, 38),
      r(an, 6, 14, 'Prix de Saint-Orens', 12, 60),
      r(an, 4, 5, 'Course de Castanet', 7, 45),
      r(an - 1, 9, 8, 'Grand Prix de Labège', 2, 49),
      r(an - 1, 6, 22, 'Prix de Colomiers', 15, 55),
      r(an - 1, 3, 30, "Ronde d'Auzeville", 4, 41),
    ],
  };
}
