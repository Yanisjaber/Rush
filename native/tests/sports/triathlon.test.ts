import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allureCourse4Semaines, bricks, bricksParSemaine, dernieresParDiscipline, disciplineDe, disciplinesDe, minutesParSemaine, repartitionDisciplines, reperesDisciplines } from '../../src/data/sports/triathlon.ts';
import type { Seance } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const seance = (id: string, avant: number, sport: string, minutes: number, extra: Partial<Seance> = {}, heure = '08:00:00'): Seance => ({
  id, name: id, sport, start_date_local: `${jour(avant)}T${heure}`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});

test('disciplinesDe / disciplineDe : trois disciplines en triathlon, deux en duathlon ; trail = course, VTT = vélo', () => {
  assert.deepEqual(disciplinesDe('triathlon'), ['natation', 'velo', 'course']);
  assert.deepEqual(disciplinesDe('duathlon'), ['course', 'velo']);
  assert.equal(disciplineDe({ sport: 'TrailRun' }), 'course');
  assert.equal(disciplineDe({ sport: 'MountainBikeRide' }), 'velo');
  assert.equal(disciplineDe({ sport: 'WeightTraining' }), null);
});

test('repartitionDisciplines : le temps par discipline sur 4 semaines, la musculation ne compte pas', () => {
  const r = repartitionDisciplines([seance('n', 2, 'Swim', 30), seance('v', 3, 'Ride', 120), seance('c', 4, 'Run', 50), seance('m', 5, 'WeightTraining', 60), seance('vieux', 40, 'Ride', 300)], ['natation', 'velo', 'course'], 4, AUJOURDHUI);
  assert.ok(r);
  assert.equal(r.total, 200 * 60);
  assert.deepEqual(r.parts.map((p) => [p.cle, p.pct]), [['natation', 15], ['velo', 60], ['course', 25]]);
});

test('repartitionDisciplines : le duathlon ignore la natation ; sans séance, null', () => {
  const r = repartitionDisciplines([seance('n', 2, 'Swim', 30), seance('v', 3, 'Ride', 60), seance('c', 4, 'Run', 60)], ['course', 'velo'], 4, AUJOURDHUI);
  assert.deepEqual(r?.parts.map((p) => p.cle), ['course', 'velo']);
  assert.equal(r?.total, 120 * 60);
  assert.equal(repartitionDisciplines([], ['natation', 'velo', 'course'], 4, AUJOURDHUI), null);
});

test('minutesParSemaine : une série par discipline, de la plus ancienne semaine à la plus récente', () => {
  const s = minutesParSemaine([seance('a', 1, 'Swim', 30), seance('b', 9, 'Swim', 45), seance('c', 2, 'Run', 60)], ['natation', 'course'], 3, AUJOURDHUI);
  assert.deepEqual(s.map((x) => [x.cle, x.minutes]), [['natation', [0, 45, 30]], ['course', [0, 0, 60]]]);
});

test('dernieresParDiscipline : les jours depuis la dernière séance, null si la discipline n\'en a pas', () => {
  const d = dernieresParDiscipline([seance('n1', 6, 'Swim', 30), seance('n2', 11, 'Swim', 30), seance('c', 0, 'Run', 40)], ['natation', 'velo', 'course'], AUJOURDHUI);
  assert.deepEqual(d.map((x) => [x.cle, x.jours]), [['natation', 6], ['velo', null], ['course', 0]]);
  assert.equal(d[0].nom, 'n1');
});

test('bricks : un vélo puis une course dans la foulée', () => {
  const b = bricks([seance('v', 2, 'Ride', 90, {}, '09:00:00'), seance('c', 2, 'Run', 25, {}, '10:40:00')], 12, AUJOURDHUI);
  assert.equal(b.total, 1);
  assert.equal(b.liste[0].ordre, 'velo-course');
  assert.equal(b.liste[0].pauseMin, 10);
  assert.equal(b.quatreSemaines, 1);
});

test('bricks : la course d\'abord est un enchaînement de duathlon ; une longue pause ou un autre jour n\'en est pas un', () => {
  assert.equal(bricks([seance('c', 2, 'Run', 30, {}, '08:00:00'), seance('v', 2, 'Ride', 60, {}, '08:40:00')], 12, AUJOURDHUI).liste[0].ordre, 'course-velo');
  assert.equal(bricks([seance('v', 2, 'Ride', 60, {}, '08:00:00'), seance('c', 2, 'Run', 30, {}, '18:00:00')], 12, AUJOURDHUI).total, 0); // 9 h de pause
  assert.equal(bricks([seance('v', 2, 'Ride', 60), seance('c', 3, 'Run', 30, {}, '09:10:00')], 12, AUJOURDHUI).total, 0);
});

test('bricks : chaque séance ne sert qu\'une fois, et on compte les 4 dernières semaines à part', () => {
  const b = bricks([seance('v', 2, 'Ride', 60, {}, '08:00:00'), seance('c1', 2, 'Run', 20, {}, '09:05:00'), seance('c2', 2, 'Run', 15, {}, '09:40:00'), seance('v2', 40, 'Ride', 60, {}, '08:00:00'), seance('c3', 40, 'Run', 20, {}, '09:05:00')], 12, AUJOURDHUI);
  assert.equal(b.total, 2);
  assert.equal(b.quatreSemaines, 1);
});

test('allureCourse4Semaines : l\'allure moyenne et son évolution (négatif = plus rapide)', () => {
  const a = allureCourse4Semaines([seance('a', 3, 'Run', 50, { distance_km: 10 }), seance('b', 33, 'Run', 55, { distance_km: 10 })], AUJOURDHUI);
  assert.equal(a.actuelle, 300);
  assert.equal(a.precedente, 330);
  assert.equal(a.evolutionPct, -9.1);
});

test('reperesDisciplines : un repère par discipline ; le vélo prend les watts de 20 minutes, sinon la vitesse', () => {
  const seances = [seance('n', 3, 'Swim', 40, { distance_km: 2 }), seance('c', 3, 'Run', 50, { distance_km: 10 }), seance('v', 3, 'Ride', 60, { distance_km: 30 })];
  const r = reperesDisciplines(seances, [{ duration_s: 1200, watts_90d: 240, watts_alltime: 270 }], ['natation', 'velo', 'course'], AUJOURDHUI);
  assert.deepEqual(r.map((x) => x.cle), ['natation', 'velo', 'course']);
  assert.equal(r[0].valeur, 120); // 2400 s pour 2 km = 120 s par 100 m
  assert.equal(r[1].valeur, 240);
  assert.equal(r[1].record, 270);
  assert.equal(r[2].valeur, 300);
  const sansPuissance = reperesDisciplines(seances, [], ['velo'], AUJOURDHUI)[0];
  assert.equal(sansPuissance.valeur, null);
  assert.equal(sansPuissance.vitesseKmh, 30);
});

test('bricksParSemaine : le nombre d\'enchaînements par semaine, de la plus ancienne à la plus récente', () => {
  const b = bricks([seance('v', 2, 'Ride', 60, {}, '08:00:00'), seance('c', 2, 'Run', 20, {}, '09:05:00'), seance('v2', 9, 'Ride', 60, {}, '08:00:00'), seance('c2', 9, 'Run', 20, {}, '09:05:00'), seance('v3', 3, 'Ride', 60, {}, '08:00:00'), seance('c3', 3, 'Run', 20, {}, '09:05:00')], 12, AUJOURDHUI);
  assert.deepEqual(bricksParSemaine(b.liste, 3, AUJOURDHUI), [0, 1, 2]);
});
