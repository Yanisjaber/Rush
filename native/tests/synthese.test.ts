import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeSeance, prochainesPrevues } from '../src/data/synthese.ts';
import type { Prevue } from '../src/data/types.ts';

test('chargeSeance : le TSS enregistré est utilisé tel quel', () => {
  assert.equal(chargeSeance({ tss: 72, moving_time: 3600, avg_heartrate: 150 }), 72);
});

test('chargeSeance : sans TSS, estimation à partir de la durée (45 pts/h avec cardio, 35 sans)', () => {
  assert.equal(chargeSeance({ tss: null, moving_time: 3600, avg_heartrate: 150 }), 45);
  assert.equal(chargeSeance({ tss: null, moving_time: 3600, avg_heartrate: null }), 35);
  assert.equal(chargeSeance({ tss: 0, moving_time: 7200, avg_heartrate: null }), 70);
  assert.equal(chargeSeance({ tss: null, moving_time: 0, avg_heartrate: null }), 0);
});

const prevue = (id: string, date: string, category = 'entrainement'): Prevue => ({
  id, name: id, date, sport: 'Run', duration: 50, tss: null, category, km: null,
});
const aujourdhui = new Date(2026, 9, 19);

test('prochainesPrevues : aujourd\'hui compris, passé exclu, tri par date', () => {
  const liste = [prevue('c', '2026-10-25'), prevue('hier', '2026-10-18'), prevue('a', '2026-10-19'), prevue('b', '2026-10-21')];
  assert.deepEqual(prochainesPrevues(liste, aujourdhui, 10).map((p) => p.id), ['a', 'b', 'c']);
});

test('prochainesPrevues : les compétitions sont exclues (elles ont leur dossard)', () => {
  const liste = [prevue('course', '2026-12-13', 'competition'), prevue('seance', '2026-10-20')];
  assert.deepEqual(prochainesPrevues(liste, aujourdhui).map((p) => p.id), ['seance']);
});

test('prochainesPrevues : respecte la limite, tolère une liste absente', () => {
  const liste = [prevue('a', '2026-10-20'), prevue('b', '2026-10-21'), prevue('c', '2026-10-22')];
  assert.equal(prochainesPrevues(liste, aujourdhui, 2).length, 2);
  assert.deepEqual(prochainesPrevues(null, aujourdhui), []);
  assert.deepEqual(prochainesPrevues(undefined, aujourdhui), []);
});

test('prochainesPrevues : ne modifie pas la liste reçue', () => {
  const liste = [prevue('b', '2026-10-21'), prevue('a', '2026-10-20')];
  prochainesPrevues(liste, aujourdhui);
  assert.deepEqual(liste.map((p) => p.id), ['b', 'a']);
});
