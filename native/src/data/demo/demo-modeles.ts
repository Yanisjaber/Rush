// Les modèles de séance de la démo (la vraie liste vient de la table activity_template).
import type { Modele } from '../calendrier/modeles.ts';

const bloc = (type: string, min: number, int: number, intHi: number | null = null, metric = 'power') => ({ type, metric, unit: 'zone', work: { min, int, intHi } });
const intervalles = (reps: number, min: number, int: number, intHi: number, recMin: number, metric = 'power') => ({
  type: 'interval', reps, metric, unit: 'zone', work: { min, int, intHi }, rec: { min: recMin, int: 40, intHi: 55 },
});

export const modelesDemo = (): Modele[] => [
  {
    id: 'demo-modele-seuil', sport: 'cyclisme', sport_raw: 'Ride', name: 'Seuil 5 × 4 min', duration_min: 50, tss: 55, description: 'Cinq intervalles au seuil.', rpe: null, distance_km: null, dplus: null,
    structure: [bloc('warmup', 10, 56, 75), intervalles(5, 4, 91, 105, 2), bloc('cooldown', 10, 40, 55)],
  },
  {
    id: 'demo-modele-endurance', sport: 'cyclisme', sport_raw: 'Ride', name: 'Endurance longue', duration_min: 150, tss: 110, description: 'Sortie longue en zone 2.', rpe: null, distance_km: 70, dplus: null,
    structure: [bloc('steady', 150, 56, 75)],
  },
  {
    id: 'demo-modele-pyramide', sport: 'course', sport_raw: 'Run', name: 'Pyramide 10 km', duration_min: 50, tss: 55, description: 'Pyramide d\'allures : 3, 5, 3 minutes.', rpe: null, distance_km: 10, dplus: null,
    structure: [bloc('warmup', 10, 60, 75, 'pace'), bloc('steady', 3, 85, 95, 'pace'), bloc('steady', 5, 95, 106, 'pace'), bloc('steady', 3, 85, 95, 'pace'), bloc('cooldown', 10, 60, 75, 'pace')],
  },
  {
    id: 'demo-modele-natation', sport: 'natation', sport_raw: 'Swim', name: 'Natation technique', duration_min: 40, tss: 30, description: 'Éducatifs puis allure.', rpe: null, distance_km: 1.8, dplus: null,
    structure: [bloc('warmup', 8, 60, 75, 'pace'), intervalles(4, 4, 85, 95, 1, 'pace'), bloc('cooldown', 6, 60, 75, 'pace')],
  },
  {
    id: 'demo-modele-force', sport: 'musculation', sport_raw: 'WeightTraining', name: 'Haut du corps', duration_min: 60, tss: 45, description: null, rpe: 6, distance_km: null, dplus: null,
    structure: null,
  },
];
