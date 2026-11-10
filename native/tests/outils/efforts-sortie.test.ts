import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courbeEffortsSortie, effortsDeSortie, meilleureMoyenne } from '../../src/data/outils/efforts-sortie.ts';

test('meilleureMoyenne : trouve la meilleure fenêtre', () => {
  // 100 points, 1 par seconde : 100 W partout sauf 20 s à 300 W (points 40 à 59)
  const temps = Array.from({ length: 100 }, (_, i) => i);
  const w = temps.map((i) => (i >= 40 && i < 60 ? 300 : 100));
  assert.ok(Math.abs(meilleureMoyenne(w, temps, 20)! - 300) < 1e-6);
  // Sur 40 s : 20 s à 300 W + 20 s à 100 W = 200 W
  assert.ok(Math.abs(meilleureMoyenne(w, temps, 40)! - 200) < 1e-6);
});

test('meilleureMoyenne : plus longue que la sortie, ou trop fine pour la résolution : null', () => {
  const temps = Array.from({ length: 50 }, (_, i) => i * 10); // un point toutes les 10 s
  const v = temps.map(() => 3);
  assert.equal(meilleureMoyenne(v, temps, 1000), null); // la sortie dure 490 s
  assert.equal(meilleureMoyenne(v, temps, 5), null); // 5 s < 2,5 écarts
  assert.ok(meilleureMoyenne(v, temps, 60)! > 2.99);
});

test('meilleureMoyenne : une pause ne compte pas dans la fenêtre', () => {
  // 30 points à 100 W, une pause de 1000 s, puis 30 points à 100 W : sur 50 s, toujours 100 W
  const temps = [...Array.from({ length: 30 }, (_, i) => i), ...Array.from({ length: 30 }, (_, i) => 1029 + i)];
  const w = temps.map(() => 100);
  assert.ok(Math.abs(meilleureMoyenne(w, temps, 50)! - 100) < 1e-6);
});

test('courbeEffortsSortie et effortsDeSortie : un point par durée possible, vitesse en km/h pour la course', () => {
  const temps = Array.from({ length: 700 }, (_, i) => i); // 700 s
  const brut = { temps, vitesse: temps.map(() => 3), watts: temps.map(() => 200) };
  const course = effortsDeSortie(brut, 'course', '2026-11-04');
  assert.deepEqual(course.map((p) => p.duree), [60, 120, 300, 600]);
  assert.ok(Math.abs(course[0].top[0].valeur - 10.8) < 1e-6); // 3 m/s = 10,8 km/h
  const velo = effortsDeSortie(brut, 'velo', '2026-11-04');
  assert.ok(velo.some((p) => p.duree === 5) && velo.every((p) => p.top[0].valeur === 200));
  assert.deepEqual(courbeEffortsSortie(undefined, temps, [60], 'x'), []);
  assert.deepEqual(effortsDeSortie(null, 'velo', 'x'), []);
});
