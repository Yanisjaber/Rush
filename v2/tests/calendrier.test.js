import test from 'node:test';
import assert from 'node:assert/strict';
import { bornesGrille, decalerMois, grilleMois, titreMois } from '../src/lib/data/calendrier.js';

const AUJ = new Date(2026, 9, 12, 14, 0); // lundi 12 octobre 2026

test('bornesGrille : de lundi à dimanche, en débordant sur les mois voisins', () => {
  // Octobre 2026 : le 1er est un jeudi, le 31 est un samedi
  assert.deepEqual(bornesGrille(2026, 9), { debut: '2026-09-28', fin: '2026-11-01' });
  // Février 2027 : du lundi 1er au dimanche 28 (4 semaines pile)
  assert.deepEqual(bornesGrille(2027, 1), { debut: '2027-02-01', fin: '2027-02-28' });
});

test('decalerMois : passe les années', () => {
  assert.deepEqual(decalerMois(2026, 11, 1), { annee: 2027, mois: 0 });
  assert.deepEqual(decalerMois(2026, 0, -1), { annee: 2025, mois: 11 });
  assert.equal(titreMois(2026, 9), 'octobre 2026');
});

test('grilleMois : semaines complètes de 7 jours, aujourd\'hui marqué, jours hors mois repérés', () => {
  const g = grilleMois(2026, 9, {}, AUJ);
  assert.equal(g.titre, 'octobre 2026');
  assert.equal(g.semaines.length, 5);
  for (const s of g.semaines) assert.equal(s.length, 7);
  assert.equal(g.semaines[0][0].iso, '2026-09-28');
  assert.equal(g.semaines[0][0].dansMois, false);
  assert.equal(g.semaines[0][3].iso, '2026-10-01');
  assert.equal(g.semaines[0][3].dansMois, true);
  const aujourdhui = g.semaines.flat().filter((j) => j.aujourdhui);
  assert.equal(aujourdhui.length, 1);
  assert.equal(aujourdhui[0].iso, '2026-10-12');
  assert.equal(g.semaines[4][6].iso, '2026-11-01');
});

test('grilleMois : range séances, séances prévues et objectifs au bon jour', () => {
  const g = grilleMois(
    2026,
    9,
    {
      seances: [{ id: 'a', start_date_local: '2026-10-06T18:00:00+00:00' }],
      planifiees: [{ id: 'p', date: '2026-10-14' }],
      objectifs: [{ id: 'o', date: '2026-10-31' }],
    },
    AUJ,
  );
  const jour = (iso) => g.semaines.flat().find((j) => j.iso === iso);
  assert.equal(jour('2026-10-06').seances.length, 1);
  assert.equal(jour('2026-10-14').planifiees.length, 1);
  assert.equal(jour('2026-10-14').futur, true);
  assert.equal(jour('2026-10-31').objectifs.length, 1);
  assert.equal(jour('2026-10-07').seances.length, 0);
});

test('grilleMois : un mois qui tient en 6 semaines (mai 2026) n\'en dépasse jamais 6', () => {
  const g = grilleMois(2026, 4, {}, AUJ);
  assert.ok(g.semaines.length === 5 || g.semaines.length === 6);
  assert.equal(g.semaines.flat().length % 7, 0);
});
