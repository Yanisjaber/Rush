import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longueurKm, pointAuFraction } from '../../src/data/outils/trace.ts';

// Une trace en L : 0,01° vers l'est puis 0,01° vers le nord (à l'équateur, les deux branches font la même longueur)
const trace = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.01 },
  { latitude: 0.01, longitude: 0.01 },
];

test('longueurKm : somme des segments, en km', () => {
  // 0,01° de longitude à l'équateur ≈ 1,113 km ; le L fait deux branches de 0,01°
  assert.ok(Math.abs(longueurKm(trace) - 2.2264) < 0.01, `longueur ${longueurKm(trace)}`);
  assert.equal(longueurKm([]), 0);
  assert.equal(longueurKm([{ latitude: 1, longitude: 1 }]), 0);
});

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
