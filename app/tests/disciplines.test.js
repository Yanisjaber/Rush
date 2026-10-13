import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCIPLINES, DISCIPLINES_ATHLE, nettoyerDisciplines, nomDiscipline } from '../src/lib/data/disciplines.js';

const toutes = DISCIPLINES_ATHLE.flatMap((g) => g.disciplines);

test('athlétisme : toutes les familles d\'épreuves sont là, sans doublon de clé, avec un nom lisible', () => {
  assert.deepEqual(
    DISCIPLINES_ATHLE.map((g) => g.titre),
    ['Sprint', 'Haies', 'Demi-fond', 'Fond', 'Route', 'Relais', 'Marche athlétique', 'Sauts', 'Lancers', 'Épreuves combinées'],
  );
  assert.equal(new Set(toutes.map((d) => d.cle)).size, toutes.length);
  assert.ok(toutes.every((d) => /^[a-z0-9-]+$/.test(d.cle) && d.nom.length > 1)); // clés sûres à stocker
  for (const cle of ['100m', 'steeple', 'marathon', 'hauteur', 'perche', 'poids', 'javelot', 'decathlon']) assert.ok(toutes.some((d) => d.cle === cle), cle);
  assert.ok(toutes.length >= 30);
  assert.ok(Object.hasOwn(DISCIPLINES, 'athletisme'));
});

test('nettoyerDisciplines : sports et clés connus seulement, dans l\'ordre de l\'écran, sans doublon', () => {
  assert.deepEqual(nettoyerDisciplines({ athletisme: ['marathon', '100m', '100m', 'inconnue', 3, null], natation: ['400m'], __proto__: { x: 1 } }), { athletisme: ['100m', 'marathon'] });
  assert.deepEqual(nettoyerDisciplines(null), {});
  assert.deepEqual(nettoyerDisciplines([]), {});
  assert.deepEqual(nettoyerDisciplines('athletisme'), {});
  assert.deepEqual(nettoyerDisciplines({ athletisme: 'pas une liste' }), {});
  assert.deepEqual(nettoyerDisciplines({ athletisme: [] }), {}); // rien de coché : rien d'enregistré
});

test('nettoyerDisciplines : les disciplines d\'un sport décoché disparaissent', () => {
  const brut = { athletisme: ['100m', 'hauteur'] };
  assert.deepEqual(nettoyerDisciplines(brut, ['course', 'athletisme']), { athletisme: ['100m', 'hauteur'] });
  assert.deepEqual(nettoyerDisciplines(brut, ['course']), {});
  assert.deepEqual(nettoyerDisciplines(brut, []), {});
});

test('nomDiscipline : nom lisible, ou la clé si inconnue', () => {
  assert.equal(nomDiscipline('athletisme', 'steeple'), '3 000 m steeple');
  assert.equal(nomDiscipline('athletisme', 'zzz'), 'zzz');
  assert.equal(nomDiscipline('natation', '400m'), '400m');
});
