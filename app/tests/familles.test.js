import test from 'node:test';
import assert from 'node:assert/strict';
import { familleSport, familleAffichage, garderSeance } from '../src/lib/data/familles.js';
import { SPORTS } from '../src/lib/sports.js';

test('types Strava courants rangés dans une vraie famille (pas « autre »)', () => {
  const attendu = {
    Workout: 'muscu', WeightTraining: 'muscu', Yoga: 'muscu', Pilates: 'muscu',
    Walk: 'autre', Hike: 'autre', Snowshoe: 'autre', Rowing: 'autre', Boxing: 'autre', Athletics: 'autre',
    Elliptical: 'course', StairStepper: 'course', Run: 'course', VirtualRun: 'course',
    AlpineSki: 'autre', Snowboard: 'autre', RollerSki: 'autre', NordicSki: 'autre',
    Ride: 'velo', MountainBikeRide: 'velo', Swim: 'natation', Crossfit: 'muscu', HighIntensityIntervalTraining: 'muscu', GravelRide: 'velo', TrailRun: 'course', Hyrox: 'hyrox',
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
