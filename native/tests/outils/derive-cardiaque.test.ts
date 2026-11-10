import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveCardiaque } from '../../src/data/outils/derive-cardiaque.ts';

const temps = Array.from({ length: 1800 }, (_, i) => i * 2); // 1 h, un point toutes les 2 s

test('dérive : même vitesse, cœur +5 % en seconde moitié : environ 4,8 %', () => {
  const vitesse = temps.map(() => 3);
  const fc = temps.map((t) => (t < 1800 ? 160 : 168)); // +5 %
  const r = deriveCardiaque({ temps, vitesse, fc }, 'autre')!;
  assert.equal(r.base, 'vitesse');
  assert.ok(Math.abs(r.pct - 4.8) < 0.1, String(r.pct));
});

test('dérive : cœur stable : 0 %', () => {
  const r = deriveCardiaque({ temps, vitesse: temps.map(() => 3), fc: temps.map(() => 150) }, 'autre')!;
  assert.equal(r.pct, 0);
});

test('dérive : le vélo compare la puissance au cœur quand elle existe', () => {
  const r = deriveCardiaque({ temps, watts: temps.map(() => 200), vitesse: temps.map(() => 8), fc: temps.map((t) => (t < 1800 ? 140 : 147)) }, 'velo')!;
  assert.equal(r.base, 'puissance');
  assert.ok(r.pct > 4 && r.pct < 5.5);
});

test('dérive : trop court, sans cœur ou sans vitesse : null', () => {
  const court = Array.from({ length: 300 }, (_, i) => i * 2); // 10 min
  assert.equal(deriveCardiaque({ temps: court, vitesse: court.map(() => 3), fc: court.map(() => 150) }, 'autre'), null);
  assert.equal(deriveCardiaque({ temps, vitesse: temps.map(() => 3) }, 'autre'), null);
  assert.equal(deriveCardiaque({ temps, fc: temps.map(() => 150) }, 'autre'), null);
  assert.equal(deriveCardiaque(null, 'autre'), null);
});
