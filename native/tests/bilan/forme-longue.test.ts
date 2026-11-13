import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conditionDesSeances, conditionParSemaine, picCondition } from '../../src/data/bilan/forme-longue.ts';

const m = (iso_date: string, ctl: number) => ({ iso_date, ctl });

test('une condition par semaine : la dernière de la semaine (lundi à dimanche)', () => {
  const p = conditionParSemaine([m('2026-03-02', 40), m('2026-03-05', 42), m('2026-03-08', 44), m('2026-03-09', 45)]);
  assert.deepEqual(p, [{ lundi: '2026-03-02', ctl: 44 }, { lundi: '2026-03-09', ctl: 45 }]);
});

test('une semaine sans donnée reprend la valeur de la précédente, sans trou', () => {
  const p = conditionParSemaine([m('2026-03-02', 40), m('2026-03-16', 50)]);
  assert.deepEqual(p.map((x) => x.lundi), ['2026-03-02', '2026-03-09', '2026-03-16']);
  assert.deepEqual(p.map((x) => x.ctl), [40, 40, 50]);
});

test('le pic : la semaine la plus haute, la première à égalité', () => {
  const p = conditionParSemaine([m('2026-03-02', 40), m('2026-03-09', 70), m('2026-03-16', 70), m('2026-03-23', 50)]);
  assert.deepEqual(picCondition(p), { lundi: '2026-03-09', ctl: 70 });
});

test('sans donnée : aucun point, aucun pic', () => {
  assert.deepEqual(conditionParSemaine([]), []);
  assert.equal(picCondition([]), null);
});

test('les valeurs absentes ou négatives sont ignorées', () => {
  const p = conditionParSemaine([m('2026-03-02', Number.NaN), m('2026-03-03', -5), m('2026-03-04', 30)]);
  assert.deepEqual(p, [{ lundi: '2026-03-02', ctl: 30 }]);
});

test('conditionDesSeances : la même formule que la base (moyenne glissante, 2 / 43), jour après jour', () => {
  const j = conditionDesSeances([{ iso: '2026-03-02', tss: 100 }], new Date(2026, 2, 4));
  assert.deepEqual(j.map((x) => x.iso_date), ['2026-03-02', '2026-03-03', '2026-03-04']);
  const jour1 = 100 * (2 / 43);
  assert.ok(Math.abs(j[0].ctl - jour1) < 1e-9);
  assert.ok(Math.abs(j[1].ctl - (jour1 + (0 - jour1) * (2 / 43))) < 1e-9); // un jour sans séance : la condition baisse un peu
});

test('conditionDesSeances : les séances du même jour s\'additionnent, une charge absente compte pour 0', () => {
  const j = conditionDesSeances([{ iso: '2026-03-02', tss: 40 }, { iso: '2026-03-02', tss: 60 }, { iso: '2026-03-03', tss: 0 }], new Date(2026, 2, 3));
  assert.ok(Math.abs(j[0].ctl - 100 * (2 / 43)) < 1e-9);
  assert.ok(j[1].ctl < j[0].ctl);
});

test('conditionDesSeances : sans séance, rien ; une date de 1970 est ignorée', () => {
  assert.deepEqual(conditionDesSeances([], new Date(2026, 2, 3)), []);
  assert.deepEqual(conditionDesSeances([{ iso: '1970-01-01', tss: 50 }], new Date(2026, 2, 3)), []);
});
