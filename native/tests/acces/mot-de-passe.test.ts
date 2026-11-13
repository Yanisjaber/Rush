import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluerMotDePasse } from '../../src/data/acces/mot-de-passe.ts';

test('un mot de passe vide : aucune règle, jauge vide', () => {
  const r = evaluerMotDePasse('', 'toi@exemple.fr');
  assert.equal(r.valide, false);
  assert.equal(r.force, 0);
  assert.ok(r.regles.every((x) => !x.ok));
});

test('trop court : la règle de longueur échoue', () => {
  const r = evaluerMotDePasse('abc12', 'toi@exemple.fr');
  assert.equal(r.regles.find((x) => x.id === 'longueur')?.ok, false);
  assert.equal(r.valide, false);
});

test('il faut une lettre ET un chiffre', () => {
  assert.equal(evaluerMotDePasse('abcdefghij', 'a@b.fr').regles.find((x) => x.id === 'lettre-chiffre')?.ok, false);
  assert.equal(evaluerMotDePasse('1234567890', 'a@b.fr').regles.find((x) => x.id === 'lettre-chiffre')?.ok, false);
  assert.equal(evaluerMotDePasse('abcdef1234', 'a@b.fr').regles.find((x) => x.id === 'lettre-chiffre')?.ok, true);
});

test("différent de l'e-mail : l'adresse entière ou sa partie avant le @ est refusée", () => {
  assert.equal(evaluerMotDePasse('yanis.jaber', 'Yanis.Jaber@exemple.fr').regles.find((x) => x.id === 'different-email')?.ok, false);
  assert.equal(evaluerMotDePasse('yanis.jaber@exemple.fr', 'yanis.jaber@exemple.fr').regles.find((x) => x.id === 'different-email')?.ok, false);
  assert.equal(evaluerMotDePasse('Course2026!', 'yanis.jaber@exemple.fr').regles.find((x) => x.id === 'different-email')?.ok, true);
});

test('valide : les trois règles sont vertes, la jauge est au moins à 3', () => {
  const r = evaluerMotDePasse('Course2026', 'toi@exemple.fr');
  assert.equal(r.valide, true);
  assert.ok(r.force >= 3);
});

test('très solide : long avec un symbole = jauge pleine', () => {
  assert.equal(evaluerMotDePasse('Marathon-Paris-2027!', 'toi@exemple.fr').force, 4);
});

test("tant que ce n'est pas valide, la jauge reste à 2 au plus", () => {
  const r = evaluerMotDePasse('abcdefgh', 'toi@exemple.fr'); // longueur ok, pas de chiffre
  assert.equal(r.valide, false);
  assert.ok(r.force <= 2);
});
