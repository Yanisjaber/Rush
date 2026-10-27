import test from 'node:test';
import assert from 'node:assert/strict';
import { derniereDemande } from '../src/lib/utils/derniere-demande.js';

test('seule la dernière demande est actuelle', () => {
  const s = derniereDemande();
  const a = s.nouvelle();
  assert.equal(s.estActuelle(a), true);
  const b = s.nouvelle();
  assert.equal(s.estActuelle(a), false); // la réponse de A arrive en retard : ignorée
  assert.equal(s.estActuelle(b), true);
});

test('annuler : la réponse en cours est ignorée', () => {
  const s = derniereDemande();
  const a = s.nouvelle();
  s.annuler();
  assert.equal(s.estActuelle(a), false);
});
