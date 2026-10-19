import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ajouterA, deplacerDans, retirerDe, taillerDans } from '../src/data/disposition-edition.ts';
import { compositionAuto, disponibles, disponiblesOnglet, normaliser, composerOnglet, WIDGETS } from '../src/data/registre.ts';

const base = [{ id: 'objectif', taille: 'm' }, { id: 'semaine', taille: 'l' }, { id: 'avenir', taille: 's' }] as ReturnType<typeof compositionAuto>;

test('deplacerDans : monte, descend, ne sort jamais des limites, ne modifie pas l\'original', () => {
  assert.deepEqual(deplacerDans(base, 1, -1).map((w) => w.id), ['semaine', 'objectif', 'avenir']);
  assert.deepEqual(deplacerDans(base, 1, 1).map((w) => w.id), ['objectif', 'avenir', 'semaine']);
  assert.equal(deplacerDans(base, 0, -1), base);
  assert.equal(deplacerDans(base, 2, 1), base);
  assert.equal(deplacerDans(base, 9, 1), base);
  assert.deepEqual(base.map((w) => w.id), ['objectif', 'semaine', 'avenir']);
});

test('retirerDe, ajouterA : doublon et inconnu ignorés, taille par défaut', () => {
  assert.deepEqual(retirerDe(base, 'semaine').map((w) => w.id), ['objectif', 'avenir']);
  assert.equal(ajouterA(base, 'semaine'), base);
  assert.equal(ajouterA(base, 'inconnu'), base);
  assert.equal(ajouterA(base, 'constructor'), base);
  const plus = ajouterA(base, 'tonnage');
  assert.equal(plus.length, 4);
  assert.equal(plus[3].taille, WIDGETS.tonnage.taille);
});

test('taillerDans : taille valide seulement', () => {
  const t = taillerDans(base, 'objectif', WIDGETS.objectif.tailles[0]);
  assert.equal(t.find((w) => w.id === 'objectif')?.taille, WIDGETS.objectif.tailles[0]);
  assert.equal(taillerDans(base, 'objectif', 'zz' as never), base);
  assert.equal(taillerDans(base, 'inconnu', 's'), base);
});

test('normaliser : une disposition abîmée est nettoyée, une inutilisable donne null', () => {
  assert.equal(normaliser(null), null);
  assert.equal(normaliser({ widgets: 'x' }), null);
  const n = normaliser({ auto: false, widgets: [{ id: 'objectif', taille: 'zz' }, { id: 'objectif' }, { id: 'bidon' }] });
  assert.deepEqual(n?.widgets, [{ id: 'objectif', taille: WIDGETS.objectif.taille }]);
});

test('disponibles : ce qui n\'est pas déjà dans la liste ; Muscu reste fermé sur ses widgets', () => {
  const auto = compositionAuto(['course']);
  const dispo = disponibles({ widgets: auto }, ['course']);
  assert.ok(dispo.every((id) => !auto.some((w) => w.id === id)));
  assert.ok(disponiblesOnglet([], 'muscu').length > 0);
  assert.ok(disponiblesOnglet([], 'muscu').every((id) => id in WIDGETS));
});

test('composerOnglet : la composition personnalisée de Muscu l\'emporte', () => {
  const perso = { muscu: [{ id: 'tonnage', taille: 's' as const }] };
  assert.deepEqual(composerOnglet(compositionAuto(['muscu']), 'muscu', perso).map((w) => w.id), ['tonnage']);
});
