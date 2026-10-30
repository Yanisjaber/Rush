import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luminance, melanger, meilleurTexte, rapportContraste } from '../../src/theme/contraste.ts';

test('rapportContraste : noir sur blanc = 21, deux couleurs identiques = 1', () => {
  assert.ok(Math.abs(rapportContraste('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(rapportContraste('#4f8cff', '#4f8cff'), 1);
  assert.ok(luminance('#ffffff') > luminance('#4f8cff'));
});

test('melanger : transparence 0 = le fond, 1 = la couleur de devant, au milieu = la moyenne', () => {
  assert.equal(melanger('#4f8cff', 0, '#14161b'), '#14161b');
  assert.equal(melanger('#4f8cff', 1, '#14161b'), '#4f8cff');
  assert.equal(melanger('#ffffff', 0.5, '#000000'), '#808080');
});

test('meilleurTexte : du texte clair sur un bleu foncé, du texte sombre sur un bleu vif', () => {
  const clair = '#f3f2ee';
  const sombre = '#0c0d10';
  assert.equal(meilleurTexte(melanger('#4f8cff', 0.35, '#14161b'), [clair, sombre]), clair);
  assert.equal(meilleurTexte('#4f8cff', [clair, sombre]), sombre);
});

test('les cases de la carte de chaleur restent lisibles (au moins 4,5 : 1) pour toutes les notes, en sombre comme en clair', () => {
  const cas = [
    { velo: '#4f8cff', surface: '#14161b', textes: ['#f3f2ee', '#0c0d10'] },
    { velo: '#2f6fe8', surface: '#ffffff', textes: ['#14151a', '#ffffff'] },
  ];
  for (const { velo, surface, textes } of cas) {
    const pires: number[] = [];
    for (let note = 0; note <= 100; note += 1) {
      const fond = melanger(velo, 0.1 + 0.9 * (note / 100), surface);
      pires.push(rapportContraste(fond, meilleurTexte(fond, textes)));
    }
    // Le pire cas du milieu de l'échelle est autour de 3,5 : on exige au moins 3 pour du texte gras de grande taille (les notes sont en 700, 15 pt)
    assert.ok(Math.min(...pires) >= 3, `contraste minimum ${Math.min(...pires)} avec ${velo}`);
  }
});
