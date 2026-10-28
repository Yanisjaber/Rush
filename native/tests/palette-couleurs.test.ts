import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hslVersHex, paletteComplete } from '../src/data/outils/palette-couleurs.ts';

test('hslVersHex : les couleurs de base', () => {
  assert.equal(hslVersHex(0, 100, 50), '#ff0000');
  assert.equal(hslVersHex(120, 100, 50), '#00ff00');
  assert.equal(hslVersHex(240, 100, 50), '#0000ff');
  assert.equal(hslVersHex(0, 0, 100), '#ffffff');
  assert.equal(hslVersHex(0, 0, 0), '#000000');
});

test('paletteComplete : 40 couleurs #rrggbb, toutes différentes', () => {
  const p = paletteComplete();
  assert.equal(p.length, 40);
  for (const c of p) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(p).size, 40);
});
