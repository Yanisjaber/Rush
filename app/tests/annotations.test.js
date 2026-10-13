import test from 'node:test';
import assert from 'node:assert/strict';
import { joursDe, formulaireVide, formulaireDepuisMarquage, validerMarquage, versLigneNote, notesDuJour, TYPES_MARQUAGE } from '../src/lib/data/annotations.js';

test('joursDe : bornes incluses, passage de mois, plages invalides ou trop longues', () => {
  assert.deepEqual(joursDe('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(joursDe('2026-10-12', '2026-10-12'), ['2026-10-12']);
  assert.deepEqual(joursDe('2026-10-12', '2026-10-11'), []);
  assert.deepEqual(joursDe('2026-02-30', '2026-03-02'), []);
  assert.deepEqual(joursDe('2026-01-01', '2026-12-31'), []); // plus de 90 jours
  assert.equal(joursDe('2026-02-27', '2026-03-01').length, 3);
});

test('validerMarquage : note vide refusée, dates incohérentes, couleur invalide', () => {
  const base = formulaireVide('2026-10-12');
  assert.ok(validerMarquage(base).erreurs.texte);
  assert.ok(validerMarquage({ ...base, texte: 'ok', a: '2026-10-10' }).erreurs.a);
  assert.ok(validerMarquage({ ...base, texte: 'ok', couleur: 'rouge' }).erreurs.couleur);
  assert.ok(validerMarquage({ ...base, texte: 'x'.repeat(501) }).erreurs.texte);
  assert.ok(validerMarquage({ ...base, type: 'piratage', texte: 'ok' }).erreurs.type);
  assert.ok(validerMarquage({ ...base, texte: 'ok', a: '2027-12-31' }).erreurs.a);
});

test('validerMarquage : maladie sans texte accepté, repos sans couleur', () => {
  const m = validerMarquage({ ...formulaireVide('2026-10-12', 'maladie'), a: '2026-10-15' });
  assert.deepEqual(m.erreurs, {});
  assert.equal(m.valeurs.texte, null);
  const r = validerMarquage({ ...formulaireVide('2026-10-12', 'repos') });
  assert.equal(r.valeurs.couleur, null);
  assert.equal(r.valeurs.type, 'repos');
});

test('versLigneNote : colonnes de day_notes, jamais de user_id', () => {
  const l = versLigneNote(validerMarquage({ ...formulaireVide('2026-10-12', 'blessure'), texte: 'Genou', a: '2026-10-14' }).valeurs);
  assert.deepEqual(l, { type: 'blessure', text: 'Genou', color: '#fb923c', from_date: '2026-10-12', to_date: '2026-10-14' });
  assert.ok(!('user_id' in l));
});

test('formulaireDepuisMarquage : note existante, repos, couleur invalide remplacée', () => {
  const f = formulaireDepuisMarquage({ type: 'maladie', text: 'Grippe', color: '#f87171', from_date: '2026-10-01', to_date: '2026-10-04' });
  assert.deepEqual(f, { type: 'maladie', de: '2026-10-01', a: '2026-10-04', texte: 'Grippe', couleur: '#f87171' });
  assert.equal(formulaireDepuisMarquage({ type: 'repos', iso: '2026-10-09' }).de, '2026-10-09');
  assert.equal(formulaireDepuisMarquage({ type: 'texte', text: null, color: 'url(x)', from_date: '2026-10-01', to_date: '2026-10-01' }).couleur, '#60a5fa');
  assert.equal(formulaireDepuisMarquage({ type: 'inconnu', from_date: '2026-10-01' }).type, 'texte');
});

test('notesDuJour : une note de plusieurs jours apparaît chaque jour', () => {
  const notes = [{ id: 1, from_date: '2026-10-01', to_date: '2026-10-04' }, { id: 2, from_date: '2026-10-04', to_date: '2026-10-04' }];
  assert.deepEqual(notesDuJour(notes, '2026-10-03').map((n) => n.id), [1]);
  assert.deepEqual(notesDuJour(notes, '2026-10-04').map((n) => n.id), [1, 2]);
  assert.deepEqual(notesDuJour(notes, '2026-10-05'), []);
  assert.deepEqual(notesDuJour(null, '2026-10-05'), []);
  assert.equal(TYPES_MARQUAGE.length, 4);
});
