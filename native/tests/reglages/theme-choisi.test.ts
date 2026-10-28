import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireChoixTheme, schemaDe } from '../../src/data/reglages/theme-choisi.ts';

test('lireChoixTheme : seuls « sombre » et « clair » sont acceptés', () => {
  assert.equal(lireChoixTheme('sombre'), 'sombre');
  assert.equal(lireChoixTheme('clair'), 'clair');
  for (const v of [null, undefined, '', 'auto', 'Clair', 'dark', 0, {}]) assert.equal(lireChoixTheme(v), null);
});

test('schemaDe : clair = light, sombre = dark', () => {
  assert.equal(schemaDe('clair'), 'light');
  assert.equal(schemaDe('sombre'), 'dark');
});
