import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTACT, DATE_MAJ, SECTIONS } from '../../src/data/confidentialite.ts';

test('chaque section a un identifiant unique, un titre et du contenu', () => {
  const ids = SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SECTIONS) {
    assert.ok(s.titre.length > 0);
    assert.ok((s.paragraphes?.length ?? 0) + (s.puces?.length ?? 0) > 0, `section vide : ${s.id}`);
  }
});

test('une seule section est dépliée au départ : le Coach IA', () => {
  assert.deepEqual(SECTIONS.filter((s) => s.ouverte).map((s) => s.id), ['coach']);
});

test("aucun reste de brouillon n'est publié", () => {
  const tout = JSON.stringify(SECTIONS);
  assert.ok(!/À VÉRIFIER|À DÉCIDER|À CONFIRMER|TODO/i.test(tout));
});

test("la date de mise à jour et le contact sont renseignés", () => {
  assert.match(DATE_MAJ, /^\d{1,2} \p{L}+ \d{4}$/u);
  assert.match(CONTACT, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('le texte dit où partent les données du Coach IA et leur région', () => {
  const tout = JSON.stringify(SECTIONS);
  assert.ok(tout.includes('Anthropic'));
  assert.ok(tout.includes('Francfort'));
});
