import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATHLETE_DEMO, completerSeance, ftpDemo, genererFlux } from '../../src/data/demo/flux-demo.ts';
import type { Seance } from '../../src/data/types.ts';

const base: Seance = {
  id: 'demo-test', name: 'Endurance', sport: 'Ride', start_date_local: '2026-06-10T08:00:00', moving_time: 5400, distance_km: 40, total_elevation_gain: 420,
  avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'velo',
};
const moy = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;

test('flux vélo : déterministe, sans NaN, aux bornes réalistes', () => {
  const s = completerSeance(base);
  const a = genererFlux(s);
  assert.deepEqual(a, genererFlux(s));
  for (const k of ['time', 'distance', 'velocity_smooth', 'heartrate', 'watts', 'cadence', 'altitude'] as const) {
    assert.ok(a[k] && a[k]!.length === a.time.length, k);
    assert.ok(a[k]!.every((x) => Number.isFinite(x)), k);
  }
  assert.ok(Math.max(...a.heartrate) <= ATHLETE_DEMO.fcMax && Math.min(...a.heartrate) >= 50);
  assert.ok(Math.max(...a.velocity_smooth) <= 16.1);
});

test('flux vélo : les moyennes sont celles de la fiche', () => {
  const s = completerSeance(base);
  const f = genererFlux(s);
  assert.ok(Math.abs(moy(f.watts!) - s.avg_watts!) <= 2);
  assert.ok(Math.abs(moy(f.heartrate) - s.avg_heartrate!) <= 3);
  assert.ok(Math.abs(f.distance.at(-1)! / 1000 - 40) <= 0.8);
});

test('flux vélo : le dénivelé positif se rapproche de la fiche', () => {
  const f = genererFlux(completerSeance(base));
  let gain = 0;
  for (let i = 1; i < f.altitude.length; i++) if (f.altitude[i] > f.altitude[i - 1]) gain += f.altitude[i] - f.altitude[i - 1];
  assert.ok(gain > 300 && gain < 650, String(gain));
});

test('flux à 5 s : mêmes moyennes qu’à 1 s', () => {
  const s = completerSeance(base);
  const a = genererFlux(s, 1);
  const b = genererFlux(s, 5);
  assert.ok(Math.abs(moy(a.watts!) - moy(b.watts!)) < 6);
  assert.ok(Math.abs(moy(a.heartrate) - moy(b.heartrate)) < 3);
});

test('flux course : fractionné = deux allures bien distinctes, distance de la fiche', () => {
  const s = completerSeance({ ...base, id: 'demo-run', name: 'Fractionné', sport: 'Run', moving_time: 3000, distance_km: 9, total_elevation_gain: 60, category: 'course' });
  const f = genererFlux(s);
  assert.equal(f.watts, null);
  assert.ok(Math.abs(f.distance.at(-1)! - 9000) < 250);
  const v = f.velocity_smooth;
  assert.ok(Math.max(...v) > 1.5 * Math.min(...v.slice(900, 2400)));
});

test('flux natation : distance par paliers de 25 m', () => {
  const s = completerSeance({ ...base, id: 'demo-nage', name: 'Natation', sport: 'Swim', moving_time: 2400, distance_km: 1.5, total_elevation_gain: 0, category: 'natation' });
  const f = genererFlux(s);
  assert.ok(f.distance.every((d) => d % 25 === 0));
  assert.ok(Math.abs(f.distance.at(-1)! - 1500) <= 50);
});

test('flux muscu : cardio seul, pas de distance', () => {
  const f = genererFlux(completerSeance({ ...base, id: 'demo-muscu', name: 'Push', sport: 'WeightTraining', moving_time: 3600, distance_km: null, total_elevation_gain: null, category: 'muscu' }));
  assert.equal(f.watts, null);
  assert.equal(f.distance.at(-1), 0);
  assert.ok(f.heartrate.every(Number.isFinite));
});

test('completerSeance : garde les chiffres existants, ajoute puissance et FTP à vélo', () => {
  const s = completerSeance({ ...base, avg_heartrate: 150, avg_watts: 200 });
  assert.equal(s.avg_heartrate, 150);
  assert.equal(s.avg_watts, 200);
  assert.ok(s.np! >= 200 && s.ftp_at_time! > 200 && s.device_watts === true);
  const course = completerSeance({ ...base, sport: 'Run' });
  assert.equal(course.avg_watts, null);
});

test('FTP : monte de 2021 à 2026', () => {
  assert.ok(ftpDemo('2026-06-20') > ftpDemo('2021-06-20') + 25);
});
