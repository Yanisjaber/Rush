import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sommeilDemo } from '../src/data/demo.ts';
import { heureDe, minutesCoucher, phases, efficacite } from '../src/data/sommeil.ts';
import { analyser, comparaisons, preparer, scoreNuit, scorePalier } from '../src/data/score-sommeil.ts';

const jour = new Date(2026, 9, 19);

test('heureDe et minutesCoucher gèrent minuit', () => {
  assert.equal(heureDe('2026-10-18 23:05'), '23:05');
  assert.equal(heureDe(null), null);
  assert.equal(minutesCoucher('01:00'), 25 * 60);
  assert.equal(minutesCoucher('23:00'), 23 * 60);
});

test('phases : parts qui totalisent 1, vide sans données', () => {
  const n = sommeilDemo(jour, 1)[0];
  const somme = phases(n).reduce((s, p) => s + p.part, 0);
  assert.ok(Math.abs(somme - 1) < 1e-9);
  assert.deepEqual(phases(null), []);
  assert.ok((efficacite(n) as number) > 0.5);
});

test('scorePalier : bornes', () => {
  assert.equal(scorePalier(90, 85, 75, 40, true), 100);
  assert.equal(scorePalier(75, 85, 75, 40, true), 25);
  assert.equal(scorePalier(30, 85, 75, 40, true), 0);
  assert.equal(scorePalier(null, 85, 75, 40, true), null);
});

test('scoreNuit : borné 0-100 ; nuit sans sommeil = 0', () => {
  for (const n of sommeilDemo(jour, 45)) {
    const s = scoreNuit(n);
    assert.ok(s && s.total >= 0 && s.total <= 100);
  }
  assert.equal(scoreNuit({ total_sec: 0 })?.total, 0);
});

test('analyser et comparaisons sur 45 nuits de démo', () => {
  const nuits = preparer(sommeilDemo(jour, 45));
  assert.equal(nuits[0].date > nuits[1].date, true);
  const pro = analyser(nuits);
  assert.ok(pro && pro.nbNuits === 45 && pro.horaires);
  assert.equal(analyser([]), null);
  const c = comparaisons(nuits);
  assert.ok(c.recent && c.semaineWeekEnd);
});
