// Données d'exemple pour le mode démo : mêmes formes que les réponses de l'API, générées de façon déterministe.
// Elles servent à montrer et à tester l'interface sans être connecté. Port de app/src/lib/data/demo.js
// (sans les retouches faites en démo, ni la puissance, le sommeil, Hyrox… qui viendront avec leurs écrans).
import { familleAffichage } from './familles.ts';
import { dateIsoLocale } from './format.ts';
import type { ObjectifAnnuel } from './bilan.ts';
import { valeurValide, type LigneMesure } from './sante-catalogue.ts';
import type { Nuit, SegmentNuit, Metrique, Note, Objectif, ObjectifHyrox, PointPuissance, Prevue, ProgrammeForce, Seance, SerieForce, TestHyrox, Tour } from './types.ts';

interface ModeleJour {
  sport: string;
  nom: string;
  min: number;
  tss: number;
}

export interface DonneesDemo {
  profil: { ftp: number | null; hr_max: number; lthr: number | null; weight: number | null; extras: Record<string, unknown> };
  metriques: Metrique[];
  puissance: PointPuissance[];
  seances: Seance[];
  planifiees: Prevue[];
  objectifs: Objectif[];
}

export function donneesDemo(aujourdhui: Date = new Date(), nbJours = 84, options: { prevuesAujourdhui?: number } = {}): DonneesDemo {
  const seances: Seance[] = [];
  const quotidien: Record<string, number> = {}; // date ISO → points de charge du jour

  // Semaine type : lundi muscu, mardi course, mercredi vélo, jeudi course, vendredi muscu, samedi course, dimanche vélo
  const modele: Record<number, ModeleJour> = {
    1: { sport: 'WeightTraining', nom: 'Push', min: 65, tss: 55 },
    2: { sport: 'Run', nom: 'Fractionné', min: 55, tss: 70 },
    3: { sport: 'Ride', nom: 'Endurance vélo', min: 90, tss: 62 },
    4: { sport: 'Run', nom: 'Footing facile', min: 50, tss: 40 },
    5: { sport: 'WeightTraining', nom: 'Pull', min: 60, tss: 50 },
    6: { sport: 'Run', nom: 'Sortie tempo', min: 60, tss: 78 },
    0: { sport: 'Ride', nom: 'Sortie longue', min: 150, tss: 95 },
  };

  for (let i = nbJours - 1; i >= 0; i--) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const base = modele[d.getDay()];
    const m = base && d.getDay() === 5 && Math.floor(i / 7) % 2 === 1 ? { ...base, nom: 'Legs' } : base;
    // un jour sur neuf de repos en plus, pour une régularité réaliste
    if (!m || (i * 7) % 9 === 0) continue;
    const variation = 0.85 + ((i * 13) % 30) / 100;
    const iso = dateIsoLocale(d);
    const tss = Math.round(m.tss * variation);
    quotidien[iso] = (quotidien[iso] || 0) + tss;
    // La vitesse en course progresse doucement sur 12 semaines (de 10,6 à 11,8 km/h) : de quoi montrer l'efficacité
    const vitesseCourse = 10.6 + ((83 - Math.min(i, 83)) / 83) * 1.2;
    const distance = m.sport === 'Run' ? (m.min / 60) * vitesseCourse : m.sport === 'Ride' ? (m.min / 60) * 27 : null;
    const fc = 142 + ((i * 3) % 18);
    seances.push({
      id: `demo-${iso}`,
      name: m.nom,
      sport: m.sport,
      start_date_local: `${iso}T18:00:00+00:00`,
      moving_time: Math.round(m.min * 60 * variation),
      distance_km: distance ? Math.round(distance * variation * 100) / 100 : null,
      total_elevation_gain: m.sport === 'WeightTraining' ? null : Math.round(40 + ((i * 17) % 200)),
      avg_heartrate: fc,
      // La FTP monte doucement sur 12 semaines (de 238 à 252 W), pour que son évolution se voie
      ftp_at_time: m.sport === 'Ride' ? Math.round(238 + ((83 - Math.min(i, 83)) / 83) * 14) : null,
      // À vélo, les watts suivent le cardio (environ 3 W par battement) et progressent un peu avec les semaines : de quoi montrer l'équivalence cardio et watts
      avg_watts: m.sport === 'Ride' ? Math.round(150 + (fc - 142) * 3 + ((83 - Math.min(i, 83)) / 83) * 8) : null,
      np: m.sport === 'Ride' ? 142 + ((i * 7) % 40) : null,
      tss,
      category: 'entrainement',
    });
    // Une semaine sur deux, la sortie vélo est suivie d'une course dans la foulée (un enchaînement : le triathlon et le duathlon en ont besoin)
    if (m.sport === 'Ride' && Math.floor(i / 7) % 2 === 0) {
      const debut = 18 * 60 + Math.ceil((m.min * variation) ) + 8; // 8 minutes de transition après la fin du vélo
      const heure = `${String(Math.floor(debut / 60)).padStart(2, '0')}:${String(debut % 60).padStart(2, '0')}`;
      quotidien[iso] = (quotidien[iso] || 0) + 22;
      seances.push({
        id: `demo-brick-${iso}`,
        name: 'Enchaînement course',
        sport: 'Run',
        start_date_local: `${iso}T${heure}:00+00:00`,
        moving_time: 25 * 60,
        distance_km: 4.7,
        total_elevation_gain: 20,
        avg_heartrate: 155,
        ftp_at_time: null,
        avg_watts: null,
        np: null,
        tss: 22,
        category: 'entrainement',
      });
    }
  }
  // Un footing déjà fait ce matin, en plus de la séance prévue du jour : la démo montre ainsi une journée à deux séances
  const isoAujourdhui = dateIsoLocale(aujourdhui);
  seances.push({
    id: `demo-matin-${isoAujourdhui}`,
    name: 'Footing du matin',
    sport: 'Run',
    start_date_local: `${isoAujourdhui}T07:30:00+00:00`,
    moving_time: 2400,
    distance_km: 7.4,
    total_elevation_gain: 55,
    avg_heartrate: 141,
    ftp_at_time: null,
    avg_watts: null,
    np: null,
    tss: 35,
    category: 'entrainement',
  });
  // Des séances Hyrox environ toutes les semaines (stations, demi-simulations, runs), pour que le suivi Hyrox ait quelque chose à montrer
  const hyroxDemo = [
    { i: 5, nom: 'Hyrox, stations', min: 60, tss: 55 },
    { i: 12, nom: 'Hyrox, demi-simulation', min: 70, tss: 68 },
    { i: 19, nom: 'Hyrox, runs et wall balls', min: 55, tss: 52 },
    { i: 26, nom: 'Hyrox, stations', min: 60, tss: 55 },
    { i: 33, nom: 'Hyrox, demi-simulation', min: 75, tss: 72 },
    { i: 40, nom: 'Hyrox, stations', min: 55, tss: 50 },
    { i: 47, nom: 'Hyrox, runs et wall balls', min: 50, tss: 48 },
    { i: 54, nom: 'Hyrox, demi-simulation', min: 70, tss: 66 },
    { i: 61, nom: 'Hyrox, stations', min: 55, tss: 52 },
    { i: 68, nom: 'Hyrox, demi-simulation', min: 65, tss: 62 },
  ];
  for (const h of hyroxDemo) {
    if (h.i >= nbJours) continue;
    const iso = dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - h.i));
    quotidien[iso] = (quotidien[iso] || 0) + h.tss;
    seances.push({
      id: `demo-hyrox-${iso}`,
      name: h.nom,
      sport: 'Hyrox',
      start_date_local: `${iso}T19:00:00+00:00`,
      moving_time: h.min * 60,
      distance_km: null,
      total_elevation_gain: null,
      avg_heartrate: 148 + ((h.i * 3) % 12),
      ftp_at_time: null,
      avg_watts: null,
      np: null,
      tss: h.tss,
      category: 'entrainement',
    });
  }
  // Du ski à roulettes environ toutes les semaines (l'entraînement d'automne) et quelques séances en tunnel de ski de fond, qui a de la neige toute l'année
  const skiDemo = [
    { i: 6, nom: 'Roulettes classique', sport: 'RollerSki', km: 24, dPlus: 220, min: 95 },
    { i: 13, nom: 'Roulettes skating', sport: 'RollerSki', km: 28, dPlus: 310, min: 105 },
    { i: 20, nom: 'Roulettes intervalles', sport: 'RollerSki', km: 18, dPlus: 180, min: 70 },
    { i: 27, nom: 'Roulettes longue', sport: 'RollerSki', km: 34, dPlus: 420, min: 125 },
    { i: 35, nom: 'Roulettes classique', sport: 'RollerSki', km: 22, dPlus: 190, min: 90 },
    { i: 42, nom: 'Roulettes skating', sport: 'RollerSki', km: 26, dPlus: 280, min: 100 },
    { i: 49, nom: 'Roulettes côtes', sport: 'RollerSki', km: 20, dPlus: 450, min: 85 },
    { i: 57, nom: 'Roulettes longue', sport: 'RollerSki', km: 32, dPlus: 380, min: 120 },
    { i: 64, nom: 'Roulettes classique', sport: 'RollerSki', km: 21, dPlus: 200, min: 88 },
    { i: 71, nom: 'Tunnel de ski de fond', sport: 'NordicSki', km: 14, dPlus: 90, min: 70 },
    { i: 76, nom: 'Tunnel de ski de fond', sport: 'NordicSki', km: 12, dPlus: 70, min: 62 },
    { i: 81, nom: 'Tunnel de ski de fond', sport: 'NordicSki', km: 16, dPlus: 110, min: 78 },
  ];
  for (const k of skiDemo) {
    if (k.i >= nbJours) continue;
    const iso = dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - k.i));
    const tss = Math.round(k.min * 0.7);
    quotidien[iso] = (quotidien[iso] || 0) + tss;
    seances.push({
      id: `demo-ski-${iso}`,
      name: k.nom,
      sport: k.sport,
      start_date_local: `${iso}T17:30:00+00:00`,
      moving_time: k.min * 60,
      distance_km: k.km,
      total_elevation_gain: k.dPlus,
      avg_heartrate: 148 + ((k.i * 5) % 18),
      ftp_at_time: null,
      avg_watts: null,
      np: null,
      tss,
      category: 'entrainement',
    });
  }
  // De la natation environ deux fois par semaine, qui progresse doucement (de 2'05 à 1'52 au 100 m) ; la démo n'en avait pas
  const nageDemo = [
    { i: 2, nom: 'Natation technique', km: 1.5 }, { i: 6, nom: 'Séries 8 × 100 m', km: 1.8 }, { i: 9, nom: 'Natation endurance', km: 2.2 },
    { i: 13, nom: 'Natation technique', km: 1.5 }, { i: 16, nom: 'Séries 8 × 100 m', km: 1.8 }, { i: 23, nom: 'Natation endurance', km: 2.4 },
    { i: 27, nom: 'Natation technique', km: 1.4 }, { i: 30, nom: 'Séries 8 × 100 m', km: 1.8 }, { i: 37, nom: 'Natation endurance', km: 2.2 },
    { i: 44, nom: 'Natation technique', km: 1.5 }, { i: 51, nom: 'Séries 8 × 100 m', km: 1.7 }, { i: 58, nom: 'Natation endurance', km: 2.0 },
    { i: 65, nom: 'Natation technique', km: 1.4 }, { i: 72, nom: 'Natation endurance', km: 2.0 },
    { i: 20, nom: 'Natation longue', km: 3.0 }, { i: 34, nom: 'Technique courte', km: 0.9 },
  ];
  for (const n of nageDemo) {
    if (n.i >= nbJours) continue;
    const iso = dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - n.i));
    // Secondes pour 100 m : on nage un peu plus lentement sur les longues séances et plus vite sur les courtes
    const allure100 = 112 + (Math.min(n.i, 83) / 83) * 13 + (n.km >= 2.5 ? 6 : n.km < 1.5 ? -4 : 0);
    const secondes = Math.round(n.km * 10 * allure100);
    const tss = Math.round(secondes / 60 * 0.75);
    quotidien[iso] = (quotidien[iso] || 0) + tss;
    seances.push({
      id: `demo-nage-${iso}`,
      name: n.nom,
      sport: 'Swim',
      start_date_local: `${iso}T12:30:00+00:00`,
      moving_time: secondes,
      distance_km: n.km,
      total_elevation_gain: null,
      avg_heartrate: 132 + ((n.i * 3) % 10),
      ftp_at_time: null,
      avg_watts: null,
      np: null,
      tss,
      category: 'entrainement',
    });
  }
  // Un triathlon et un duathlon déjà courus : ils font apparaître les deux onglets dans la démo
  for (const c of [
    { i: 22, nom: 'Triathlon S de Castres', sport: 'Triathlon', min: 82, km: 25.75, dPlus: 180, tss: 95 },
    { i: 50, nom: 'Duathlon de Revel', sport: 'Duathlon', min: 95, km: 27, dPlus: 240, tss: 88 },
  ]) {
    if (c.i >= nbJours) continue;
    const iso = dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - c.i));
    quotidien[iso] = (quotidien[iso] || 0) + c.tss;
    seances.push({
      id: `demo-course-${iso}`,
      name: c.nom,
      sport: c.sport,
      start_date_local: `${iso}T09:30:00+00:00`,
      moving_time: c.min * 60,
      distance_km: c.km,
      total_elevation_gain: c.dPlus,
      avg_heartrate: 163,
      ftp_at_time: null,
      avg_watts: null,
      np: null,
      tss: c.tss,
      category: 'competition',
    });
  }
  seances.sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1));

  // CTL (42 jours) et ATL (7 jours) : moyennes exponentielles de la charge quotidienne
  const metriques: Metrique[] = [];
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

  const plusJours = (n: number) => dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + n));

  return {
    profil: { ftp: null, hr_max: 196, lthr: null, weight: null, extras: { first_name: 'Yanis', last_name: 'Jaber', cp: 245, wprime: 19, threshold_speed: 15 } },
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
      // Les séances prévues aujourd'hui (toujours, quelle que soit la date) : trois par défaut, de trois sports ; le réglage de la démo
      // (Paramètres) en garde de 0 à 5, pour montrer chaque cas de la « Séance du jour ». La première est reliée à un programme de force.
      ...(
        [
          { id: 'demo-p0', name: 'Legs', date: plusJours(0), sport: 'WeightTraining', duration: 54, tss: 45, category: 'entrainement', km: null, programme_id: 'demo-prog-legs' },
          { id: 'demo-p0b', name: 'Natation technique', date: plusJours(0), sport: 'Swim', duration: 40, tss: 30, category: 'entrainement', km: 1.5 },
          { id: 'demo-p0c', name: 'Vélo en souplesse', date: plusJours(0), sport: 'Ride', duration: 45, tss: 28, category: 'entrainement', km: null },
          // Pas de course ici : le footing du matin (déjà fait) la validerait et elle disparaîtrait de la « Séance du jour »
          { id: 'demo-p0d', name: 'Hyrox, 4 stations', date: plusJours(0), sport: 'Hyrox', duration: 60, tss: 55, category: 'entrainement', km: null },
          { id: 'demo-p0e', name: 'Rameur', date: plusJours(0), sport: 'Rowing', duration: 30, tss: 25, category: 'entrainement', km: null },
        ] satisfies Prevue[]
      ).slice(0, Math.min(5, Math.max(0, Math.trunc(options.prevuesAujourdhui ?? 3)))),
      { id: 'demo-p1', name: 'Fractionné 8 × 400 m', date: plusJours(1), sport: 'Run', duration: 55, tss: 70, category: 'entrainement', km: null },
      { id: 'demo-p2', name: 'Endurance vélo', date: plusJours(2), sport: 'Ride', duration: 90, tss: 62, category: 'entrainement', km: null },
      { id: 'demo-p3', name: 'Sortie longue', date: plusJours(6), sport: 'Ride', duration: 180, tss: 95, category: 'entrainement', km: null },
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', duration: 40, tss: null, category: 'competition', km: 10.15 },
    ],
    objectifs: [
      { id: 'demo-hyrox-open', name: 'Hyrox Open', date: plusJours(27), sport: 'Hyrox', km: null, d_plus: null, priority: 'A', duration: 70, category: 'competition' },
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', km: 10.15, d_plus: 42, priority: 'A', duration: 40, category: 'competition' },
      { id: 'demo-transju', name: 'La Transjurassienne', date: plusJours(110), sport: 'NordicSki', km: 50, d_plus: 700, priority: 'A', duration: 300, category: 'competition' },
      { id: 'demo-traversee', name: 'Traversée du lac d\'Annecy', date: plusJours(70), sport: 'Swim', km: 4, d_plus: null, priority: 'B', duration: 110, category: 'competition' },
      { id: 'demo-triathlon-gruissan', name: 'Triathlon M de Gruissan', date: plusJours(90), sport: 'Triathlon', km: 51.5, d_plus: null, priority: 'A', duration: 150, category: 'competition' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Force (mode démo)
// ---------------------------------------------------------------------------

const PROGRAMMES_BASE: ProgrammeForce[] = [
  { id: 'demo-prog-push', name: 'PUSH', created_at: '2026-01-01T10:00:00Z', notes: null, exercises: [
    { key: 'developpe-couche', name: 'Développé couché', group: 'pectoraux', sets: 4, reps: 8, weight: 82.5 },
    { key: 'developpe-incline-halteres', name: 'Développé incliné haltères', group: 'pectoraux', sets: 3, reps: 10, weight: 26 },
    { key: 'developpe-militaire', name: 'Développé militaire', group: 'epaules', sets: 4, reps: 8, weight: 50 },
    { key: 'elevations-laterales', name: 'Élévations latérales', group: 'epaules', sets: 3, reps: 15, weight: 10 },
    { key: 'extension-triceps-poulie', name: 'Extension triceps poulie', group: 'bras', sets: 4, reps: 12, weight: 25 },
    { key: 'dips', name: 'Dips', group: 'pectoraux', sets: 4, reps: 10, weight: 0 },
  ] },
  { id: 'demo-prog-pull', name: 'PULL', created_at: '2026-01-02T10:00:00Z', notes: null, exercises: [
    { key: 'souleve-de-terre', name: 'Soulevé de terre', group: 'dos', sets: 3, reps: 5, weight: 140 },
    { key: 'tractions', name: 'Tractions', group: 'dos', sets: 4, reps: 8, weight: 0 },
    { key: 'rowing-barre', name: 'Rowing barre', group: 'dos', sets: 4, reps: 8, weight: 70 },
    { key: 'tirage-vertical', name: 'Tirage vertical', group: 'dos', sets: 3, reps: 10, weight: 60 },
    { key: 'curl-barre', name: 'Curl barre', group: 'bras', sets: 3, reps: 10, weight: 30 },
  ] },
  { id: 'demo-prog-legs', name: 'LEGS', created_at: '2026-01-03T10:00:00Z', notes: null, exercises: [
    { key: 'squat', name: 'Squat', group: 'jambes', sets: 4, reps: 6, weight: 120 },
    { key: 'presse-a-cuisses', name: 'Presse à cuisses', group: 'jambes', sets: 3, reps: 10, weight: 200 },
    { key: 'fentes', name: 'Fentes', group: 'jambes', sets: 3, reps: 10, weight: 30 },
    { key: 'leg-curl', name: 'Leg curl', group: 'jambes', sets: 3, reps: 12, weight: 40 },
    { key: 'mollets-debout', name: 'Mollets debout', group: 'jambes', sets: 4, reps: 15, weight: 60 },
  ] },
];

/** Programmes de démo (PUSH, PULL, LEGS). */
export function programmesDemo(): ProgrammeForce[] {
  return PROGRAMMES_BASE.map((p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e })) }));
}

/** Séries d'exemple : les séances Push/Pull/Legs des 12 dernières semaines, avec des charges qui montent doucement. */
export function seriesForceDemo(aujourdhui: Date = new Date()): SerieForce[] {
  const { seances } = donneesDemo(aujourdhui);
  const lignes: SerieForce[] = [];
  for (const s of seances) {
    if (s.sport !== 'WeightTraining' || !/^demo-\d{4}-\d{2}-\d{2}$/.test(s.id)) continue; // séances d'exemple seulement
    const prog = PROGRAMMES_BASE.find((p) => p.name === String(s.name).toUpperCase());
    if (!prog) continue;
    const date = s.start_date_local.slice(0, 10);
    const jours = Math.round(
      (new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86400000,
    );
    const progression = 0.86 + 0.14 * ((83 - jours) / 83); // de 86 % à 100 % des charges du programme
    prog.exercises.forEach((e, position) => {
      for (let n = 1; n <= e.sets; n++) {
        const poids = e.weight ? Math.round((e.weight * progression) / 2.5) * 2.5 : 0;
        lignes.push({
          id: `demo-serie-${s.id}-${position}-${n}`,
          activity_id: s.id,
          date,
          exercise_key: e.key,
          exercise_name: e.name,
          muscle_group: e.group,
          position,
          set_no: n,
          reps: Math.max(1, e.reps - (n === e.sets ? 1 : 0)),
          weight_kg: poids,
          // Les 5 dernières semaines ont le RIR noté (les séries plus anciennes non : de quoi voir une couverture partielle)
          ...(jours < 35 ? { rir: n === e.sets ? 0 : 2 + (n % 2) } : {}),
        });
      }
    });
  }
  return lignes.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Tests Hyrox d'exemple : trois simulations qui progressent (runs plus rapides, stations mieux tenues), du plus récent au plus ancien. */
export function testsHyroxDemo(aujourdhui: Date = new Date()): TestHyrox[] {
  const jour = (delta: number) => dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + delta));
  // runs puis stations, dans l'ordre : run1, ski, run2, push, run3, pull, run4, bbj, run5, row, run6, farm, run7, lunge, run8, wall
  const fabriquer = (id: string, delta: number, label: string, runs: number[], stations: number[]): TestHyrox => {
    const segments: number[] = [];
    runs.forEach((r, k) => segments.push(r, stations[k]));
    return { id, date: jour(delta), label, kind: 'test', segments, total_s: segments.reduce((a, b) => a + b, 0), source: 'manuel', activity_id: null, notes: null };
  };
  return [
    fabriquer('demo-hx-3', -4, 'Simulation 8 × (1 km + station)', [285, 296, 305, 315, 322, 330, 336, 342], [235, 248, 236, 252, 245, 215, 220, 240]),
    fabriquer('demo-hx-2', -32, 'Simulation 8 × (1 km + station)', [298, 314, 326, 340, 352, 360, 368, 376], [262, 280, 268, 284, 276, 240, 246, 305]),
    fabriquer('demo-hx-1', -60, 'Premier test', [305, 322, 336, 352, 366, 378, 388, 398], [270, 292, 280, 298, 288, 250, 258, 322]),
  ];
}

/** Objectif Hyrox d'exemple : 1h10'00" au total. */
export function objectifHyroxDemo(): ObjectifHyrox {
  return { total_s: 4200, segments: null };
}

/** Notes et jours de repos d'exemple du calendrier (une blessure récente, deux jours de repos). */
export function annotationsDemo(aujourdhui: Date = new Date()): { notes: Note[]; repos: string[] } {
  const jour = (delta: number) => dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + delta));
  return {
    notes: [{ id: 'demo-n1', type: 'blessure', text: 'Genou gauche : on lève le pied', color: '#fb923c', from_date: jour(-3), to_date: jour(-1) }],
    repos: [jour(-6), jour(3)],
  };
}

/** Activités d'exemple sur 3 ans (forme des lignes de la table activities), pour le bilan en démo. */
export function activitesBilanDemo(maintenant: Date = new Date()): Seance[] {
  const lignes: Seance[] = [];
  const modele: ({ sport: string; min: number; km: number; d: number } | null)[] = [
    null,
    { sport: 'Run', min: 55, km: 10.5, d: 60 },
    { sport: 'WeightTraining', min: 55, km: 0, d: 0 },
    { sport: 'Run', min: 45, km: 8.2, d: 40 },
    { sport: 'Swim', min: 45, km: 1.8, d: 0 },
    { sport: 'Ride', min: 80, km: 36, d: 250 },
    { sport: 'Ride', min: 160, km: 72, d: 900 },
  ];
  for (let a = maintenant.getFullYear() - 5; a <= maintenant.getFullYear(); a++) {
    const progression = 0.6 + (a - (maintenant.getFullYear() - 5)) * 0.1; // l'athlète s'entraîne un peu plus chaque année
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
        avg_heartrate: null,
        ftp_at_time: null,
        avg_watts: null,
        np: null,
        category: 'entrainement',
      });
    }
  }
  return lignes;
}

/** Objectifs annuels d'exemple. */
export function objectifsAnnuelsDemo(maintenant: Date = new Date()): ObjectifAnnuel[] {
  const annee = maintenant.getFullYear();
  return [
    { id: 'demo-g1', annee, sport: 'course', template: 'run_dist', target: 1500 },
    { id: 'demo-g2', annee, sport: 'cyclisme', template: 'cyc_dist', target: 8000 },
    { id: 'demo-g3', annee, sport: 'tous', template: 'all_hours', target: 380 },
    { id: 'demo-g4', annee, sport: 'course', template: 'run_10k', target: 40, currentManual: 42.5 },
  ];
}

/** Segments d'une nuit d'exemple : [début_min, fin_min, niveau] (0 profond, 1 léger, 2 paradoxal, 3 éveillé). */
function segmentsDemo(totalMin: number, i: number): SegmentNuit[] {
  const segs: SegmentNuit[] = [];
  let t = 0;
  const ajoute = (duree: number, niveau: number) => {
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
export function fcNuitDemo(nuit: Partial<Nuit> | null): [number, number][] {
  const total = Math.round(((nuit?.total_sec || 25000) + (nuit?.awake_sec || 0)) / 60);
  const base = Number(nuit?.avg_heart_rate) || 54;
  const graine = String(nuit?.date || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: total }, (_, m) => [m, Math.round(base + 6 * Math.exp(-m / 90) + 3 * Math.sin((m + graine) / 22) + ((m * 7 + graine) % 5) / 2)] as [number, number]);
}

/**
 * Mesures de santé d'exemple (ressenti, événements, corps, nutrition, appareils) sur N jours, même forme que les lignes de `health_metrics`.
 * Déterministe : le même jour donne les mêmes valeurs (rien d'aléatoire), pour des écrans stables et des tests fiables.
 * Cohérent avec les nuits d'exemple : jour 0 = aujourd'hui. Une maladie (jours 27 à 29) et une blessure (jours 50 à 53) pour voir les freins.
 */
export function mesuresDemo(aujourdhui: Date = new Date(), nombre = 90): LigneMesure[] {
  const lignes: LigneMesure[] = [];
  const borne = (v: number, mini: number, maxi: number) => Math.min(maxi, Math.max(mini, v));
  for (let i = 0; i < nombre; i++) {
    const date = dateIsoLocale(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i));
    // Chaque valeur passe par la même validation que les vraies saisies : bornes et précision du catalogue
    const ajouter = (metric: string, value: number, source = 'manual') => {
      const v = valeurValide(metric, value);
      if (v != null) lignes.push({ date, metric, value: v, source });
    };
    const malade = i >= 27 && i <= 29;
    const blesse = i >= 50 && i <= 53;

    // Ressenti du matin : sauté un jour sur neuf (la vraie vie)
    if (i % 9 !== 4) {
      ajouter('ressenti_fatigue', borne(1 + ((i * 5) % 4) + (malade ? 2 : 0), 1, 5));
      ajouter('ressenti_courbatures', borne(1 + ((i * 7) % 4), 1, 5));
      ajouter('ressenti_humeur', borne(3 + ((i * 2) % 3) - (malade ? 2 : 0), 1, 5));
      ajouter('ressenti_motivation', borne(3 + (i % 3) - (malade || blesse ? 1 : 0), 1, 5));
      ajouter('ressenti_stress', borne(2 + ((i * 11) % 3), 1, 5));
    }
    // Événements
    if (malade) ajouter('evt_malade', 1);
    if (blesse) ajouter('evt_blesse', 1);
    if (i === 40 || i === 41) ajouter('evt_voyage', 1);
    if (i % 7 === 6) ajouter('alcool_verres', 2 + (i % 3));

    // Corps : le poids baisse doucement avec du bruit (une valeur sur deux vient d'Apple Santé, pour montrer la priorité des sources)
    const poids = 71.5 + i * 0.012 + (((i * 13) % 7) - 3) * 0.12;
    ajouter('poids_kg', poids, i % 2 === 0 ? 'apple_sante' : 'manual');
    if (i % 3 === 0) ajouter('masse_grasse_pct', 14.5 + i * 0.01 + (((i * 7) % 5) - 2) * 0.15, 'apple_sante');
    if (i % 3 === 0) ajouter('masse_musculaire_kg', 34.2 - i * 0.004 + (((i * 3) % 5) - 2) * 0.1, 'apple_sante');
    if (i % 7 === 1) {
      ajouter('tension_sys', 118 + ((i * 3) % 9) - 4);
      ajouter('tension_dia', 74 + (i % 6) - 2);
    }

    // Nutrition : sautée un jour sur onze
    if (i % 11 !== 3) {
      ajouter('calories_kcal', 2650 + (((i * 37) % 9) - 4) * 70);
      ajouter('proteines_g', 125 + (((i * 5) % 9) - 4) * 6);
      ajouter('eau_l', 2.4 + (((i * 3) % 5) - 2) * 0.2);
    }

    // Appareils (Whoop) : la respiration et la température montent quand on est malade
    ajouter('resp_nuit', 14.2 + (((i * 3) % 5) - 2) * 0.25 + (malade ? 1.5 : 0), 'whoop');
    ajouter('temp_cutanee_ecart', (((i * 7) % 9) - 4) * 0.08 + (malade ? 0.9 : 0), 'whoop');
  }
  return lignes;
}

/** Nuits d'exemple (la plus récente d'abord), même forme que les lignes de garmin_sleep. */
export function sommeilDemo(aujourdhui: Date = new Date(), nombre = 45): Nuit[] {
  const nuits: Nuit[] = [];
  for (let i = 0; i < nombre; i++) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const veille = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    const total = 6 * 3600 + 20 * 60 + ((i * 37) % 11) * 360; // 6h20 à 7h56
    const eveille = 900 + ((i * 7) % 5) * 240;
    const couche = 22 * 60 + 40 + ((i * 17) % 9) * 8 + (i % 7 === 5 || i % 7 === 6 ? 50 : 0); // coucher plus tard le week-end
    const leve = (couche + (total + eveille) / 60) % 1440;
    const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
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

/**
 * Les tours d'une séance de démo : un tour par kilomètre (le dernier prend le reste) pour une sortie d'au moins 2 km, avec un rythme qui varie un peu ;
 * pour Hyrox, les 16 segments d'un test (8 runs d'un kilomètre, 8 stations). Rien pour le reste (muscu…).
 */
export function toursDemo(s: Seance): Tour[] {
  if (familleAffichage(s.sport) === 'hyrox') {
    return testsHyroxDemo()[0].segments.map((t, i) => ({ index: i + 1, name: '', elapsed_time: t, moving_time: t, distance: i % 2 === 0 ? 1000 : 0 }));
  }
  const km = Number(s.distance_km);
  if (!(km >= 2) || !(s.moving_time > 0)) return [];
  const entiers = Math.min(30, Math.floor(km));
  const bruts = Array.from({ length: entiers }, (_, i) => 1 + (((i * 7) % 5) - 2) * 0.03); // ±6 % autour de l'allure moyenne
  const reste = km - entiers;
  const poids = [...bruts, ...(reste > 0.05 ? [reste] : [])];
  const somme = poids.reduce((a, b) => a + b, 0);
  return poids.map((w, i) => {
    const temps = Math.round((w / somme) * s.moving_time);
    return { index: i + 1, name: '', elapsed_time: temps, moving_time: temps, distance: i < entiers ? 1000 : Math.round(reste * 1000) };
  });
}
