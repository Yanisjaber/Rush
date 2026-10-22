import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hebdoCrossfit, intensiteCrossfit, minutesParSemaineTypes, mixEntrainement, seancesMarquantes, typeDe } from '../src/data/crossfit.ts';
import type { Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const seance = (id: string, avant: number, sport: string, minutes: number, extra: Partial<Seance> = {}): Seance => ({
  id, name: id, sport, start_date_local: `${jour(avant)}T08:00:00`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});

test('hebdoCrossfit : des minutes par semaine, CrossFit et HIIT seulement', () => {
  const h = hebdoCrossfit([seance('a', 1, 'Crossfit', 45), seance('b', 3, 'HighIntensityIntervalTraining', 20), seance('c', 9, 'Crossfit', 50), seance('d', 2, 'WeightTraining', 60)], 4, AUJOURDHUI);
  assert.deepEqual(h.parSemaine, [0, 0, 50, 65]);
  assert.equal(h.ecartPct, 30); // 65 min contre 50 min de moyenne
});

test('typeDe : WOD, force, endurance ; le reste n\'a pas de type', () => {
  assert.equal(typeDe({ sport: 'Crossfit' }), 'wod');
  assert.equal(typeDe({ sport: 'HighIntensityIntervalTraining' }), 'wod');
  assert.equal(typeDe({ sport: 'WeightTraining' }), 'force');
  for (const sport of ['Run', 'TrailRun', 'Ride', 'Swim', 'Rowing']) assert.equal(typeDe({ sport }), 'endurance', sport);
  assert.equal(typeDe({ sport: 'Yoga' }), 'force'); // Strava range le yoga avec la muscu (voir familles.ts)
  assert.equal(typeDe({ sport: 'Tennis' }), null);
  assert.equal(typeDe({ sport: 'Hyrox' }), null);
});

test('intensiteCrossfit : le temps rangé selon le cardio moyen face à la FC max', () => {
  // FC max 200 : 140 bpm = 70 % (modérée), 164 = 82 % (soutenue), 180 = 90 % (intense)
  const r = intensiteCrossfit([seance('a', 2, 'Crossfit', 30, { avg_heartrate: 140 }), seance('b', 4, 'Crossfit', 40, { avg_heartrate: 164 }), seance('c', 6, 'Crossfit', 30, { avg_heartrate: 180 }), seance('vieux', 40, 'Crossfit', 60, { avg_heartrate: 180 }), seance('sans', 3, 'Crossfit', 50)], 200, 4, AUJOURDHUI);
  assert.ok(r);
  assert.deepEqual(r.zones.map((z) => z.temps / 60), [30, 40, 30]);
  assert.equal(r.dominante, 1);
});

test('intensiteCrossfit : sans FC max, sans cardio ou sans séance, null', () => {
  assert.equal(intensiteCrossfit([seance('a', 2, 'Crossfit', 30, { avg_heartrate: 150 })], null, 4, AUJOURDHUI), null);
  assert.equal(intensiteCrossfit([seance('a', 2, 'Crossfit', 30)], 200, 4, AUJOURDHUI), null);
  assert.equal(intensiteCrossfit([], 200, 4, AUJOURDHUI), null);
});

test('mixEntrainement : WOD, force et endurance sur 4 semaines', () => {
  const m = mixEntrainement([seance('w', 2, 'Crossfit', 60), seance('f', 3, 'WeightTraining', 60), seance('e', 4, 'Run', 120), seance('t', 5, 'Tennis', 90), seance('vieux', 40, 'Crossfit', 300)], 4, AUJOURDHUI);
  assert.ok(m);
  assert.equal(m.total, 240 * 60);
  assert.deepEqual(m.parts.map((p) => [p.cle, p.pct]), [['wod', 25], ['force', 25], ['endurance', 50]]);
  assert.equal(mixEntrainement([], 4, AUJOURDHUI), null);
});

test('minutesParSemaineTypes : une série par type, de la plus ancienne semaine à la plus récente', () => {
  const s = minutesParSemaineTypes([seance('w', 1, 'Crossfit', 45), seance('f', 9, 'WeightTraining', 60), seance('e', 2, 'Run', 30)], 3, AUJOURDHUI);
  assert.deepEqual(s.map((x) => [x.cle, x.minutes]), [['wod', [0, 0, 45]], ['force', [0, 60, 0]], ['endurance', [0, 0, 30]]]);
});

test('seancesMarquantes : la plus longue, la plus lourde, la plus intense, et le top des charges', () => {
  const m = seancesMarquantes([
    seance('a', 2, 'Crossfit', 60, { tss: 70, avg_heartrate: 150 }),
    seance('b', 9, 'Crossfit', 35, { tss: 95, avg_heartrate: 172 }),
    seance('c', 16, 'Crossfit', 20, { tss: 40, avg_heartrate: 160 }),
    seance('vieux', 120, 'Crossfit', 120, { tss: 200, avg_heartrate: 190 }),
    seance('muscu', 3, 'WeightTraining', 90, { tss: 300 }),
  ], 12, AUJOURDHUI);
  assert.equal(m.plusLongue?.id, 'a');
  assert.equal(m.plusLourde?.id, 'b');
  assert.equal(m.plusIntense?.id, 'b');
  assert.deepEqual(m.top.map((s) => s.id), ['b', 'a', 'c']);
  assert.equal(seancesMarquantes([], 12, AUJOURDHUI).plusLongue, null);
});

test('seancesMarquantes : une séance sans charge ni cardio peut être la plus longue sans fausser les autres', () => {
  const m = seancesMarquantes([seance('a', 2, 'Crossfit', 90), seance('b', 5, 'Crossfit', 30, { tss: 50, avg_heartrate: 160 })], 12, AUJOURDHUI);
  assert.equal(m.plusLongue?.id, 'a');
  assert.equal(m.plusLourde?.id, 'b');
  assert.equal(m.plusIntense?.id, 'b');
});
