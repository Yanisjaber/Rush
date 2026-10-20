import assert from 'node:assert/strict';
import { test } from 'node:test';

test('basculerSport : ajoute, retire, mais jamais le dernier', async () => {
  const { basculerSport } = await import('../src/data/sports-choisis.ts');
  assert.deepEqual(basculerSport(['course'], 'velo'), ['course', 'velo']);
  assert.deepEqual(basculerSport(['course', 'velo'], 'course'), ['velo']);
  assert.equal(basculerSport(['course'], 'course'), null);
});

test('sports sans page : jamais à cocher, jamais de pastille, même si les séances les révèlent', async () => {
  const { SPORTS_A_CHOISIR, SPORTS_SANS_PAGE, GROUPES_SPORTS, fusionnerFamilles, nettoyerSports } = await import('../src/data/sports-choisis.ts');
  assert.deepEqual(SPORTS_SANS_PAGE, ['rando', 'combat', 'escalade', 'aviron', 'pagaie', 'athletisme']);
  for (const s of SPORTS_SANS_PAGE) {
    assert.ok(!SPORTS_A_CHOISIR.includes(s), `${s} ne se coche plus`);
    assert.ok(!GROUPES_SPORTS.some((g) => g.sports.includes(s)), `${s} n'est dans aucun groupe`);
  }
  // Chaque sport proposé apparaît dans un seul groupe
  const proposes = GROUPES_SPORTS.flatMap((g) => g.sports);
  assert.deepEqual([...proposes].sort(), [...SPORTS_A_CHOISIR].sort());
  // Les séances de rando ou d'aviron ne créent pas de pastille ; un ancien choix enregistré est ignoré
  assert.deepEqual(fusionnerFamilles(['course', 'rando', 'aviron'], ['velo', 'combat']), ['velo', 'course']);
  assert.deepEqual(nettoyerSports(['course', 'escalade', 'pagaie', 'athletisme', 'muscu']), ['course', 'muscu']);
});
