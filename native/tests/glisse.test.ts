import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deplacerVers, elementSousPoint, vitesseDefilement } from '../src/data/sports/glisse.ts';

test('deplacerVers : déplace, ne change rien hors limites', () => {
  assert.deepEqual(deplacerVers(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(deplacerVers(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  const l = ['a', 'b'];
  assert.equal(deplacerVers(l, 0, 0), l);
  assert.equal(deplacerVers(l, 0, 5), l);
});

test('vitesseDefilement : nulle au milieu, vers le haut ou le bas près des bords, bornée', () => {
  assert.equal(vitesseDefilement(400, 100, 800), 0);
  assert.ok(vitesseDefilement(120, 100, 800) < 0);
  assert.ok(vitesseDefilement(780, 100, 800) > 0);
  assert.equal(vitesseDefilement(0, 100, 800), -18);
});

test("elementSousPoint : l'élément sous le point, jamais celui qu'on glisse, -1 entre deux", () => {
  const grille = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 100, y: 0, w: 100, h: 100 },
    { x: 0, y: 100, w: 200, h: 100 },
  ];
  assert.equal(elementSousPoint(grille, 0, 150, 50), 1);
  assert.equal(elementSousPoint(grille, 0, 50, 50), -1); // sur sa propre place : rien ne change
  assert.equal(elementSousPoint(grille, 1, 60, 160), 2);
  assert.equal(elementSousPoint(grille, 1, 500, 500), -1);
});
