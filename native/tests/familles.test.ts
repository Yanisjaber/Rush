import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familleAffichage, familleSport } from '../src/data/familles.ts';

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
