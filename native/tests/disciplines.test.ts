import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISCIPLINES, DISCIPLINES_ATHLE, disciplineValide, nettoyerDisciplines, nomDiscipline } from '../src/data/disciplines.ts';

test('toutes les disciplines ont une clé unique', () => {
  const cles = DISCIPLINES_ATHLE.flatMap((g) => g.disciplines.map((d) => d.cle));
  assert.equal(new Set(cles).size, cles.length);
  assert.ok(cles.length === 35);
});

test('nettoyerDisciplines : clés inconnues, doublons, sport décoché, formes invalides', () => {
  assert.deepEqual(nettoyerDisciplines({ athletisme: ['100m', '100m', 'nimporte', 42] }), { athletisme: ['100m'] });
  assert.deepEqual(nettoyerDisciplines({ athletisme: ['100m'] }, ['course']), {});
  assert.deepEqual(nettoyerDisciplines({ course: ['100m'] }), {});
  assert.deepEqual(nettoyerDisciplines(null), {});
  assert.deepEqual(nettoyerDisciplines([]), {});
  // ordre de l'écran, pas de la saisie
  assert.deepEqual(nettoyerDisciplines({ athletisme: ['hauteur', '100m'] }), { athletisme: ['100m', 'hauteur'] });
});

test('nomDiscipline et disciplineValide', () => {
  assert.equal(nomDiscipline('athletisme', 'semi'), 'Semi-marathon');
  assert.equal(nomDiscipline('athletisme', 'inconnue'), 'inconnue');
  assert.equal(nomDiscipline('course', 'x'), 'x');
  assert.ok(disciplineValide('athletisme', 'hauteur'));
  assert.ok(!disciplineValide('athletisme', '<img>'));
  assert.deepEqual(Object.keys(DISCIPLINES), ['athletisme']);
});
