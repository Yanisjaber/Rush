import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familleAffichage, familleBarre, familleDesWidgets, familleSport, garderSeance } from '../src/data/familles.ts';

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

test('garderSeance : « tout » garde tout, sinon le sport de la pastille', () => {
  const run = { sport: 'Run' };
  const athle = { sport: 'Athletics' };
  assert.equal(garderSeance(run, 'tout'), true);
  assert.equal(garderSeance(run, 'course'), true);
  assert.equal(garderSeance(run, 'velo'), false);
  assert.equal(garderSeance(athle, 'tout'), true); // l'athlétisme n'a plus de page : il ne se voit que sous « Tout »
  assert.equal(garderSeance(athle, 'course'), false);
  assert.equal(garderSeance(null, 'tout'), true);
});

test('garderSeance : Trail et Course sont deux filtres différents (idem VTT et vélo)', () => {
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'course'), false);
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'trail'), true);
  assert.equal(garderSeance({ sport: 'Run' }, 'trail'), false);
  assert.equal(garderSeance({ sport: 'Run' }, 'course'), true);
  assert.equal(garderSeance({ sport: 'MountainBikeRide' }, 'vtt'), true);
  assert.equal(garderSeance({ sport: 'GravelRide' }, 'velo'), false);
  assert.equal(garderSeance({ sport: 'Ride' }, 'velo'), true);
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'tout'), true);
});

test('familleBarre et familleDesWidgets', () => {
  assert.equal(familleBarre('TrailRun'), 'trail');
  assert.equal(familleBarre('MountainBikeRide'), 'vtt');
  assert.equal(familleBarre('Swim'), 'natation');
  assert.equal(familleDesWidgets('trail'), 'course');
  assert.equal(familleDesWidgets('vtt'), 'velo');
  assert.equal(familleDesWidgets('muscu'), 'muscu');
});
