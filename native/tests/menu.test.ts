import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtreApres, filtreValide } from '../src/data/accueil/menu.ts';

test('filtreApres : toucher un sport le choisit', () => {
  assert.equal(filtreApres('tout', 'course'), 'course');
  assert.equal(filtreApres('course', 'velo'), 'velo');
});

test('filtreApres : retoucher le sport choisi revient à « Tous »', () => {
  assert.equal(filtreApres('course', 'course'), 'tout');
});

test('filtreApres : « Tous » remet à zéro, même depuis « Tous »', () => {
  assert.equal(filtreApres('velo', 'tout'), 'tout');
  assert.equal(filtreApres('tout', 'tout'), 'tout');
});

test('filtreValide : un sport retiré du menu retombe sur « Tous »', () => {
  assert.equal(filtreValide('course', ['course', 'velo']), 'course');
  assert.equal(filtreValide('hyrox', ['course', 'velo']), 'tout');
  assert.equal(filtreValide('tout', []), 'tout');
});
