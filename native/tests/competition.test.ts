import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allureMoyenne, aUnFormat, categorieFederation, champNiveau, federationsDuSport, lireTempsCible, texteTempsCible } from '../src/data/competition.ts';

test('fédérations : selon le sport, et rien pour les sports sans fédération', () => {
  assert.deepEqual(federationsDuSport('Ride'), ['FFC', 'UFOLEP', 'FSGT']);
  assert.deepEqual(federationsDuSport('Run'), ['FFA', 'Hors stade']);
  assert.deepEqual(federationsDuSport('Triathlon'), ['FFTri']);
  assert.deepEqual(federationsDuSport('Duathlon'), ['FFTri']);
  assert.deepEqual(federationsDuSport('Swim'), ['FFN']);
  assert.deepEqual(federationsDuSport('WeightTraining'), []);
  assert.equal(categorieFederation('Hyrox'), null);
});

test('niveau : liste fermée pour la FFA, texte libre avec exemple pour les autres', () => {
  assert.equal(champNiveau('FFA').liste?.length, 19);
  assert.equal(champNiveau('FFC').liste, null);
  assert.equal(champNiveau('FFC').exemple, 'ex : Open 1-3, Access 3-4');
  assert.equal(champNiveau('').exemple, 'Niveau ou catégorie');
});

test('format : triathlon et duathlon seulement', () => {
  assert.equal(aUnFormat('Triathlon'), true);
  assert.equal(aUnFormat('Duathlon'), true);
  assert.equal(aUnFormat('Run'), false);
});

test('lireTempsCible : 3h45, 3h, 3:45, 45, 45 min ; le reste est refusé', () => {
  const minutes = (t: string) => { const r = lireTempsCible(t); return r.ok ? r.minutes : 'refusé'; };
  assert.equal(minutes('3h45'), 225);
  assert.equal(minutes(' 3 h 45 '), 225);
  assert.equal(minutes('3H05'), 185);
  assert.equal(minutes('3h'), 180);
  assert.equal(minutes('3:45'), 225);
  assert.equal(minutes('45'), 45);
  assert.equal(minutes('45 min'), 45);
  assert.equal(minutes(''), null);
  for (const mauvais of ['abc', '3h75x', '0', '0h00', '99h', '3:75', '-5', '4500']) assert.equal(minutes(mauvais), 'refusé', mauvais);
});

test('texteTempsCible : l\'inverse', () => {
  assert.equal(texteTempsCible(225), '3h45');
  assert.equal(texteTempsCible(180), '3h');
  assert.equal(texteTempsCible(185), '3h05');
  assert.equal(texteTempsCible(45), '45 min');
});

test('allureMoyenne : course en allure, vélo en km/h, natation aux 100 m, rien sans les deux', () => {
  assert.deepEqual(allureMoyenne('Run', 42.2, 225), { libelle: 'Allure moy.', valeur: `5'20"/km` });
  assert.deepEqual(allureMoyenne('Ride', 100, 240), { libelle: 'Vitesse moy.', valeur: '25,0 km/h' });
  assert.equal(allureMoyenne('Swim', 1.5, 25)?.libelle, 'Allure moy.');
  assert.equal(allureMoyenne('Run', null, 225), null);
  assert.equal(allureMoyenne('Run', 10, null), null);
  assert.equal(allureMoyenne('Run', 0, 50), null);
});
