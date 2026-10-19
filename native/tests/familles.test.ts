import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familleAffichage, familleSport, garderSeance } from '../src/data/familles.ts';

test('familleSport : les types Strava courants', () => {
  assert.equal(familleSport('Run'), 'course');
  assert.equal(familleSport('Ride'), 'velo');
  assert.equal(familleSport('Swim'), 'natation');
  assert.equal(familleSport('WeightTraining'), 'muscu');
  assert.equal(familleSport('Hyrox'), 'hyrox');
});

test('familleSport : un type inconnu devient « autre »', () => {
  assert.equal(familleSport('Tennis'), 'autre');
  assert.equal(familleSport(null), 'autre');
  assert.equal(familleSport(42), 'autre');
});

test('familleSport : les propriétés héritées ne sont pas des sports', () => {
  assert.equal(familleSport('constructor'), 'autre');
  assert.equal(familleSport('__proto__'), 'autre');
  assert.equal(familleSport('toString'), 'autre');
});

test('familleAffichage : le trail compte comme de la course', () => {
  assert.equal(familleSport('TrailRun'), 'trail');
  assert.equal(familleAffichage('TrailRun'), 'course');
  assert.equal(familleAffichage('Ride'), 'velo');
});

test('garderSeance : le sport, puis la discipline pour l\'athlétisme', () => {
  const run = { sport: 'Run' };
  const quatre = { sport: 'Athletics', discipline: '400m' };
  const haut = { sport: 'Athletics', discipline: 'hauteur' };
  const sans = { sport: 'Athletics' };
  assert.equal(garderSeance(run, 'tout'), true);
  assert.equal(garderSeance(run, 'course'), true);
  assert.equal(garderSeance(run, 'athletisme'), false); // une sortie de course n'est pas de l'athlé
  assert.equal(garderSeance(quatre, 'athletisme', 'tout'), true);
  assert.equal(garderSeance(quatre, 'athletisme', '400m'), true);
  assert.equal(garderSeance(haut, 'athletisme', '400m'), false);
  assert.equal(garderSeance(sans, 'athletisme', 'tout'), true);
  assert.equal(garderSeance(sans, 'athletisme', '400m'), false); // sans discipline : seulement sous « Tout »
  assert.equal(garderSeance(quatre, 'course', '400m'), false);
  assert.equal(garderSeance(run, 'course', '400m'), true); // la discipline ne concerne que l'athlétisme
  assert.equal(garderSeance(null, 'tout'), true);
});

test('garderSeance : le trail passe le filtre « course »', () => {
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'course'), true);
});
