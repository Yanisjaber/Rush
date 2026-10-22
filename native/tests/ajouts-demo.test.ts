import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterNoteDemo, modifierNoteDemo, notesDeLaDemo, poserReposDemo, reposDeLaDemo, retirerReposDemo, supprimerNoteDemo } from '../src/stores/ajouts.ts';
import type { Note } from '../src/data/types.ts';

const base: Note[] = [{ id: 'exemple', type: 'texte', text: 'Un mot', color: '#60a5fa', from_date: '2026-10-20', to_date: '2026-10-20' }];
const ligne = (texte: string) => ({ type: 'texte', text: texte, color: '#f87171', from_date: '2026-10-21', to_date: '2026-10-22' });

test('démo : une note ajoutée apparaît, puis se modifie et se supprime', () => {
  const n = ajouterNoteDemo(ligne('Neuve'));
  assert.deepEqual(notesDeLaDemo(base).map((x) => x.text), ['Un mot', 'Neuve']);
  modifierNoteDemo(n.id, ligne('Changée'));
  assert.deepEqual(notesDeLaDemo(base).map((x) => x.text), ['Un mot', 'Changée']);
  supprimerNoteDemo(n.id);
  assert.deepEqual(notesDeLaDemo(base).map((x) => x.text), ['Un mot']);
});

test('démo : une note de l\'exemple se modifie puis se supprime sans toucher à la base', () => {
  modifierNoteDemo('exemple', ligne('Retouchée'));
  assert.equal(notesDeLaDemo(base)[0].text, 'Retouchée');
  assert.equal(base[0].text, 'Un mot'); // le tableau d'origine n'a pas bougé
  supprimerNoteDemo('exemple');
  assert.equal(notesDeLaDemo(base).length, 0);
});

test('démo : on pose et on retire un jour de repos, y compris un jour de l\'exemple', () => {
  assert.deepEqual(reposDeLaDemo(['2026-10-18']), ['2026-10-18']);
  poserReposDemo('2026-10-25');
  poserReposDemo('2026-10-25'); // deux fois : un seul
  assert.deepEqual(reposDeLaDemo(['2026-10-18']), ['2026-10-18', '2026-10-25']);
  retirerReposDemo('2026-10-18');
  assert.deepEqual(reposDeLaDemo(['2026-10-18']), ['2026-10-25']);
  retirerReposDemo('2026-10-25');
  assert.deepEqual(reposDeLaDemo(['2026-10-18']), []);
  poserReposDemo('2026-10-18'); // remettre un jour retiré
  assert.deepEqual(reposDeLaDemo(['2026-10-18']), ['2026-10-18']);
});
