import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conditionParSemaine, picCondition } from '../../src/data/bilan/forme-longue.ts';

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
