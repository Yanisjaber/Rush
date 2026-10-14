import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLES, MUSCLES_PAR_GROUPE, MUSCLES_DES_EXERCICES, repartirSerie } from '../src/lib/data/muscles.js';
import { BIBLIOTHEQUE } from '../src/lib/data/exercices.js';

test('muscles : chaque exercice de la bibliothèque a ses muscles, tous connus', () => {
  for (const e of BIBLIOTHEQUE) {
    const m = MUSCLES_DES_EXERCICES[e.cle];
    assert.ok(m, `muscles manquants pour ${e.cle}`);
    for (const slug of [...m.p, ...m.s]) assert.ok(MUSCLES[slug], `muscle inconnu ${slug} dans ${e.cle}`);
  }
});

test('muscles : principal = 1, secondaire = 0,5', () => {
  const r = repartirSerie('developpe-couche', 'Développé couché', 'pectoraux');
  assert.deepEqual(r.find((x) => x.muscle === 'chest'), { muscle: 'chest', poids: 1 });
  assert.deepEqual(r.find((x) => x.muscle === 'triceps'), { muscle: 'triceps', poids: 0.5 });
});

test('muscles : un exercice inconnu est deviné d\'après son nom (anglais ou français)', () => {
  assert.equal(repartirSerie('hevy-seated-calf-raise', 'Seated Calf Raise', 'jambes')[0].muscle, 'calves');
  assert.equal(repartirSerie('hevy-x', 'Tirage poitrine', 'dos')[0].muscle, 'upper-back');
  assert.equal(repartirSerie('hevy-y', 'Hammer Curl (Dumbbell)', 'bras')[0].muscle, 'biceps');
});

test('muscles : sans indice, la série est partagée à parts égales dans son groupe (total = 1)', () => {
  const r = repartirSerie('perso-1', 'Truc inconnu', 'jambes');
  assert.equal(r.length, MUSCLES_PAR_GROUPE.jambes.length);
  assert.ok(Math.abs(r.reduce((t, x) => t + x.poids, 0) - 1) < 1e-9);
});
