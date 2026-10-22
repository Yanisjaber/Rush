import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveParTest, deriveRuns, evolutionTotal, hyroxParSemaine, partsRunsStations } from '../src/data/hyrox-suivi.ts';
import type { Seance, TestHyrox } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const seance = (id: string, avant: number, minutes: number, sport = 'Hyrox'): Seance => ({
  id, name: null, sport, start_date_local: `${jour(avant)}T08:00:00`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});
// Un test : runs puis stations, dans l'ordre (run1, station1, run2, station2…)
const essai = (id: string, avant: number, runs: number[], stations: number[], total?: number): TestHyrox => {
  const segments: number[] = [];
  runs.forEach((r, k) => segments.push(r, stations[k]));
  return { id, date: jour(avant), label: 'Simulation', kind: 'test', segments, total_s: total ?? segments.reduce((a, b) => a + b, 0), source: 'manuel', activity_id: null, notes: null };
};
const RUNS_A = [300, 300, 310, 320, 330, 340, 350, 350]; // 8 runs qui ralentissent
const STATIONS_A = [240, 250, 240, 260, 250, 220, 230, 300];

test('hyroxParSemaine : des minutes par semaine, seul Hyrox compte', () => {
  const h = hyroxParSemaine([seance('a', 1, 60), seance('b', 3, 45), seance('c', 9, 50), seance('d', 2, 90, 'Run')], 4, AUJOURDHUI);
  assert.deepEqual(h.parSemaine, [0, 0, 50, 105]);
  assert.equal(h.ecartPct, 110); // 105 min contre 50 min de moyenne
});

test('evolutionTotal : du plus ancien au plus récent, avec le record et l\'écart au premier', () => {
  const e = evolutionTotal([essai('t3', 4, RUNS_A, STATIONS_A, 4300), essai('t2', 32, RUNS_A, STATIONS_A, 4400), essai('t1', 60, RUNS_A, STATIONS_A, 4600)]);
  assert.ok(e);
  assert.deepEqual(e.points.map((p) => p.id), ['t1', 't2', 't3']);
  assert.equal(e.record, 4300);
  assert.equal(e.estRecord, true);
  assert.equal(e.ecart, -300);
});

test('evolutionTotal : le dernier test peut ne pas être le record ; un seul test n\'a pas d\'écart ; sans test, null', () => {
  const e = evolutionTotal([essai('t2', 4, RUNS_A, STATIONS_A, 4500), essai('t1', 40, RUNS_A, STATIONS_A, 4300)]);
  assert.equal(e?.estRecord, false);
  assert.equal(e?.ecart, 200);
  assert.equal(evolutionTotal([essai('t1', 4, RUNS_A, STATIONS_A)])?.ecart, 0);
  assert.equal(evolutionTotal([]), null);
});

test('evolutionTotal : sans total enregistré, on additionne les segments', () => {
  const e = evolutionTotal([essai('t1', 4, RUNS_A, STATIONS_A, 0)]);
  assert.equal(e?.dernier.total, RUNS_A.reduce((a, b) => a + b, 0) + STATIONS_A.reduce((a, b) => a + b, 0));
});

test('partsRunsStations : temps des runs et des stations, part des runs en %', () => {
  const p = partsRunsStations([essai('t1', 4, RUNS_A, STATIONS_A)]);
  assert.equal(p.length, 1);
  assert.equal(p[0].runs, 2600);
  assert.equal(p[0].stations, 1990);
  assert.equal(p[0].pctRuns, 57); // 2600 sur 4590
});

test('deriveRuns : les 2 derniers runs comparés aux 2 premiers', () => {
  const d = deriveRuns(essai('t1', 4, RUNS_A, STATIONS_A));
  assert.ok(d);
  assert.equal(d.debut, 300);
  assert.equal(d.fin, 350);
  assert.equal(d.ecart, 50);
  assert.equal(d.pct, 16.7);
});

test('deriveRuns : un test sans ses 8 runs, ou sans test, null ; un test qui accélère a une dérive négative', () => {
  assert.equal(deriveRuns(null), null);
  assert.equal(deriveRuns({ ...essai('t', 4, RUNS_A, STATIONS_A), segments: [300, 240, 310] }), null);
  assert.ok((deriveRuns(essai('t', 4, [320, 320, 310, 310, 300, 300, 290, 290], STATIONS_A))?.pct ?? 0) < 0);
});

test('deriveParTest : une dérive par test exploitable, du plus ancien au plus récent', () => {
  const d = deriveParTest([essai('t2', 4, RUNS_A, STATIONS_A), essai('t1', 40, [300, 310, 320, 330, 340, 350, 360, 370], STATIONS_A), { ...essai('x', 20, RUNS_A, STATIONS_A), segments: [] }]);
  assert.deepEqual(d.map((x) => x.id), ['t1', 't2']);
});
