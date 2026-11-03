// Test des courbes de la course à pied (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/signaux-course.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSignauxCourse, DISTANCES_COURSE, distanceEnMouvement, meilleuresDistances, meilleursTemps, SIGNAUX_COURSE_VERSION } from '../../functions/_shared/signaux-course.ts';

/** Le cumul de distance d'une course à vitesse (m/s) donnée par morceaux : [secondes, m/s][]. */
function cumul(morceaux: [number, number][]): number[] {
  const d = [0];
  for (const [secondes, v] of morceaux) for (let i = 0; i < secondes; i++) d.push(d[d.length - 1] + v);
  return d;
}

test('meilleursTemps : le meilleur temps sur chaque distance, pas la moyenne de la course', () => {
  // 10 min à 3 m/s (5'33"/km), puis 10 min à 4 m/s (4'10"/km), puis 10 min à 3 m/s
  const d = cumul([[600, 3], [600, 4], [600, 3]]);
  const t = meilleursTemps(d, [1000, 2000, 5000, 10000]);
  assert.equal(t['1000'], 250); // 1 km à 4 m/s
  assert.equal(t['2000'], 500);
  // 5 km : toute la fenêtre de 4 m/s (2 400 m) plus 2 600 m à 3 m/s : 600 + 2600/3 = 1 466,7 s
  assert.ok(Math.abs(t['5000'] - (600 + 2600 / 3)) < 1, `${t['5000']}`);
  assert.equal(t['10000'], undefined); // la course fait 9 600 m : pas de 10 km
});

test('meilleursTemps : la fraction de seconde est interpolée (1 km à 3,3 m/s = 303,0 s)', () => {
  const d = cumul([[1000, 3.3]]);
  const t = meilleursTemps(d, [1000]);
  assert.ok(Math.abs(t['1000'] - 1000 / 3.3) < 0.2, `${t['1000']}`);
});

test('meilleursTemps : un saut de GPS (vitesse impossible) est écarté', () => {
  const d = cumul([[300, 3], [3, 100], [300, 3]]); // 300 m gagnés en 3 s
  const t = meilleursTemps(d, [400, 1000]);
  // Aucune fenêtre qui traverse le saut ne compte : le meilleur 400 m est un vrai 400 m à 3 m/s, jamais un temps de quelques secondes
  assert.ok(t['400'] > 40, `${t['400']}`);
  assert.ok(t['1000'] > 150, `${t['1000']}`);
});

test('meilleuresDistances : la meilleure distance sur chaque durée', () => {
  const d = cumul([[600, 3], [600, 4], [600, 3]]);
  const r = meilleuresDistances(d, [60, 600, 1200, 3600]);
  assert.equal(r['60'], 240);
  assert.equal(r['600'], 2400);
  assert.equal(r['1200'], 600 * 4 + 600 * 3); // 4 200 m : la fenêtre de 20 min contient les 10 min à 4 m/s
  assert.equal(r['3600'], undefined); // la course dure 30 min
});

test('calculerSignauxCourse : la version, les trois courbes, et rien de ce qui manque', () => {
  const d = cumul([[3600, 3]]); // 10,8 km
  const fc = new Array(d.length).fill(150);
  const c = calculerSignauxCourse({ time: d.map((_, i) => i), distance: d, heartrate: fc });
  assert.equal(c.v, SIGNAUX_COURSE_VERSION);
  assert.ok(c.pace && Math.abs(c.pace['5000'] - 5000 / 3) < 0.2);
  assert.ok(c.pace && c.pace['10000'] > 3300);
  assert.equal(c.dis?.['1200'], 3600);
  assert.equal(c.fc?.['600'], 150);
  // Sans cardio ni GPS : seulement la version
  const vide = calculerSignauxCourse({ time: [0, 1, 2], distance: [], heartrate: [] });
  assert.deepEqual(vide, { v: SIGNAUX_COURSE_VERSION });
  // Une FC absurde (capteur) est écartée
  const fcMauvaise = calculerSignauxCourse({ time: d.map((_, i) => i), distance: d, heartrate: new Array(d.length).fill(250) });
  assert.equal(fcMauvaise.fc, undefined);
  assert.ok(DISTANCES_COURSE.includes(21097));
});

test('calculerSignauxCourse : une pause (trou de plus de 10 s) est retirée : le meilleur 400 m ne compte pas le feu rouge', () => {
  // 100 s à 3 m/s, trou de 60 s (le cumul reste à 300 m), puis 100 s à 3 m/s
  const temps = [...Array.from({ length: 101 }, (_, i) => i), ...Array.from({ length: 100 }, (_, i) => 161 + i)];
  const dist = [...Array.from({ length: 101 }, (_, i) => i * 3), ...Array.from({ length: 100 }, (_, i) => 300 + (i + 1) * 3)];
  const c = calculerSignauxCourse({ time: temps, distance: dist });
  assert.ok(c.pace && Math.abs(c.pace['400'] - 400 / 3) < 2.5, `${c.pace?.['400']}`); // 133 s, pas 193 s
});

test('distanceEnMouvement : l\'enregistrement intelligent est interpolé, la pause retirée, sans temps le cumul est rendu tel quel', () => {
  const r = distanceEnMouvement([0, 12, 24], [0, 4, 8]); // un point toutes les 4 s
  assert.equal(r.length, 9);
  assert.equal(r[1], 3);
  assert.equal(r[8], 24);
  const p = distanceEnMouvement([0, 10, 10, 20], [0, 5, 105, 110]); // pause de 100 s
  assert.equal(p.length, 1 + 5 + 1 + 5); // le point de départ, 5 s, la pause pour 1 s, 5 s
  assert.equal(distanceEnMouvement([0, 5, 9], []).join(','), '0,5,9');
});
