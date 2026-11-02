// Test du résumé cardio d'une sortie (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/cardio.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleCardio } from '../../functions/_shared/cardio.ts';

const constante = (n: number, v: number) => new Array(n).fill(v);

test('cleCardio : une heure à 150 bpm → 3600 s et 3600 × 150²', () => {
  assert.deepEqual(cleCardio(constante(3600, 150)), { hr_s: 3600, hr_sq: 3600 * 150 * 150 });
});

test('cleCardio : à la LTHR pendant une heure, le TSS déduit vaut 100 ; à 150 pendant 1 h pour une LTHR de 170, 78', () => {
  const tss = (c: Record<string, number>, lthr: number) => (100 * c.hr_sq) / (lthr * lthr * 3600);
  assert.equal(Math.round(tss(cleCardio(constante(3600, 170)), 170)), 100);
  assert.equal(Math.round(tss(cleCardio(constante(3600, 150)), 170)), 78);
});

test('cleCardio : une sortie variée pèse plus que sa moyenne (moyenne des carrés > carré de la moyenne)', () => {
  const fc = [...constante(1800, 120), ...constante(1800, 180)]; // moyenne 150
  const tss = (c: Record<string, number>, lthr: number) => (100 * c.hr_sq) / (lthr * lthr * 3600);
  assert.ok(tss(cleCardio(fc), 170) > (150 / 170) ** 2 * 100);
});

test('cleCardio : les pauses (cardio 0), les trous et les valeurs absurdes ne comptent pas', () => {
  const fc = [...constante(600, 0), ...constante(1200, 140), 0, null, undefined, 'x', 300, 20, ...constante(600, 160)];
  const r = cleCardio(fc);
  assert.equal(r.hr_s, 1800);
  assert.equal(r.hr_sq, 1200 * 140 * 140 + 600 * 160 * 160);
});

test('cleCardio : aucun cardio → rien', () => {
  assert.deepEqual(cleCardio([]), {});
  assert.deepEqual(cleCardio(constante(100, 0)), {});
  assert.deepEqual(cleCardio(undefined as any), {});
});
