import test from 'node:test';
import assert from 'node:assert/strict';
import { SPORTS_A_CHOISIR, nettoyerSports, onboardingNecessaire, fusionnerFamilles } from '../src/lib/data/sports-choisis.js';

test('sports proposés : les 5 familles de l\'accueil et « Autre »', () => {
  assert.deepEqual(SPORTS_A_CHOISIR, ['course', 'velo', 'natation', 'muscu', 'hyrox', 'autre']);
});

test('nettoyerSports : clés connues seulement, sans doublon, dans l\'ordre de l\'écran ; pas un tableau = jamais demandé', () => {
  assert.deepEqual(nettoyerSports(['muscu', 'course', 'course', 'inconnu', 42, null, '__proto__', 'constructor']), ['course', 'muscu']);
  assert.deepEqual(nettoyerSports([]), []);
  assert.equal(nettoyerSports(null), null);
  assert.equal(nettoyerSports(undefined), null);
  assert.equal(nettoyerSports('course'), null);
  assert.equal(nettoyerSports({ 0: 'course' }), null);
});

test('onboardingNecessaire : seulement un vrai compte neuf, sans aucune donnée et dont les sports ne sont jamais demandés', () => {
  assert.equal(onboardingNecessaire({}), true);
  assert.equal(onboardingNecessaire({ demo: true }), false);
  assert.equal(onboardingNecessaire({ sportsEnregistres: [] }), false); // déjà passé (même sans rien choisir)
  assert.equal(onboardingNecessaire({ sportsEnregistres: ['course'] }), false);
  assert.equal(onboardingNecessaire({ nbSeances: 3 }), false); // un compte avec des données n'est jamais dérangé
  assert.equal(onboardingNecessaire({ aForce: true }), false);
  assert.equal(onboardingNecessaire({ aHyrox: true }), false);
});

test('fusionnerFamilles : données + sports choisis, sans doublon et sans « autre »', () => {
  assert.deepEqual(fusionnerFamilles(['course'], ['velo', 'course', 'autre']).sort(), ['course', 'velo']);
  assert.deepEqual(fusionnerFamilles([], ['muscu']), ['muscu']);
  assert.deepEqual(fusionnerFamilles(['autre'], null), []);
  assert.deepEqual(fusionnerFamilles(), []);
});
