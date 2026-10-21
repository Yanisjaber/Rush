import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definirPrevuesAujourdhui, PREVUES_AUJOURDHUI } from '../src/stores/reglagesDemo.ts';

test('réglages de la démo : 0, 1, 2 ou 3 séances prévues, rien d\'autre', () => {
  assert.deepEqual([...PREVUES_AUJOURDHUI], [0, 1, 2, 3]);
  // Une valeur absurde est ignorée et ne casse rien (le réglage reste sur une valeur permise)
  assert.doesNotThrow(() => definirPrevuesAujourdhui(7));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(-1));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(2.5));
  assert.doesNotThrow(() => definirPrevuesAujourdhui(3));
});
