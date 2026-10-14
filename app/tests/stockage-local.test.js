import test from 'node:test';
import assert from 'node:assert/strict';
import { migrerClesLocales } from '../src/lib/stockage-local.js';

// Un faux localStorage : un objet avec getItem / setItem / removeItem, et ses clés énumérables
function faux(init = {}) {
  const d = { ...init };
  return new Proxy(d, {
    get: (t, k) => (k === 'getItem' ? (c) => (c in t ? t[c] : null) : k === 'setItem' ? (c, v) => (t[c] = String(v)) : k === 'removeItem' ? (c) => delete t[c] : t[k]),
    ownKeys: (t) => Object.keys(t),
    getOwnPropertyDescriptor: (t, k) => ({ value: t[k], enumerable: true, configurable: true, writable: true }),
  });
}

test('stockage : les anciennes clés sont recopiées sous le nouveau nom puis supprimées', () => {
  const s = faux({ 'coachia-v2-theme': 'clair', 'coachia-v2-menu-u1': '{"a":1}', 'autre-cle': 'x' });
  assert.equal(migrerClesLocales(s), 2);
  assert.equal(s.getItem('rush-theme'), 'clair');
  assert.equal(s.getItem('rush-menu-u1'), '{"a":1}');
  assert.equal(s.getItem('coachia-v2-theme'), null);
  assert.equal(s.getItem('autre-cle'), 'x'); // le reste n'est pas touché
});

test('stockage : une valeur déjà présente sous le nouveau nom n\'est jamais écrasée', () => {
  const s = faux({ 'coachia-v2-theme': 'clair', 'rush-theme': 'sombre' });
  migrerClesLocales(s);
  assert.equal(s.getItem('rush-theme'), 'sombre');
  assert.equal(s.getItem('coachia-v2-theme'), null);
});

test('stockage : relançable sans effet, et sans erreur si le stockage est indisponible', () => {
  const s = faux({ 'coachia-v2-theme': 'clair' });
  migrerClesLocales(s);
  assert.equal(migrerClesLocales(s), 0);
  assert.doesNotThrow(() => migrerClesLocales({ get keys() { throw new Error('bloqué'); } }));
});
