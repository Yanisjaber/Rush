import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  casesRegularite, chargeParSemaine, conditionHebdo, efficaciteCourse, joursActifs, meilleuresSortiesCourse, predictionsCourse, seancesForce,
} from '../src/data/bilan/synthese.ts';
import type { Metrique, Seance } from '../src/data/types.ts';

const aujourdhui = new Date(2026, 9, 19); // lundi 19 octobre 2026

const seance = (id: string, date: string, sport: string, minutes: number, extra: Partial<Seance> = {}): Seance => ({
  id, name: id, sport, start_date_local: `${date}T18:00:00+00:00`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'entrainement', ...extra,
});
const jourAvant = (n: number) => {
  const d = new Date(2026, 9, 19 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- charge par semaine ---------------------------------------------------

test('chargeParSemaine : la dernière colonne = les 7 derniers jours, étiquettes S-n puis Auj.', () => {
  const r = chargeParSemaine([seance('a', jourAvant(1), 'Run', 60, { tss: 50 }), seance('b', jourAvant(8), 'Run', 60, { tss: 30 })], 4, aujourdhui);
  assert.deepEqual(r.etiquettes, ['S-3', 'S-2', 'S-1', 'Auj.']);
  assert.deepEqual(r.series, [{ nom: 'course', valeurs: [0, 0, 30, 50], total: 80 }]);
});

test('chargeParSemaine : séries triées par charge totale, séances trop anciennes ignorées', () => {
  const r = chargeParSemaine(
    [seance('a', jourAvant(2), 'Run', 60, { tss: 10 }), seance('b', jourAvant(2), 'Ride', 60, { tss: 90 }), seance('vieille', jourAvant(100), 'Run', 60, { tss: 500 })],
    4, aujourdhui,
  );
  assert.deepEqual(r.series.map((s) => s.nom), ['velo', 'course']);
});

test('conditionHebdo : sans données, vide ; sinon une valeur par semaine (la dernière connue)', () => {
  assert.deepEqual(conditionHebdo([], 4, aujourdhui), []);
  const m = (iso: string, ctl: number): Metrique => ({ iso_date: iso, tss: 0, ctl, atl: 0, tsb: 0, duration_min: 0, activity_count: 0 });
  const r = conditionHebdo([m(jourAvant(30), 40), m(jourAvant(10), 45), m(jourAvant(0), 50)], 4, aujourdhui);
  assert.equal(r.length, 4);
  assert.equal(r.at(-1), 50);
});

// --- régularité -----------------------------------------------------------

test('casesRegularite : 7 rangées × N semaines, jours à venir marqués vides', () => {
  const cases = casesRegularite([seance('a', jourAvant(0), 'Run', 60, { tss: 50 })], 12, aujourdhui);
  assert.equal(cases.length, 84);
  // aujourd'hui = lundi (rangée 0), dernière colonne : séance de course d'intensité 2 (50 pts)
  assert.deepEqual(cases[0 * 12 + 11], { famille: 'course', intensite: 2, vide: false });
  // mardi de la semaine en cours : à venir
  assert.equal(cases[1 * 12 + 11].vide, true);
});

test('casesRegularite : le sport dominant du jour est celui de la plus grande charge ; intensité 1 à 3', () => {
  const j = jourAvant(7); // lundi précédent
  const cases = casesRegularite(
    [seance('a', j, 'Run', 30, { tss: 20 }), seance('b', j, 'Ride', 60, { tss: 70 })],
    12, aujourdhui,
  );
  assert.deepEqual(cases[0 * 12 + 10], { famille: 'velo', intensite: 3, vide: false }); // 90 pts au total
  const faible = casesRegularite([seance('c', j, 'Run', 30, { tss: 10 })], 12, aujourdhui);
  assert.equal(faible[0 * 12 + 10].intensite, 1);
});

test('joursActifs : compte les jours distincts', () => {
  const liste = [seance('a', jourAvant(1), 'Run', 30), seance('b', jourAvant(1), 'Ride', 30), seance('c', jourAvant(3), 'Run', 30)];
  assert.equal(joursActifs(liste, 12, aujourdhui), 2);
});

// --- course ---------------------------------------------------------------

test('predictionsCourse : formule de Riegel à partir d\'une sortie de 10 km', () => {
  const r = predictionsCourse([seance('a', jourAvant(5), 'Run', 50, { distance_km: 10 })], aujourdhui);
  assert.deepEqual(r.map((p) => p.cle), ['5k', '10k', 'semi']);
  assert.equal(r[0].secondes, Math.round(3000 * Math.pow(0.5, 1.06)));
  assert.equal(r[1].secondes, 3000);
  assert.equal(r[2].secondes, Math.round(3000 * Math.pow(21.0975 / 10, 1.06)));
});

test('predictionsCourse : sorties de moins de 5 km ou trop anciennes ignorées', () => {
  assert.deepEqual(predictionsCourse([seance('a', jourAvant(5), 'Run', 20, { distance_km: 4 })], aujourdhui), []);
  assert.deepEqual(predictionsCourse([seance('a', jourAvant(200), 'Run', 50, { distance_km: 10 })], aujourdhui), []);
  assert.deepEqual(predictionsCourse([seance('a', jourAvant(5), 'Ride', 50, { distance_km: 30 })], aujourdhui), []);
});

test('efficaciteCourse : au moins 3 semaines de sorties faciles, sinon null', () => {
  const facile = (id: string, n: number, allure: number) => seance(id, jourAvant(n), 'Run', (allure * 5) / 60, { distance_km: 5, avg_heartrate: 140 });
  assert.equal(efficaciteCourse([facile('a', 2, 300), facile('b', 9, 290)], 200, 12, aujourdhui), null);
  const r = efficaciteCourse([facile('a', 16, 300), facile('b', 9, 290), facile('c', 2, 280)], 200, 12, aujourdhui);
  assert.equal(r?.points.length, 3);
  assert.equal(r?.allureActuelle, 280);
  assert.equal(r?.amelioration, 6.7); // (300 − 280) / 300
});

test('efficaciteCourse : un cardio hors de 60–80 % de la FC max est ignoré', () => {
  const trop = (id: string, n: number) => seance(id, jourAvant(n), 'Run', 25, { distance_km: 5, avg_heartrate: 180 });
  assert.equal(efficaciteCourse([trop('a', 16), trop('b', 9), trop('c', 2)], 200, 12, aujourdhui), null);
});

test('meilleuresSortiesCourse : la plus longue, la plus rapide ≥ 5 km, la plus rapide ≥ 10 km', () => {
  const m = meilleuresSortiesCourse([
    seance('court', jourAvant(3), 'Run', 20, { distance_km: 4 }),
    seance('moyenne', jourAvant(5), 'Run', 25, { distance_km: 6 }), // 250 s/km
    seance('longue', jourAvant(8), 'Run', 60, { distance_km: 12 }), // 300 s/km
  ]);
  assert.equal(m.plusLongue?.id, 'longue');
  assert.equal(m.rapide5?.id, 'moyenne');
  assert.equal(m.rapide10?.id, 'longue');
});

test('meilleuresSortiesCourse : sans course, tout est null', () => {
  assert.deepEqual(meilleuresSortiesCourse([seance('v', jourAvant(1), 'Ride', 60, { distance_km: 30 })]), { plusLongue: null, rapide5: null, rapide10: null });
});

// --- force ----------------------------------------------------------------

test('seancesForce : série de semaines consécutives ; la semaine en cours encore vide ne la casse pas', () => {
  const muscu = (id: string, n: number) => seance(id, jourAvant(n), 'WeightTraining', 60);
  // une « semaine » est une fenêtre glissante de 7 jours (indice 0 = les 7 derniers jours) :
  // séances à 10, 17 et 24 jours = fenêtres 1, 2, 3 ; la fenêtre en cours (0 à 6 jours) est encore vide
  const r = seancesForce([muscu('a', 10), muscu('b', 17), muscu('c', 24)], 4, aujourdhui);
  assert.deepEqual(r.parSemaine, [1, 1, 1, 0]);
  assert.equal(r.serie, 3);
  assert.equal(r.total, 3);
  assert.equal(r.moyenne, 0.8);
});

test('seancesForce : une semaine vide au milieu casse la série', () => {
  const muscu = (id: string, n: number) => seance(id, jourAvant(n), 'WeightTraining', 60);
  const r = seancesForce([muscu('a', 1), muscu('b', 17)], 4, aujourdhui);
  assert.equal(r.serie, 1);
});

test('seancesForce : seule la muscu compte', () => {
  assert.equal(seancesForce([seance('a', jourAvant(1), 'Run', 60)], 4, aujourdhui).total, 0);
});
