import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placerGrille, solitaires } from '../../src/data/accueil/grille.ts';

test('solitaires : un S entouré de widgets pleine largeur est seul', () => {
  assert.deepEqual(solitaires(['m', 's', 'm']), [false, true, false]);
});

test('solitaires : deux S voisins ne sont pas seuls, le troisième si', () => {
  assert.deepEqual(solitaires(['s', 's', 's']), [false, false, true]);
  assert.deepEqual(solitaires(['s', 's', 's', 's']), [false, false, false, false]);
});

test('solitaires : XS, M et L ne comptent pas, et une suite repart de zéro après eux', () => {
  assert.deepEqual(solitaires(['xs', 's', 'l', 's', 's', 'm', 's']), [false, true, false, false, false, false, true]);
  assert.deepEqual(solitaires([]), []);
});

test('placerGrille : deux S côte à côte, un widget pleine largeur dessous, un S seul centré', () => {
  const s = { taille: 's' as const, w: 100, h: 50 };
  const m = { taille: 'm' as const, w: 200, h: 80 };
  assert.deepEqual(placerGrille([s, s, m, s], 200), [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 130 },
  ]);
});

test('placerGrille : un S après un widget pleine largeur repart à gauche, trois S font une paire puis un seul', () => {
  const s = { taille: 's' as const, w: 100, h: 50 };
  const l = { taille: 'l' as const, w: 200, h: 120 };
  assert.deepEqual(placerGrille([l, s, s, s], 200), [
    { x: 0, y: 0 },
    { x: 0, y: 120 },
    { x: 100, y: 120 },
    { x: 50, y: 170 },
  ]);
  assert.deepEqual(placerGrille([], 200), []);
});
