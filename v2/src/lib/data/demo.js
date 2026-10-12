// Données d'exemple pour le mode démo (?demo dans l'adresse) : mêmes formes que les réponses de l'API,
// générées de façon déterministe. Elles servent à montrer et à tester l'interface sans être connecté.
import { dateIsoLocale } from '../utils/format.js';

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
      avg_watts: m.sport === 'Ride' ? 135 + ((i * 5) % 40) : null,
      np: m.sport === 'Ride' ? 142 + ((i * 7) % 40) : null,
      tss,
      category: 'entrainement',
    });
  }
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
