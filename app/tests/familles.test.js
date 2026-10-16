import test from 'node:test';
import assert from 'node:assert/strict';
import { familleSport, familleAffichage, garderSeance } from '../src/lib/data/familles.js';
import { SPORTS } from '../src/lib/sports.js';

test('types Strava courants rangés dans une vraie famille (pas « autre »)', () => {
  const attendu = {
    Workout: 'muscu', WeightTraining: 'muscu', Yoga: 'muscu', Pilates: 'muscu',
    Walk: 'rando', Hike: 'rando', Snowshoe: 'rando',
    Elliptical: 'course', StairStepper: 'course', Run: 'course', VirtualRun: 'course',
    AlpineSki: 'ski', Snowboard: 'ski', RollerSki: 'ski', NordicSki: 'ski',
    Ride: 'velo', MountainBikeRide: 'velo', Swim: 'natation', Crossfit: 'crossfit', Hyrox: 'hyrox',
    Triathlon: 'triathlon', Duathlon: 'duathlon', // sports à part entière, pas « course + vélo + natation »
  };
  for (const [brut, famille] of Object.entries(attendu)) assert.equal(familleSport(brut), famille, brut);
  assert.equal(familleAffichage('TrailRun'), 'course'); // le trail s'affiche avec la course
});

test('sports inconnus ou piégés → autre', () => {
  for (const brut of ['Soccer', 'Golf', 'Tennis', '', null, undefined, 3, 'constructor', '__proto__', 'toString']) assert.equal(familleSport(brut), 'autre', String(brut));
});

test('toutes les familles de la table existent dans le catalogue des sports', () => {
  for (const brut of ['Workout', 'Yoga', 'Walk', 'Elliptical', 'AlpineSki', 'Rowing', 'Boxing', 'Canoeing']) {
    assert.ok(Object.hasOwn(SPORTS, familleSport(brut)), brut);
  }
});

test('« Other » (autre sport prévu dans l\'app) reste « autre », « Workout » (Strava) est de la muscu', () => {
  assert.equal(familleSport('Other'), 'autre');
  assert.equal(familleSport('Workout'), 'muscu');
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
