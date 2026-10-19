import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decalages, deplacerVers, indiceCible, vitesseDefilement } from '../src/data/glisse.ts';

// Quatre éléments de 100 de haut : 0-100, 100-200, 200-300, 300-400
const boites = [0, 100, 200, 300].map((y) => ({ y, h: 100 }));

test('indiceCible : le centre décide, les autres éléments seuls comptent', () => {
  assert.equal(indiceCible(boites, 0, 50), 0); // reste en haut
  assert.equal(indiceCible(boites, 0, 160), 1); // son centre passe le milieu du 2e (150)
  assert.equal(indiceCible(boites, 0, 360), 3);
  assert.equal(indiceCible(boites, 3, 40), 0);
  assert.equal(indiceCible(boites, 3, 250), 2);
  assert.equal(indiceCible(boites, 1, 150), 1);
});

test('decalages : ceux entre la place de départ et d\'arrivée se poussent', () => {
  assert.deepEqual(decalages(boites, 0, 2), [0, -100, -100, 0]);
  assert.deepEqual(decalages(boites, 3, 1), [0, 100, 100, 0]);
  assert.deepEqual(decalages(boites, 1, 1), [0, 0, 0, 0]);
});

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
