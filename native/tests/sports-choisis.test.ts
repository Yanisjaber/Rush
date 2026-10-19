import assert from 'node:assert/strict';
import { test } from 'node:test';

test('basculerSport : ajoute, retire, mais jamais le dernier', async () => {
  const { basculerSport } = await import('../src/data/sports-choisis.ts');
  assert.deepEqual(basculerSport(['course'], 'velo'), ['course', 'velo']);
  assert.deepEqual(basculerSport(['course', 'velo'], 'course'), ['velo']);
  assert.equal(basculerSport(['course'], 'course'), null);
});
