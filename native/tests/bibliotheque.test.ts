import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliser, RAYONS, rangerBibliotheque } from '../src/data/bibliotheque.ts';
import { WIDGETS } from '../src/data/registre.ts';

const TOUS = Object.keys(WIDGETS);

test('normaliser : sans accents ni majuscules', () => {
  assert.equal(normaliser('  Vélo Épique '), 'velo epique');
});

test('rangerBibliotheque : sans recherche, tous les widgets, rangés par sport puis par thème', () => {
  const rayons = rangerBibliotheque(TOUS);
  assert.deepEqual(rayons.map((r) => r.categorie), [...RAYONS]);
  assert.equal(rayons.flatMap((r) => r.ids).length, TOUS.length);
  assert.ok(rayons.find((r) => r.categorie === 'Course à pied')!.ids.includes('kmhebdo'));
});

test('rangerBibliotheque : la recherche ignore accents et casse, et cherche dans le nom, la description et la catégorie', () => {
  assert.deepEqual(rangerBibliotheque(TOUS, 'VELO').map((r) => r.categorie), ['Vélo']);
  assert.ok(rangerBibliotheque(TOUS, 'kilometres').flatMap((r) => r.ids).includes('kmhebdo'));
  assert.equal(rangerBibliotheque(TOUS, 'zzzz').length, 0);
});

test('rangerBibliotheque : tous les mots doivent correspondre', () => {
  const ids = rangerBibliotheque(TOUS, 'course zones').flatMap((r) => r.ids);
  assert.deepEqual(ids, ['zonesallure']);
});

test('rangerBibliotheque : ne garde que les widgets demandés, ignore les inconnus', () => {
  const rayons = rangerBibliotheque(['kmhebdo', 'nimportequoi', 'tonnage']);
  assert.deepEqual(rayons, [{ categorie: 'Course à pied', ids: ['kmhebdo'] }, { categorie: 'Musculation', ids: ['tonnage'] }]);
});
