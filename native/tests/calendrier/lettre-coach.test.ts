import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morceauxLettre } from '../../src/data/calendrier/lettre-coach.ts';

test('morceauxLettre : le texte et les chiffres entourés', () => {
  assert.deepEqual(morceauxLettre(`Tu as fini à [[5'46"]] avec [[181 bpm]], bien.`), [
    { texte: 'Tu as fini à ', chiffre: false },
    { texte: `5'46"`, chiffre: true },
    { texte: ' avec ', chiffre: false },
    { texte: '181 bpm', chiffre: true },
    { texte: ', bien.', chiffre: false },
  ]);
});

test('morceauxLettre : sans crochets, un seul morceau ; crochets mal fermés laissés tels quels', () => {
  assert.deepEqual(morceauxLettre('Rien à surligner.'), [{ texte: 'Rien à surligner.', chiffre: false }]);
  assert.deepEqual(morceauxLettre('Un [[crochet ouvert'), [{ texte: 'Un [[crochet ouvert', chiffre: false }]);
  assert.deepEqual(morceauxLettre(''), []);
});
