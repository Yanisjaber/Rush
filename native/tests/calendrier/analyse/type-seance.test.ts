import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeDeSeance } from '../../../src/data/calendrier/analyse/type-seance.ts';

test('typeDeSeance : le nom d\'abord, la durée à défaut', () => {
  assert.equal(typeDeSeance('footing', 2100), 'footing');
  assert.equal(typeDeSeance('Footing facile', null), 'footing');
  assert.equal(typeDeSeance('EF avec elisa', 3600), 'footing');
  assert.equal(typeDeSeance('Fractionné 8 x 400', 3000), 'fractionne');
  assert.equal(typeDeSeance('VMA courte', 3000), 'fractionne');
  assert.equal(typeDeSeance('Ronde de Ramonville', 2800), 'autre');
  assert.equal(typeDeSeance('Course du 10 km', 2800), 'competition');
  assert.equal(typeDeSeance('Sortie longue', 6000), 'longue');
  assert.equal(typeDeSeance(null, 6000), 'longue');
  assert.equal(typeDeSeance('', 2000), 'autre');
});
