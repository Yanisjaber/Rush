import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDGETS, existe, estPertinent, compositionAuto, normaliser, disponibles } from '../src/lib/widgets/registre.js';

test("existe : seuls les vrais widgets sont reconnus (pas les propriétés héritées d'un objet)", () => {
  assert.equal(existe('objectif'), true);
  for (const piege of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'inconnu', null, undefined, 42, {}]) {
    assert.equal(existe(piege), false, `devrait refuser : ${String(piege)}`);
  }
});

test("compositionAuto : l'objectif en premier, widgets universels présents, automatique", () => {
  const c = compositionAuto(['course', 'velo']);
  assert.equal(c.auto, true);
  assert.equal(c.widgets[0].id, 'objectif');
  assert.ok(c.widgets.some((w) => w.id === 'charge'));
  // tailles par défaut respectées
  for (const w of c.widgets) assert.equal(w.taille, WIDGETS[w.id].taille);
});

test('estPertinent : un widget « tous sports » est toujours pertinent', () => {
  assert.equal(estPertinent('charge', []), true);
  assert.equal(estPertinent('inconnu', ['course']), false);
});

test('normaliser : retire les identifiants inconnus, les doublons et corrige les tailles', () => {
  const n = normaliser({
    auto: false,
    widgets: [
      { id: 'charge', taille: 'xl' },
      { id: 'charge', taille: 's' }, // doublon
      { id: 'forme', taille: 'xl' }, // taille interdite pour ce widget → taille par défaut
      { id: 'constructor', taille: 'm' }, // faux identifiant
      { id: '__proto__' },
      { id: 'objectif', taille: 'l' },
      null,
      'texte',
    ],
  });
  assert.deepEqual(n.widgets, [
    { id: 'charge', taille: 'xl' },
    { id: 'forme', taille: WIDGETS.forme.taille },
    { id: 'objectif', taille: 'l' },
  ]);
  assert.equal(n.auto, false);
});

test('normaliser : une disposition inutilisable devient null', () => {
  assert.equal(normaliser(null), null);
  assert.equal(normaliser('x'), null);
  assert.equal(normaliser({ widgets: 'pas un tableau' }), null);
  assert.equal(normaliser({}), null);
});

test('normaliser : plafonne le nombre de widgets lus', () => {
  const beaucoup = Array.from({ length: 500 }, () => ({ id: 'charge' }));
  assert.equal(normaliser({ widgets: beaucoup }).widgets.length, 1); // doublons retirés
});

test('disponibles : exclut les widgets déjà présents', () => {
  const d = compositionAuto([]);
  assert.deepEqual(disponibles({ widgets: [] }, []).sort(), Object.keys(WIDGETS).sort());
  const restants = disponibles({ widgets: [{ id: 'charge', taille: 'l' }] }, []);
  assert.equal(restants.includes('charge'), false);
  assert.equal(disponibles(d, []).length, 0); // l'auto contient déjà tout
});
