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

test('familleSport : le trail est de la course ; le VTT, le gravel et le vélo électrique sont du vélo ; le CrossFit et le HIIT sont de la musculation', () => {
  assert.equal(familleSport('TrailRun'), 'course');
  assert.equal(familleAffichage('TrailRun'), 'course');
  for (const t of ['Ride', 'MountainBikeRide', 'GravelRide', 'EMountainBikeRide', 'EBikeRide', 'VirtualRide']) assert.equal(familleSport(t), 'velo', t);
  for (const t of ['Crossfit', 'HighIntensityIntervalTraining', 'WeightTraining']) assert.equal(familleSport(t), 'muscu', t);
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

test('garderSeance : Course garde le trail, Vélo garde le VTT et le gravel', () => {
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'course'), true);
  assert.equal(garderSeance({ sport: 'Run' }, 'course'), true);
  assert.equal(garderSeance({ sport: 'MountainBikeRide' }, 'velo'), true);
  assert.equal(garderSeance({ sport: 'GravelRide' }, 'velo'), true);
  assert.equal(garderSeance({ sport: 'Ride' }, 'velo'), true);
  assert.equal(garderSeance({ sport: 'Run' }, 'velo'), false);
  assert.equal(garderSeance({ sport: 'TrailRun' }, 'tout'), true);
});

test('garderSeance : Muscu garde le CrossFit et le HIIT', () => {
  for (const sport of ['Crossfit', 'HighIntensityIntervalTraining', 'WeightTraining']) assert.equal(garderSeance({ sport }, 'muscu'), true, sport);
  assert.equal(garderSeance({ sport: 'Run' }, 'muscu'), false);
});

test('garderSeance : Triathlon garde natation, vélo et course ; Duathlon garde course et vélo, pas la natation', () => {
  for (const sport of ['Swim', 'Ride', 'Run', 'TrailRun', 'MountainBikeRide', 'Triathlon']) assert.equal(garderSeance({ sport }, 'triathlon'), true, `triathlon : ${sport}`);
  assert.equal(garderSeance({ sport: 'WeightTraining' }, 'triathlon'), false);
  assert.equal(garderSeance({ sport: 'Swim' }, 'duathlon'), false);
  for (const sport of ['Run', 'Ride', 'Duathlon']) assert.equal(garderSeance({ sport }, 'duathlon'), true, `duathlon : ${sport}`);
  assert.equal(garderSeance({ sport: 'Triathlon' }, 'duathlon'), false);
  // Les autres filtres ne changent pas : Course ne garde toujours que la course
  assert.equal(garderSeance({ sport: 'Ride' }, 'course'), false);
});

test('garderSeance : l\'onglet Autres garde le ski, l\'aviron, la rando, le tennis… et rien des sports proposés', () => {
  for (const sport of ['NordicSki', 'RollerSki', 'AlpineSki', 'Snowboard', 'Rowing', 'Hike', 'Boxing', 'RockClimbing', 'Kayaking', 'Athletics', 'Tennis']) {
    assert.equal(familleSport(sport), 'autre', sport);
    assert.equal(garderSeance({ sport }, 'autre'), true, sport);
  }
  for (const sport of ['Run', 'Ride', 'WeightTraining']) assert.equal(garderSeance({ sport }, 'autre'), false, sport);
  assert.equal(garderSeance({ sport: 'AlpineSki' }, 'tout'), true);
});

