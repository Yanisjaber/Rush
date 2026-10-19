import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programmeDuJour, progressionParExercice, recordsParGroupe, resumeProgramme, seriesParGroupe, tonnage, tonnageParSemaine, tonnageSerie } from '../src/data/force.ts';
import type { ProgrammeForce, Seance, SerieForce } from '../src/data/types.ts';

const aujourdhui = new Date(2026, 9, 19);
const jourAvant = (n: number) => {
  const d = new Date(2026, 9, 19 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const serie = (n: number, exo: string, poids: number, reps: number, groupe = 'jambes', seance = 's'): SerieForce => ({
  id: `${n}-${exo}-${poids}-${reps}`, activity_id: seance, date: jourAvant(n), exercise_key: exo, exercise_name: exo.toUpperCase(),
  muscle_group: groupe, position: 0, set_no: 1, reps, weight_kg: poids,
});

test('tonnage : répétitions × charge, additionné', () => {
  assert.equal(tonnageSerie({ reps: 8, weight_kg: 100 }), 800);
  assert.equal(tonnageSerie({ reps: 10, weight_kg: 0 }), 0);
  assert.equal(tonnage([serie(1, 'squat', 100, 5), serie(1, 'squat', 100, 5)]), 1000);
});

test('tonnageParSemaine : fenêtres de 7 jours glissants, écart à la moyenne des semaines d\'avant', () => {
  const r = tonnageParSemaine(
    [serie(2, 'a', 100, 10), serie(9, 'a', 100, 5), serie(16, 'a', 100, 5), serie(100, 'a', 100, 99)],
    4, aujourdhui,
  );
  assert.deepEqual(r.parSemaine, [0, 500, 500, 1000]);
  assert.equal(r.derniere, 1000);
  assert.equal(r.moyenne, 500);
  assert.equal(r.ecartPct, 100);
});

test('tonnageParSemaine : sans semaine d\'avant, pas d\'écart', () => {
  assert.equal(tonnageParSemaine([serie(2, 'a', 100, 10)], 4, aujourdhui).ecartPct, null);
});

test('seriesParGroupe : compte les séries des 7 derniers jours, par groupe, dans l\'ordre habituel', () => {
  const r = seriesParGroupe([serie(1, 'a', 50, 8, 'dos'), serie(3, 'b', 50, 8, 'dos'), serie(2, 'c', 50, 8, 'bras'), serie(8, 'd', 50, 8, 'dos')], aujourdhui);
  assert.deepEqual(r.map((g) => g.groupe), ['pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'tronc']);
  assert.equal(r.find((g) => g.groupe === 'dos')?.series, 2);
  assert.equal(r.find((g) => g.groupe === 'bras')?.series, 1);
  assert.equal(r.find((g) => g.groupe === 'jambes')?.series, 0);
});

test('seriesParGroupe : un groupe inconnu ou une série sans répétition ne compte pas', () => {
  const r = seriesParGroupe([serie(1, 'a', 50, 8, 'constructor'), serie(1, 'b', 50, 0, 'dos')], aujourdhui);
  assert.ok(r.every((g) => g.series === 0));
});

test('progressionParExercice : record quand le dernier 1RM bat tous les précédents, avec l\'écart en kg', () => {
  const r = progressionParExercice([serie(14, 'squat', 100, 5), serie(7, 'squat', 105, 5), serie(0, 'squat', 110, 5)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].record, true);
  assert.equal(r[0].rm, 128.3); // 110 × (1 + 5/30)
  assert.equal(r[0].delta, 5.8); // 128,3 − 122,5 (105 × 1,1667)
  assert.equal(r[0].serie.length, 3);
});

test('progressionParExercice : pas de record si la dernière séance est plus faible ; première séance : pas de delta', () => {
  const baisse = progressionParExercice([serie(7, 'squat', 110, 5), serie(0, 'squat', 100, 5)]);
  assert.equal(baisse[0].record, false);
  assert.ok((baisse[0].delta ?? 0) < 0);
  const seule = progressionParExercice([serie(0, 'squat', 100, 5)]);
  assert.equal(seule[0].delta, null);
  assert.equal(seule[0].record, false);
});

test('progressionParExercice : les séries sans charge ou au-delà de 12 répétitions sont ignorées', () => {
  assert.deepEqual(progressionParExercice([serie(0, 'pompes', 0, 20), serie(0, 'squat', 100, 15)]), []);
});

test('recordsParGroupe : un exercice par groupe, le grand mouvement d\'abord, rangé dans l\'ordre habituel', () => {
  const r = recordsParGroupe(
    [serie(1, 'fentes', 40, 8, 'jambes'), serie(1, 'squat', 100, 5, 'jambes'), serie(1, 'developpe-couche', 80, 5, 'pectoraux'), serie(1, 'tractions', 10, 5, 'dos')],
    5,
  );
  assert.deepEqual(r.map((e) => e.cle), ['developpe-couche', 'tractions', 'squat']);
});

test('recordsParGroupe : avec peu de place, jambes et pectoraux en priorité', () => {
  const r = recordsParGroupe(
    [serie(1, 'squat', 100, 5, 'jambes'), serie(1, 'developpe-couche', 80, 5, 'pectoraux'), serie(1, 'tractions', 10, 5, 'dos'), serie(1, 'curl-barre', 30, 8, 'bras')],
    2,
  );
  assert.deepEqual(r.map((e) => e.groupe), ['pectoraux', 'jambes']);
});

const prog = (id: string, nom: string, created: string, series: number[]): ProgrammeForce => ({
  id, name: nom, created_at: created, notes: null,
  exercises: series.map((sets, i) => ({ key: `e${i}`, name: `E${i}`, group: 'dos', sets, reps: 8, weight: 50 })),
});

test('resumeProgramme : nombre d\'exercices, de séries et environ 3 minutes par série', () => {
  assert.deepEqual(resumeProgramme(prog('a', 'PUSH', '2026-01-01', [4, 3, 3])), { exercices: 3, series: 10, minutes: 30 });
  assert.deepEqual(resumeProgramme(null), { exercices: 0, series: 0, minutes: 0 });
});

const muscu = (nom: string, jours: number): Seance => ({
  id: nom + jours, name: nom, sport: 'WeightTraining', start_date_local: `${jourAvant(jours)}T18:00:00+00:00`, moving_time: 3600, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'entrainement',
});

test('programmeDuJour : enchaîne dans l\'ordre de création (PUSH, PULL, LEGS, PUSH…)', () => {
  const p = [prog('l', 'LEGS', '2026-01-03', [3]), prog('u', 'PUSH', '2026-01-01', [3]), prog('p', 'PULL', '2026-01-02', [3])];
  assert.equal(programmeDuJour(p, [])?.name, 'PUSH'); // sans historique : le premier
  assert.equal(programmeDuJour(p, [muscu('PUSH', 3)])?.name, 'PULL');
  assert.equal(programmeDuJour(p, [muscu('PUSH', 9), muscu('PULL', 5), muscu('LEGS', 1)])?.name, 'PUSH'); // on reboucle
  assert.equal(programmeDuJour([], [muscu('PUSH', 1)]), null);
});
