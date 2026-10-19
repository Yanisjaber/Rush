import assert from 'node:assert/strict';
import { test } from 'node:test';

test('basculerSport : ajoute, retire, mais jamais le dernier', async () => {
  const { basculerSport } = await import('../src/data/sports-choisis.ts');
  assert.deepEqual(basculerSport(['course'], 'velo'), ['course', 'velo']);
  assert.deepEqual(basculerSport(['course', 'velo'], 'course'), ['velo']);
  assert.equal(basculerSport(['course'], 'course'), null);
});

test('sportsDeLaFamille : Trail et Course partagent la pastille Course', async () => {
  const { sportsDeLaFamille } = await import('../src/data/sports-choisis.ts');
  assert.deepEqual(sportsDeLaFamille('course', ['course', 'trail']), ['course', 'trail']);
  assert.deepEqual(sportsDeLaFamille('course', ['trail', 'velo']), ['trail']);
  assert.deepEqual(sportsDeLaFamille('velo', ['vtt']), ['vtt']);
  assert.deepEqual(sportsDeLaFamille('muscu', ['course']), ['muscu']);
  assert.deepEqual(sportsDeLaFamille('course', null), ['course']);
});
