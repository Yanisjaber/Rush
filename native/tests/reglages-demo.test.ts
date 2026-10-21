import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definirPrevuesAujourdhui, PREVUES_AUJOURDHUI } from '../src/stores/reglagesDemo.ts';

test('réglages de la démo : de 0 à 5 séances prévues, rien d\'autre', () => {
  assert.deepEqual([...PREVUES_AUJOURDHUI], [0, 1, 2, 3, 4, 5]);
  // Une valeur absurde est ignorée et ne casse rien (le réglage reste sur une valeur permise)
  assert.doesNotThrow(() => definirPrevuesAujourdhui(6));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(-1));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(2.5));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(3));
});
