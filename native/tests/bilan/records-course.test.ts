import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chronoSurDistance, courbeCourseDeLignes, ecartAllure, SIGNAUX_COURSE, texteDistance, valeurDeLigne, type LigneCourbeCourse } from '../../src/data/bilan/records-course.ts';
import { texteRecordSimple } from '../../src/data/bilan/records-texte.ts';

const ligne = (cle: number, rang: number, valeur: number | string, name: string, date = '2026-03-01T09:00:00+00:00'): LigneCourbeCourse => ({ cle, rang, valeur, activity_id: `${name}-${cle}`, name, start_date_local: date });

test('valeurDeLigne : l\'allure devient une vitesse (distance ÷ temps), la distance passe en km, la FC reste', () => {
  assert.equal(valeurDeLigne('pace', 5000, 1500), 12); // 5 km en 25 min = 12 km/h = 5'00"/km
  assert.equal(valeurDeLigne('pace', 1000, 0), 0);
  assert.equal(valeurDeLigne('dis', 600, 2650), 2.65);
  assert.equal(valeurDeLigne('fc', 600, 172), 172);
});

test('courbeCourseDeLignes : un point par distance, du plus court au plus long, le meilleur d\'abord, les numeric en texte acceptés', () => {
  const c = courbeCourseDeLignes('pace', [ligne(5000, 2, '1500.0', 'B'), ligne(1000, 1, 240, 'A'), ligne(5000, 1, '1400.5', 'A'), ligne(400, 1, 80, 'C')]);
  assert.deepEqual(c.map((p) => p.duree), [400, 1000, 5000]);
  assert.equal(c[2].top.length, 2);
  assert.equal(c[2].top[0].nom, 'A');
  assert.ok(c[2].top[0].valeur > c[2].top[1].valeur); // le meilleur temps est la plus haute vitesse
  assert.ok(Math.abs(c[1].top[0].valeur - 15) < 1e-9); // 1 km en 4'00" = 15 km/h
  assert.equal(c[0].top[0].iso, '2026-03-01');
});

test('allure : la vitesse s\'écrit en minutes et secondes par km', () => {
  assert.equal(texteRecordSimple(12, 'allure'), `5'00" /km`);
  assert.equal(texteRecordSimple(15, 'allure'), `4'00" /km`);
  assert.equal(texteRecordSimple(10, 'allure'), `6'00" /km`);
});

test('texteDistance : 400 m, 1 km, 1 mile, 5 km, Semi, Marathon', () => {
  assert.deepEqual([400, 1000, 1609, 3000, 5000, 10000, 21097, 42195].map(texteDistance), ['400 m', '1 km', '1 mile', '3 km', '5 km', '10 km', 'Semi', 'Marathon']);
  assert.equal(texteDistance(1500), '1,5 km');
});

test('chronoSurDistance et ecartAllure : le chrono d\'un 5 km à 12 km/h, l\'écart d\'allure entre deux sorties', () => {
  assert.equal(chronoSurDistance(5000, 12), `25'00"`);
  assert.equal(chronoSurDistance(21097, 14), `1h30'25"`);
  assert.equal(chronoSurDistance(1000, 0), '—');
  assert.equal(ecartAllure(15, 12), `+1'00"/km`); // 4'00" contre 5'00"
  assert.equal(ecartAllure(0, 12), '');
});

test('SIGNAUX_COURSE : l\'allure se lit par distance, la distance et la FC par durée', () => {
  assert.deepEqual(SIGNAUX_COURSE.map((s) => [s.cle, s.axe, s.unite]), [['pace', 'distance', 'allure'], ['dis', 'duree', 'km'], ['fc', 'duree', 'bpm']]);
});
