import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ajouterA, retirerDe, taillerDans } from '../../src/data/accueil/disposition-edition.ts';
import { compositionAuto, disponibles, disponiblesOnglet, normaliser, composerOnglet, WIDGETS } from '../../src/data/accueil/registre.ts';

const base = [{ id: 'objectif', taille: 'm' }, { id: 'semaine', taille: 'l' }, { id: 'avenir', taille: 's' }] as ReturnType<typeof compositionAuto>;

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

test('disponiblesOnglet : Course reste ouvert (tout ce qui concerne la course), Muscu reste fermé', () => {
  const course = disponiblesOnglet([], 'course');
  assert.ok(course.includes('kmhebdo') && course.includes('objectif'));
  assert.equal(course.includes('tonnage'), false); // un widget de muscu n'est pas proposé sur Course
});

test('normaliser : la liste de l\'onglet Course enregistrée est gardée, nettoyée', () => {
  const d = normaliser({ v: 1, auto: true, widgets: [], onglets: { course: [{ id: 'kmhebdo', taille: 'm' }, { id: 'inconnu', taille: 's' }], velo: 'nimporte quoi' } });
  assert.deepEqual(d?.onglets, { course: [{ id: 'kmhebdo', taille: 'm' }] });
});

