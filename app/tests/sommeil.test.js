import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentsValides, heureApres, heureDe, minutesCoucher, heureDepuisMinutes, phases, efficacite, moyenne, moyenneCoucher, triees, tendance } from '../src/lib/data/sommeil.js';

test('heureDe : extrait HH:MM, tolère les valeurs absentes ou bizarres', () => {
  assert.equal(heureDe('2026-10-11 23:10'), '23:10');
  assert.equal(heureDe('2026-10-12 6:05'), '06:05');
  assert.equal(heureDe(null), null);
  assert.equal(heureDe('n’importe quoi'), null);
});

test('coucher : après minuit compte comme tard, aller-retour en heure', () => {
  assert.equal(minutesCoucher('23:30'), 23 * 60 + 30);
  assert.equal(minutesCoucher('00:30'), 24 * 60 + 30);
  assert.equal(heureDepuisMinutes(24 * 60 + 30), '00:30');
  assert.equal(heureDepuisMinutes(null), null);
});

test('moyenneCoucher : 23:00 et 01:00 donnent minuit, pas midi', () => {
  const m = moyenneCoucher([{ bedtime: 'x 23:00' }, { bedtime: 'x 01:00' }]);
  assert.equal(heureDepuisMinutes(m), '00:00');
});

test('phases : parts qui totalisent 1, valeurs négatives ou absentes ignorées', () => {
  const p = phases({ deep_sec: 3600, rem_sec: 3600, light_sec: 7200, awake_sec: null });
  assert.equal(p.length, 4);
  assert.ok(Math.abs(p.reduce((s, x) => s + x.part, 0) - 1) < 1e-9);
  assert.deepEqual(phases({}), []);
  assert.deepEqual(phases(null), []);
});

test('efficacité : temps dormi / temps au lit', () => {
  const e = efficacite({ deep_sec: 100, rem_sec: 100, light_sec: 700, awake_sec: 100 });
  assert.ok(Math.abs(e - 0.9) < 1e-9);
  assert.equal(efficacite({}), null);
});

test('moyenne : ignore les trous', () => {
  assert.equal(moyenne([{ a: 2 }, { a: null }, { a: 4 }, {}], 'a'), 3);
  assert.equal(moyenne([], 'a'), null);
});

test('triées + tendance', () => {
  const nuits = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, hrv_avg: i >= 23 ? 60 : 50 }));
  assert.equal(triees(nuits)[0].date, '2026-09-30');
  assert.equal(tendance(nuits, 'hrv_avg'), 'hausse');
  assert.equal(tendance(nuits.slice(0, 5), 'hrv_avg'), null);
});

test('heureDe accepte aussi le format ISO avec T', () => {
  assert.equal(heureDe('2026-10-26T23:05:00'), '23:05');
  assert.equal(heureDe('2026-10-26 7:05'), '07:05');
  assert.equal(heureDe('n’importe quoi'), null);
});

test('heureApres : repères d\'heure sans « :60 », passage de minuit, null sans coucher', () => {
  assert.equal(heureApres('23:00', 119.5), '01:00'); // avant : « 00:60 »
  assert.equal(heureApres('23:00', 0), '23:00');
  assert.equal(heureApres('23:00', 478), '06:58');
  assert.equal(heureApres(null, 30), null);
  assert.equal(heureApres('23:00', null), null);
});

test('segmentsValides : garde les segments sains, ignore le reste sans planter', () => {
  const bons = [[0, 20, 3], [20, 90, 1], [90, 120, 0]];
  assert.deepEqual(segmentsValides({ segments: bons }), bons);
  assert.deepEqual(segmentsValides({ segments: null }), []);
  assert.deepEqual(segmentsValides({ segments: 'oups' }), []);
  assert.deepEqual(segmentsValides(null), []);
  const melanges = [[0, 20, 3], null, 'x', [5], [10, 5, 1], [0, 0, 1], [0, 10, 7], [0, 10, 1.5], [null, 10, 1], [0, '10', 1], [0, NaN, 1], [-5, 10, 1], [20, 40, 2]];
  assert.deepEqual(segmentsValides({ segments: melanges }), [[0, 20, 3], [20, 40, 2]]);
});
