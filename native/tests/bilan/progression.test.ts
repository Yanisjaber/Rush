import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courbeProgression, progressionSport, progressionTousSports } from '../../src/data/bilan/progression.ts';
import type { Seance, SerieForce } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 28); // 28 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const seance = (id: string, avant: number, sport: string, km: number, minutes: number, extra: Partial<Seance> = {}): Seance => ({
  id, name: null, sport, start_date_local: `${jour(avant)}T08:00:00`, moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});
const serie = (id: string, avant: number, exercice: string, poids: number, reps: number): SerieForce => ({
  id, activity_id: null, date: jour(avant), exercise_key: exercice, exercise_name: exercice, muscle_group: 'pectoraux', position: 0, set_no: 1, reps, weight_kg: poids,
});
const vide = { seances: [] as Seance[], series: [] as SerieForce[], hrMax: 190 };

test('course : une allure qui baisse à cardio égal = hausse', () => {
  // 10 km en 60 min (6:00/km) il y a 5-6 sem., puis 10 km en 55 min (5:30/km) ces 4 dernières semaines ; FC 140 = dans 60–80 % de 190
  const seances = [
    seance('a', 40, 'Run', 10, 60, { avg_heartrate: 140 }), seance('b', 35, 'Run', 10, 60, { avg_heartrate: 140 }),
    seance('c', 10, 'Run', 10, 55, { avg_heartrate: 140 }), seance('d', 3, 'Run', 10, 55, { avg_heartrate: 140 }),
  ];
  const p = progressionSport('course', { ...vide, seances }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.equal(p.variationPct, 8.3); // 360 s/km -> 330 s/km
  assert.equal(p.avant, 360);
  assert.equal(p.actuel, 330);
});

test('course : une allure qui monte = baisse', () => {
  const seances = [
    seance('a', 40, 'Run', 10, 55, { avg_heartrate: 140 }), seance('b', 35, 'Run', 10, 55, { avg_heartrate: 140 }),
    seance('c', 10, 'Run', 10, 60, { avg_heartrate: 140 }), seance('d', 3, 'Run', 10, 60, { avg_heartrate: 140 }),
  ];
  const p = progressionSport('course', { ...vide, seances }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'baisse');
  assert.equal(p.variationPct, -9.1);
});

test('course : écart sous 1 % = stable', () => {
  const seances = [
    seance('a', 40, 'Run', 10, 60, { avg_heartrate: 140 }), seance('b', 35, 'Run', 10, 60, { avg_heartrate: 140 }),
    seance('c', 10, 'Run', 10, 59.8, { avg_heartrate: 140 }), seance('d', 3, 'Run', 10, 59.8, { avg_heartrate: 140 }),
  ];
  assert.equal(progressionSport('course', { ...vide, seances }, 28, AUJOURDHUI)!.statut, 'stable');
});

test('course : sorties trop intenses ou trop courtes ignorées, une seule sortie = insuffisant', () => {
  const seances = [
    seance('a', 40, 'Run', 10, 60, { avg_heartrate: 140 }), seance('b', 35, 'Run', 10, 60, { avg_heartrate: 175 }), // 175 > 80 % de 190
    seance('c', 10, 'Run', 2, 10, { avg_heartrate: 140 }), seance('d', 3, 'Run', 10, 55, { avg_heartrate: 140 }), // 2 km : trop court
  ];
  const p = progressionSport('course', { ...vide, seances }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'insuffisant');
  assert.equal(p.variationPct, null);
  assert.ok(p.manque.length > 0);
});

test('course : les sorties plus vieilles que deux périodes ne comptent pas', () => {
  const seances = [seance('a', 100, 'Run', 10, 40, { avg_heartrate: 140 }), seance('b', 90, 'Run', 10, 40, { avg_heartrate: 140 }), seance('c', 3, 'Run', 10, 55, { avg_heartrate: 140 }), seance('d', 5, 'Run', 10, 55, { avg_heartrate: 140 })];
  assert.equal(progressionSport('course', { ...vide, seances }, 28, AUJOURDHUI)!.statut, 'insuffisant');
});

test('course : sur 1 an, la comparaison remonte à l\'an dernier', () => {
  const seances = [
    seance('a', 500, 'Run', 10, 66, { avg_heartrate: 140 }), seance('b', 450, 'Run', 10, 66, { avg_heartrate: 140 }),
    seance('c', 100, 'Run', 10, 55, { avg_heartrate: 140 }), seance('d', 20, 'Run', 10, 55, { avg_heartrate: 140 }),
  ];
  const p = progressionSport('course', { ...vide, seances }, 365, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.equal(p.variationPct, 16.7);
});

test('vélo : plus de watts au même cardio = hausse', () => {
  const seances = [
    seance('a', 40, 'Ride', 40, 90, { avg_heartrate: 135, avg_watts: 150 }), seance('b', 38, 'Ride', 40, 90, { avg_heartrate: 135, avg_watts: 150 }),
    seance('c', 8, 'Ride', 40, 90, { avg_heartrate: 135, avg_watts: 165 }), seance('d', 3, 'Ride', 40, 90, { avg_heartrate: 135, avg_watts: 165 }),
  ];
  const p = progressionSport('velo', { ...vide, seances }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.equal(p.variationPct, 10);
  assert.equal(p.actuel, 165);
});

test('natation : une allure au 100 m qui baisse = hausse', () => {
  // 2 km en 40 min = 120 s/100 m, puis 2 km en 36 min = 108 s/100 m
  const seances = [seance('a', 40, 'Swim', 2, 40), seance('b', 33, 'Swim', 2, 40), seance('c', 9, 'Swim', 2, 36), seance('d', 2, 'Swim', 2, 36)];
  const p = progressionSport('natation', { ...vide, seances }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.equal(p.variationPct, 10);
  assert.equal(p.avant, 120);
  assert.equal(p.actuel, 108);
});

test('muscu : le 1RM estimé compte, sur les exercices faits aux deux périodes', () => {
  // Développé couché : 80 kg x 5 avant (1RM ≈ 93,3) puis 90 kg x 5 (≈ 105). Le squat n'est fait qu'avant : ignoré.
  const series = [
    serie('1', 40, 'bench', 80, 5), serie('2', 38, 'squat', 100, 5),
    serie('3', 5, 'bench', 90, 5),
  ];
  const p = progressionSport('muscu', { ...vide, series }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.equal(p.variationPct, 12.5);
});

test('muscu : séries de plus de 12 répétitions ignorées, sans exercice commun = insuffisant', () => {
  const series = [serie('1', 40, 'bench', 40, 20), serie('2', 5, 'bench', 50, 20), serie('3', 40, 'squat', 100, 5), serie('4', 5, 'bench', 90, 5)];
  assert.equal(progressionSport('muscu', { ...vide, series }, 28, AUJOURDHUI)!.statut, 'insuffisant');
});

test('sport non mesurable : null', () => {
  assert.equal(progressionSport('hyrox', vide, 28, AUJOURDHUI), null);
});

test('progressionTousSports : seulement les sports pratiqués, dans un ordre stable', () => {
  const liste = progressionTousSports(['muscu', 'hyrox', 'course'], vide, 28, AUJOURDHUI);
  assert.deepEqual(liste.map((p) => p.famille), ['course', 'muscu']);
});

test('courbe course : 100 = niveau d\'avant, et une allure plus rapide monte au-dessus', () => {
  // Avant (28 à 55 jours) : 6:00/km. Puis 6:00/km (sem. 4), 5:30/km (sem. 2 et 1) : l'indice passe de 100 à ~109
  const seances = [
    seance('a', 40, 'Run', 10, 60, { avg_heartrate: 140 }), seance('b', 35, 'Run', 10, 60, { avg_heartrate: 140 }),
    seance('c', 24, 'Run', 10, 60, { avg_heartrate: 140 }), seance('d', 12, 'Run', 10, 55, { avg_heartrate: 140 }), seance('e', 3, 'Run', 10, 55, { avg_heartrate: 140 }),
  ];
  const c = courbeProgression('course', { ...vide, seances }, 28, AUJOURDHUI);
  assert.deepEqual(c, [100, 109.1, 109.1]); // la semaine 3 (jours 14-20) n'a pas de sortie : sautée
});

test('courbe : sans niveau de référence ou avec un seul point, pas de courbe', () => {
  const seances = [seance('c', 3, 'Run', 10, 55, { avg_heartrate: 140 }), seance('d', 12, 'Run', 10, 55, { avg_heartrate: 140 })];
  assert.deepEqual(courbeProgression('course', { ...vide, seances }, 28, AUJOURDHUI), []);
  assert.deepEqual(courbeProgression('hyrox', vide, 28, AUJOURDHUI), []);
});

test('courbe muscu : indice du 1RM par rapport à la période d\'avant', () => {
  // Référence (28 à 55 jours) : bench 80 x 5 ; puis 80 x 5 (sem. 3) et 90 x 5 (sem. 1)
  const series = [serie('1', 40, 'bench', 80, 5), serie('2', 18, 'bench', 80, 5), serie('3', 3, 'bench', 90, 5)];
  assert.deepEqual(courbeProgression('muscu', { ...vide, series }, 28, AUJOURDHUI), [100, 112.5]);
});
