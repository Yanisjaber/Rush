// Test du nettoyage de la trace Strava (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/trace-strava.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { alleger, nettoyerCourbes, nettoyerTrace, POINTS_MAX } from '../../functions/_shared/trace-strava.ts';

const flux = (n: number) => ({
  latlng: { data: Array.from({ length: n }, (_, i) => [43.5 + i * 0.0001, 1.4 + i * 0.0001]) },
  altitude: { data: Array.from({ length: n }, (_, i) => 150 + (i % 10)) },
  distance: { data: Array.from({ length: n }, (_, i) => i * 10) },
});

test('alleger : garde le premier et le dernier, répartit le reste', () => {
  const l = Array.from({ length: 1000 }, (_, i) => i);
  const a = alleger(l, 5);
  assert.equal(a.length, 5);
  assert.equal(a[0], 0);
  assert.equal(a[4], 999);
  assert.deepEqual(alleger([1, 2, 3], 10), [1, 2, 3]);
});

test('nettoyerTrace : une trace courte reste entière et alignée', () => {
  const t = nettoyerTrace(flux(50))!;
  assert.equal(t.latlng.length, 50);
  assert.equal(t.altitude.length, 50);
  assert.equal(t.distance.length, 50);
  assert.deepEqual(t.latlng[0], [43.5, 1.4]);
});

test('nettoyerTrace : une longue trace est allégée à 600 points, les trois listes restent alignées', () => {
  const t = nettoyerTrace(flux(20000))!;
  assert.equal(t.latlng.length, POINTS_MAX);
  assert.equal(t.altitude.length, POINTS_MAX);
  assert.equal(t.distance.length, POINTS_MAX);
  assert.equal(t.distance[0], 0);
  assert.equal(t.distance[POINTS_MAX - 1], 19999 * 10);
});

test('nettoyerTrace : les positions invalides sont écartées avec leur altitude et leur distance', () => {
  const brut = flux(5);
  (brut.latlng.data as unknown[])[2] = [999, 5]; // latitude impossible
  (brut.latlng.data as unknown[])[3] = null;
  const t = nettoyerTrace(brut)!;
  assert.equal(t.latlng.length, 3);
  assert.deepEqual(t.distance, [0, 10, 40]);
});

test('nettoyerTrace : sans altitude ou distance, ces listes sont vides (la trace reste)', () => {
  const brut: any = flux(10);
  delete brut.altitude;
  const t = nettoyerTrace(brut)!;
  assert.equal(t.latlng.length, 10);
  assert.deepEqual(t.altitude, []);
  assert.equal(t.distance.length, 10);
});

test('nettoyerTrace : pas de trace sans deux positions valides, et rien ne plante sur du n\'importe quoi', () => {
  assert.equal(nettoyerTrace(null), null);
  assert.equal(nettoyerTrace({}), null);
  assert.equal(nettoyerTrace({ latlng: { data: [[1, 2]] } }), null);
  assert.equal(nettoyerTrace({ latlng: { data: 'texte' } }), null);
  assert.equal(nettoyerTrace({ latlng: { data: [['a', 'b'], [NaN, 1]] } }), null);
});

test('nettoyerCourbes : flux alignés, allégés à 600 points, flux incohérents écartés', () => {
  const n = 2000;
  const brut: any = {
    distance: { data: Array.from({ length: n }, (_, i) => i) },
    heartrate: { data: Array.from({ length: n }, () => 150) },
    cadence: { data: [1, 2, 3] }, // longueur différente : écarté
    watts: { data: Array.from({ length: n }, (_, i) => (i === 5 ? 'x' : 100)) }, // pas que des nombres : écarté
  };
  const c = nettoyerCourbes(brut)!;
  assert.equal(c.distance.data.length, POINTS_MAX);
  assert.equal(c.heartrate.data.length, POINTS_MAX);
  assert.equal(c.cadence, undefined);
  assert.equal(c.watts, undefined);
  assert.equal(nettoyerCourbes(null), null);
  assert.equal(nettoyerCourbes({}), null);
});
