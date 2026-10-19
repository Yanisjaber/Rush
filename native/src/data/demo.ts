// Données d'exemple pour le mode démo : mêmes formes que les réponses de l'API, générées de façon déterministe.
// Elles servent à montrer et à tester l'interface sans être connecté. Port de app/src/lib/data/demo.js
// (sans les retouches faites en démo, ni la puissance, le sommeil, Hyrox… qui viendront avec leurs écrans).
import { dateIsoLocale } from './format.ts';
import type { Metrique, Objectif, PointPuissance, Prevue, ProgrammeForce, Seance, SerieForce } from './types.ts';

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

export function donneesDemo(aujourdhui: Date = new Date(), nbJours = 84): DonneesDemo {
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
    profil: { ftp: null, hr_max: 196, lthr: null, weight: null, extras: { first_name: 'Yanis', last_name: 'Jaber', cp: 245, wprime: 19 } },
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
      // séance de muscu prévue aujourd'hui, reliée à un programme : la carte « Séance du jour » la montrera
      { id: 'demo-p0', name: 'Legs', date: plusJours(0), sport: 'WeightTraining', duration: 54, tss: 45, category: 'entrainement', km: null, programme_id: 'demo-prog-legs' },
      { id: 'demo-p1', name: 'Fractionné 8 × 400 m', date: plusJours(1), sport: 'Run', duration: 55, tss: 70, category: 'entrainement', km: null },
      { id: 'demo-p2', name: 'Endurance vélo', date: plusJours(2), sport: 'Ride', duration: 90, tss: 62, category: 'entrainement', km: null },
      { id: 'demo-p3', name: 'Sortie longue', date: plusJours(6), sport: 'Ride', duration: 180, tss: 95, category: 'entrainement', km: null },
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', duration: 40, tss: null, category: 'competition', km: 10.15 },
    ],
    objectifs: [
      { id: 'demo-hyrox-open', name: 'Hyrox Open', date: plusJours(27), sport: 'Hyrox', km: null, d_plus: null, priority: 'A', duration: 70, category: 'competition' },
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', km: 10.15, d_plus: 42, priority: 'A', duration: 40, category: 'competition' },
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
