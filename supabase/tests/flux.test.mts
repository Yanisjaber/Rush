// Test de la remise à 1 point par seconde (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/flux.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { reechantillonner1Hz } from '../functions/_shared/flux.ts';

test('déjà à 1 Hz : la série est rendue telle quelle', () => {
  const w = [100, 110, 120];
  assert.deepEqual(reechantillonner1Hz(w, [0, 1, 2]), w);
});
test('petit trou (enregistrement toutes les 2 s) : la valeur est tenue', () => {
  assert.deepEqual(reechantillonner1Hz([100, 200, 300], [0, 2, 4]), [100, 100, 200, 200, 300]);
});
test('long trou (pause de 60 s) : des zéros, la durée est celle de l’horloge', () => {
  const r = reechantillonner1Hz([200, 200, 200], [0, 1, 61]);
  assert.equal(r.length, 62);
  assert.equal(r[1], 200);
  assert.equal(r[30], 0);
  assert.equal(r[61], 200);
});
test('sans flux de temps exploitable : rendu tel quel', () => {
  const w = [1, 2, 3];
  assert.deepEqual(reechantillonner1Hz(w, []), w);
  assert.deepEqual(reechantillonner1Hz(w, [0, 0, 1]), w);          // non croissant
  assert.deepEqual(reechantillonner1Hz(w, [0, 1]), w);             // longueurs différentes
  assert.deepEqual(reechantillonner1Hz(w, undefined as any), w);
});
test('valeur absente = 0', () => {
  assert.deepEqual(reechantillonner1Hz([null, 5], [0, 2]), [0, 0, 5]);
});
