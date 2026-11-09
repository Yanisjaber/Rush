import test from 'node:test';
import assert from 'node:assert/strict';
import { dureeProfil, profilSeance, resumeBlocs } from '../../src/data/coach/profil-seance.ts';
import type { BlocStructure } from '../../src/data/coach/types.ts';

const seg = (min: number, int: number) => ({ min, int, intHi: null });
const blocs: BlocStructure[] = [
  { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'zone', work: seg(15, 60) },
  { type: 'interval', name: '6 × 3 min', reps: 3, metric: 'pace', unit: 'zone', work: seg(3, 106), rec: seg(2, 60) },
  { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'pace', unit: 'zone', work: seg(10, 60) },
];

test('le niveau reste entre 0,2 et 1 : plus la zone est haute, plus la barre est haute', () => {
  const p = profilSeance([{ type: 'steady', name: 'x', reps: 1, metric: 'pace', unit: 'zone', work: seg(10, 10) }, { type: 'steady', name: 'x', reps: 1, metric: 'pace', unit: 'zone', work: seg(10, 300) }]);
  assert.equal(p[0].niveau, 0.2);
  assert.equal(p[1].niveau, 1);
});
test('les intervalles alternent travail et récupération, et la durée totale est celle de la séance', () => {
  const p = profilSeance(blocs);
  assert.equal(p.length, 1 + 3 * 2 + 1);
  assert.equal(dureeProfil(p), 15 + 3 * (3 + 2) + 10);
  assert.deepEqual(p.map((s) => s.effort), [false, true, false, true, false, true, false, false]);
});
test('sans structure (anciennes cartes) : aucun segment, aucune phrase', () => {
  assert.deepEqual(profilSeance(undefined), []);
  assert.equal(resumeBlocs(undefined), '');
});
test('la phrase résume la séance', () => {
  assert.equal(resumeBlocs(blocs), "15 min d'échauffement · 3 × 3 min · 10 min de retour au calme");
});
