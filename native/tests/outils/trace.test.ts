import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointAuFraction, regionPourZone } from '../../src/data/outils/trace.ts';

test('regionPourZone : une feuille en bas remonte la trace et dézoome', () => {
  const r = { latitude: 43.5, longitude: 1.4, latitudeDelta: 0.02, longitudeDelta: 0.01 };
  const z = regionPourZone(r, { hauteur: 800, haut: 100, bas: 300 });
  assert.ok(Math.abs(z.latitudeDelta - 0.04) < 1e-9, 'zone libre = la moitié : on dézoome du double');
  // zone libre centrée à y = 300 (au-dessus du milieu, 400) : le centre de la carte est au sud de la trace
  assert.ok(z.latitude < r.latitude);
  assert.ok(Math.abs(z.latitude - (43.5 - 0.04 * ((400 - 300) / 800))) < 1e-9);
  assert.equal(z.longitudeDelta, 0.02);
});

test('regionPourZone : sans zone libre ou sans hauteur, la région ne change pas', () => {
  const r = { latitude: 1, longitude: 2, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  assert.equal(regionPourZone(r, { hauteur: 0, haut: 0, bas: 0 }), r);
  assert.equal(regionPourZone(r, { hauteur: 500, haut: 300, bas: 300 }), r);
});

// Une trace en L : 0,01° vers l'est puis 0,01° vers le nord (à l'équateur, les deux branches font la même longueur)
const trace = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.01 },
  { latitude: 0.01, longitude: 0.01 },
];

test('pointAuFraction : les extrémités et le milieu', () => {
  assert.deepEqual(pointAuFraction(trace, 0), trace[0]);
  assert.deepEqual(pointAuFraction(trace, 1), trace[2]);
  const milieu = pointAuFraction(trace, 0.5)!;
  assert.ok(Math.abs(milieu.latitude) < 1e-6 && Math.abs(milieu.longitude - 0.01) < 1e-6, 'le milieu est au coude du L');
});

test('pointAuFraction : interpole sur la distance, pas sur le nombre de points', () => {
  const p = pointAuFraction(trace, 0.25)!;
  assert.ok(Math.abs(p.latitude) < 1e-6 && Math.abs(p.longitude - 0.005) < 1e-6);
});

test('pointAuFraction : bornes, trace vide, trace d\'un seul point, valeur absurde', () => {
  assert.equal(pointAuFraction([], 0.5), null);
  assert.deepEqual(pointAuFraction([trace[0]], 0.5), trace[0]);
  assert.deepEqual(pointAuFraction(trace, -3), trace[0]);
  assert.deepEqual(pointAuFraction(trace, 7), trace[2]);
  assert.deepEqual(pointAuFraction(trace, Number.NaN), trace[0]);
});
