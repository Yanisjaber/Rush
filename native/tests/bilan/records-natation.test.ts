import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classementAllureNatation, courbeNatation, DISTANCES_SEANCE_NATATION, ecartAllure100 } from '../../src/data/bilan/records-natation.ts';
import { echelleAllure, allureAxe } from '../../src/data/bilan/records-course.ts';
import { texteRecordSimple } from '../../src/data/bilan/records-texte.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';

const nage = (id: string, iso: string, km: number, min: number, famille = 'natation'): ActiviteBilan => ({ id, name: id, iso, sport: 'natation', famille, duree_min: min, distance_km: km, d_plus: 0, tss: 0 });

const SEANCES = [
  nage('court-vite', '2026-01-05', 0.4, 6), // 400 m en 6 min : 4 km/h = 1'30"/100 m
  nage('moyen', '2026-02-01', 1.5, 36), // 2,5 km/h = 2'24"/100 m
  nage('long', '2026-03-01', 3, 60), // 3 km/h = 2'00"/100 m
  nage('lent', '2026-04-01', 2, 60), // 2 km/h = 3'00"/100 m
  nage('velo', '2026-05-01', 40, 90, 'velo'), // pas de la natation
  nage('sans-duree', '2026-06-01', 2, 0),
  nage('sous-seuil', '2026-07-01', 0.2, 3), // sous 300 m
];

test('classementAllureNatation : les séances d\'au moins la distance, la plus rapide d\'abord ; une séance longue compte aussi pour les distances plus courtes', () => {
  const r300 = classementAllureNatation(SEANCES, 300);
  assert.deepEqual(r300.map((e) => e.id), ['court-vite', 'long', 'moyen', 'lent']);
  assert.equal(r300[0].valeur, 4);
  assert.equal(texteRecordSimple(r300[0].valeur, 'allure100'), `1'30" /100 m`);
  // 1 km : la séance de 400 m ne compte plus
  assert.deepEqual(classementAllureNatation(SEANCES, 1000).map((e) => e.id), ['long', 'moyen', 'lent']);
  // 3 km : une seule séance
  assert.deepEqual(classementAllureNatation(SEANCES, 3000).map((e) => e.id), ['long']);
  assert.deepEqual(classementAllureNatation(SEANCES, 5000), []);
  assert.equal(classementAllureNatation(SEANCES, 300, 2).length, 2);
});

test('courbeNatation : un point par distance atteinte, le podium de 3 séances, l\'allure qui se dégrade rarement avec la distance', () => {
  const c = courbeNatation(SEANCES);
  assert.deepEqual(c.map((p) => p.duree), [300, 500, 750, 1000, 1500, 2000, 2500, 3000]); // pas de 4 km ni de 5 km : aucune séance
  assert.equal(c[0].top[0].id, 'court-vite');
  assert.equal(c[1].top[0].id, 'long'); // 500 m : la séance de 400 m ne compte plus
  assert.equal(c[1].top.length, 3);
  assert.ok(DISTANCES_SEANCE_NATATION.includes(1500));
  assert.deepEqual(courbeNatation([]), []);
});

test('ecartAllure100 : l\'écart d\'allure au 100 m entre deux séances', () => {
  assert.equal(ecartAllure100(4, 3), `+0'30"/100 m`); // 1'30" contre 2'00"
  assert.equal(ecartAllure100(0, 3), '');
});

test('echelleAllure et allureAxe : des allures rondes au 100 m (pas de 5 puis 10 s) ou au km (30 puis 60 s)', () => {
  const courbe = [{ top: [{ valeur: 4 }] }, { top: [{ valeur: 3 }] }, { top: [{ valeur: 2.5 }] }]; // 1'30", 2'00", 2'24" au 100 m
  const e = echelleAllure([courbe], 360, 5, 10)!;
  // Étendue de 54 s : pas de 10 s ; allures de 1'30" à 2'30" : 6 repères, la plus rapide en haut
  assert.equal(e.max, 4);
  assert.ok(Math.abs(e.min - 360 / 150) < 1e-9, `${e.min}`);
  assert.equal(e.reperes.length, 7);
  assert.equal(allureAxe(4, 360), `1'30"`);
  assert.equal(allureAxe(12), `5'00"`);
  assert.equal(echelleAllure([[{ top: [{ valeur: 4 }] }]], 360, 5, 10), null);
});
