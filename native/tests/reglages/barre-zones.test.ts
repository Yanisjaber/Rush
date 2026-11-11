import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LARGEUR_FIGEE, largeursZones } from '../../src/data/reglages/barre-zones.ts';

test('largeurs de la barre : somme à 1, proportionnelles aux plages', () => {
  const l = largeursZones([0, 50, 100], 200, false);
  assert.ok(Math.abs(l.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Math.abs(l[0] - 0.25) < 1e-9 && Math.abs(l[1] - 0.25) < 1e-9 && Math.abs(l[2] - 0.5) < 1e-9);
});

test('largeurs de la barre : première et dernière zones figées, le milieu se partage le reste', () => {
  const l = largeursZones([0, 81, 90, 94, 100], 120, true); // le cœur : 5 zones
  assert.equal(l.length, 5);
  assert.ok(Math.abs(l[0] - LARGEUR_FIGEE) < 1e-9 && Math.abs(l[4] - LARGEUR_FIGEE) < 1e-9);
  assert.ok(Math.abs(l.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  // Z2 (9 points) est plus large que Z3 (4 points) et Z4 (6 points)
  assert.ok(l[1] > l[3] && l[3] > l[2]);
  // Peu importe le réglage, les zones figées ne bougent pas
  const l2 = largeursZones([0, 70, 95, 99, 110], 120, true);
  assert.ok(Math.abs(l2[0] - LARGEUR_FIGEE) < 1e-9 && Math.abs(l2[4] - LARGEUR_FIGEE) < 1e-9);
});

test('largeurs de la barre : la puissance à 7 zones, Z1 et Z7 figées, les 5 autres se partagent le reste', () => {
  const l = largeursZones([0, 103, 152, 182, 212, 242, 302], 320, true);
  assert.equal(l.length, 7);
  assert.ok(Math.abs(l[0] - LARGEUR_FIGEE) < 1e-9 && Math.abs(l[6] - LARGEUR_FIGEE) < 1e-9);
  assert.ok(Math.abs(l.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
