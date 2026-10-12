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
    const distance = m.sport === 'Run' ? (m.min / 60) * 11.5 : m.sport === 'Ride' ? (m.min / 60) * 27 : null;
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
    objectifs: [
      { id: 'demo-ramonville', name: 'Ronde de Ramonville', date: '2026-12-13', sport: 'Run', km: 10.15, d_plus: 42, priority: 'A', duration: 40, category: 'competition' },
    ],
  };
}
