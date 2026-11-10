import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repartitionsSortie, tempsParZone } from '../../src/data/outils/repartition-zones.ts';

test('tempsParZone : chaque point compte pour le temps jusqu au suivant', () => {
  // 10 points toutes les 10 s : 5 en zone 0 (< 100), 5 en zone 1 (≥ 100)
  const temps = Array.from({ length: 10 }, (_, i) => i * 10);
  const valeurs = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
  assert.deepEqual(tempsParZone(valeurs, temps, [0, 100]), [50, 50]);
});

test('tempsParZone : une pause ne compte pas, une valeur sous la première borne va dans la première zone', () => {
  const temps = [0, 10, 20, 30, 1000, 1010];
  const r = tempsParZone([10, 10, 10, 10, 10, 10], temps, [50, 100])!;
  assert.equal(r[1], 0);
  assert.ok(r[0] < 100); // 30 s de pause plafonnées à 3 fois l'écart habituel, pas 970 s
});

test('tempsParZone : sans temps, la durée totale est répartie en parts égales ; sans rien, null', () => {
  assert.deepEqual(tempsParZone([1, 1, 200, 200], null, [0, 100], 40), [20, 20]);
  assert.equal(tempsParZone([1, 1, 200, 200], null, [0, 100]), null);
  assert.equal(tempsParZone([NaN, NaN], [0, 10], [0, 100]), null);
});

test('repartitionsSortie : seules les mesures avec flux et référence apparaissent', () => {
  const temps = Array.from({ length: 60 }, (_, i) => i * 10);
  const brut = { temps, fc: Array.from({ length: 60 }, () => 175), watts: Array.from({ length: 60 }, () => 200), vitesse: Array.from({ length: 60 }, () => 3) };
  const r = repartitionsSortie(brut, { lthr: { bpm: 172, estimee: true }, ftp: null, seuilKmh: 12.5 }, true, 600);
  assert.deepEqual(r.map((m) => m.cle), ['fc', 'allure']); // pas de FTP : pas de puissance
  assert.equal(r[0].estimee, true);
  assert.equal(r[0].zones.length, 7);
  assert.equal(Math.round(r[0].zones.reduce((a, z) => a + z.secondes, 0)), 600);
  assert.equal(r[0].zones[4].court, 'Z5a'); // 175 bpm / 172 = 102 % : zone Z5a
  assert.ok(r[0].zones[4].secondes > 500);
  assert.equal(repartitionsSortie(brut, { lthr: { bpm: 172, estimee: false }, seuilKmh: 12.5 }, false, 600).some((m) => m.cle === 'allure'), false); // allure : course seulement
  assert.deepEqual(repartitionsSortie(null, { ftp: 250 }, true, 600), []);
});
