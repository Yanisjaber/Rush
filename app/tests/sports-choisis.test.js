import test from 'node:test';
import assert from 'node:assert/strict';
import { SPORTS } from '../src/lib/sports.js';
import { SPORTS_PRINCIPAUX, SPORTS_AUTRES, SPORTS_A_CHOISIR, GROUPES_SPORTS, nettoyerSports, onboardingNecessaire, fusionnerFamilles } from '../src/lib/data/sports-choisis.js';

test('sports proposés : les 5 sports de l\'accueil, puis les autres sports de performance (plus de case « Autre »)', () => {
  assert.deepEqual(SPORTS_PRINCIPAUX, ['course', 'velo', 'natation', 'muscu', 'hyrox']);
  assert.deepEqual(SPORTS_AUTRES, ['athletisme', 'trail', 'vtt', 'triathlon', 'duathlon', 'crossfit', 'aviron', 'ski', 'combat', 'rando', 'escalade', 'pagaie']);
  assert.deepEqual(SPORTS_A_CHOISIR, [...SPORTS_PRINCIPAUX, ...SPORTS_AUTRES]);
  assert.ok(!SPORTS_A_CHOISIR.includes('autre'));
  assert.ok(SPORTS_A_CHOISIR.length <= 20); // la base refuse plus de 20 sports (voir la migration)
  for (const cle of SPORTS_A_CHOISIR) assert.ok(Object.hasOwn(SPORTS, cle), `${cle} doit exister dans le catalogue des sports`);
});

test('nettoyerSports : clés connues seulement, sans doublon, dans l\'ordre de l\'écran ; pas un tableau = jamais demandé', () => {
  assert.deepEqual(nettoyerSports(['muscu', 'course', 'course', 'inconnu', 42, null, '__proto__', 'constructor', 'autre', 'aviron', 'athletisme']), ['course', 'muscu', 'athletisme', 'aviron']); // l'ancienne valeur « autre » disparaît
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
  assert.deepEqual(fusionnerFamilles([], ['trail']), ['course']); // le trail est de la course
  assert.deepEqual(fusionnerFamilles([], ['vtt']), ['velo']);
  assert.deepEqual(fusionnerFamilles([], ['triathlon']).sort(), ['course', 'natation', 'velo']);
  assert.deepEqual(fusionnerFamilles([], ['duathlon']).sort(), ['course', 'velo']); // course + vélo, sans natation
  assert.deepEqual(fusionnerFamilles([], ['athletisme']), ['athletisme']); // pastille propre
  assert.deepEqual(fusionnerFamilles([], ['aviron', 'rando']).sort(), ['aviron', 'rando']); // pastille propre, sans widgets dédiés
  assert.deepEqual(fusionnerFamilles([], ['constructor']), ['constructor']); // une clé inconnue n'est pas interprétée (le nettoyage en amont l'a déjà retirée)
  assert.deepEqual(fusionnerFamilles([], ['muscu']), ['muscu']);
  assert.deepEqual(fusionnerFamilles(['autre'], null), []);
  assert.deepEqual(fusionnerFamilles(), []);
});

test('groupes de l\'écran de choix : tous les sports proposés, chacun dans un seul groupe', () => {
  const dansGroupes = GROUPES_SPORTS.flatMap((g) => g.sports);
  assert.equal(new Set(dansGroupes).size, dansGroupes.length); // aucun sport en double
  assert.deepEqual([...dansGroupes].sort(), [...SPORTS_A_CHOISIR].sort()); // ni oublié, ni inventé
  assert.ok(GROUPES_SPORTS.every((g) => g.titre.length > 1 && g.sports.length > 0));
});
