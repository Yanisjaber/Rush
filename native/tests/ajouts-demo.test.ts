import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterSortieDemo, seanceDeLaDemo, ajouterNoteDemo, ajouterPrevueDemo, modifierNoteDemo, modifierPrevueDemo, notesDeLaDemo, poserReposDemo, prevueCompleteDemo, prevuesDeLaDemo, reposDeLaDemo, retirerReposDemo, supprimerNoteDemo, supprimerPrevueDemo } from '../src/stores/ajouts.ts';
import { validerSeance, formulaireSeanceVide } from '../src/data/ajouts.ts';
import type { Note, Prevue, Seance } from '../src/data/types.ts';

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

const prevueExemple: Prevue = { id: 'prevue-exemple', name: 'Sortie longue', date: '2026-10-24', sport: 'Ride', duration: 120, tss: 90, category: 'entrainement', km: 55 };
const ligneSeance = (nom: string, notes = '') => {
  const r = validerSeance({ ...formulaireSeanceVide(), nom, type: 'Run', duree: '45', notes }, '2026-10-26', 'Course à pied');
  if (!r.ok) throw new Error(r.erreur);
  return r.ligne;
};

test('démo : une séance prévue ajoutée se relit en entier, puis se modifie et se supprime', () => {
  const p = ajouterPrevueDemo(ligneSeance('Footing', 'Facile'));
  assert.equal(prevueCompleteDemo(p.id, [prevueExemple])?.notes, 'Facile'); // les notes, que le calendrier ne montre pas, sont gardées
  modifierPrevueDemo(p.id, ligneSeance('Footing long', 'Plus long'));
  assert.deepEqual(prevuesDeLaDemo([prevueExemple]).map((x) => x.name), ['Sortie longue', 'Footing long']);
  assert.equal(prevueCompleteDemo(p.id, [prevueExemple])?.notes, 'Plus long');
  supprimerPrevueDemo(p.id);
  assert.deepEqual(prevuesDeLaDemo([prevueExemple]).map((x) => x.name), ['Sortie longue']);
  assert.equal(prevueCompleteDemo(p.id, [prevueExemple]), null);
});

test('démo : une séance prévue de l\'exemple se relit, se modifie puis se supprime sans toucher au tableau d\'origine', () => {
  assert.equal(prevueCompleteDemo('prevue-exemple', [prevueExemple])?.km, 55);
  modifierPrevueDemo('prevue-exemple', ligneSeance('Retouchée'));
  assert.equal(prevuesDeLaDemo([prevueExemple])[0].name, 'Retouchée');
  assert.equal(prevueExemple.name, 'Sortie longue');
  supprimerPrevueDemo('prevue-exemple');
  assert.equal(prevuesDeLaDemo([prevueExemple]).length, 0);
  assert.equal(prevueCompleteDemo('prevue-exemple', [prevueExemple]), null);
});

test('démo : une activité saisie pendant la démo se retrouve par son identifiant (fiche de la séance)', () => {
  const exemple = [{ id: 'ex1', name: 'Sortie exemple', sport: 'Run', start_date_local: '2026-10-20T08:00:00', moving_time: 1800 }] as Seance[];
  const ajoutee = ajouterSortieDemo({ source: 'manual', category: 'entrainement', name: 'Ma sortie', start_date_local: '2026-10-21T07:30:00', sport: 'Run', moving_time: 2700, tss: 40, rpe: null, distance_km: 7, total_elevation_gain: null, avg_heartrate: null, user_notes: null });
  assert.equal(seanceDeLaDemo(ajoutee.id, exemple)?.name, 'Ma sortie');
  assert.equal(seanceDeLaDemo('ex1', exemple)?.name, 'Sortie exemple');
  assert.equal(seanceDeLaDemo('inconnue', exemple), null);
});
