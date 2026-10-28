import assert from 'node:assert/strict';
import { test } from 'node:test';

test('basculerSport : ajoute, retire, mais jamais le dernier', async () => {
  const { basculerSport } = await import('../../src/data/sports/sports-choisis.ts');
  assert.deepEqual(basculerSport(['course'], 'velo'), ['course', 'velo']);
  assert.deepEqual(basculerSport(['course', 'velo'], 'course'), ['velo']);
  assert.equal(basculerSport(['course'], 'course'), null);
});

test('Autres : une seule case pour ski, rando, combat, aviron… ; un ancien choix enregistré devient « Autres »', async () => {
  const { SPORTS_A_CHOISIR, GROUPES_SPORTS, fusionnerFamilles, nettoyerSports } = await import('../../src/data/sports/sports-choisis.ts');
  for (const s of ['ski', 'rando', 'combat', 'escalade', 'aviron', 'pagaie', 'athletisme']) assert.ok(!SPORTS_A_CHOISIR.includes(s), `${s} ne se coche plus`);
  assert.ok(SPORTS_A_CHOISIR.includes('autre'));
  // Chaque sport proposé apparaît dans un seul groupe
  const proposes = GROUPES_SPORTS.flatMap((g) => g.sports);
  assert.deepEqual([...proposes].sort(), [...SPORTS_A_CHOISIR].sort());
  // Les séances de ces sports tombent dans la famille « autre » (voir familles.ts) ; les anciennes clés deviennent « autre », une seule fois
  assert.deepEqual(fusionnerFamilles(['course', 'autre'], ['velo']), ['velo', 'course', 'autre']);
  assert.deepEqual(nettoyerSports(['course', 'escalade', 'pagaie', 'athletisme', 'muscu']), ['course', 'autre', 'muscu']);
  assert.deepEqual(nettoyerSports(['ski']), ['autre']);
});
