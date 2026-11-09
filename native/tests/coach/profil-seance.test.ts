import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeBlocs } from '../../src/data/coach/profil-seance.ts';
import type { BlocStructure } from '../../src/data/coach/types.ts';

const seg = (min: number, int: number) => ({ min, int, intHi: null });
const blocs: BlocStructure[] = [
  { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'zone', work: seg(15, 60) },
  { type: 'interval', name: '6 × 3 min', reps: 3, metric: 'pace', unit: 'zone', work: seg(3, 106), rec: seg(2, 60) },
  { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'pace', unit: 'zone', work: seg(10, 60) },
];

test('sans structure (anciennes cartes) : aucune phrase', () => {
  assert.equal(resumeBlocs(undefined), '');
});
test('la phrase résume la séance', () => {
  assert.equal(resumeBlocs(blocs), "15 min d'échauffement · 3 × 3 min · 10 min de retour au calme");
});
