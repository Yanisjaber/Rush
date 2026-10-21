import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allureNatation, meilleuresNatation, volumeNatation } from '../src/data/natation.ts';
import { formatAllure100m } from '../src/data/format.ts';
import type { Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T08:00:00`;
};
const nage = (id: string, avant: number, km: number, minutes: number, sport = 'Swim'): Seance => ({
  id, name: null, sport, start_date_local: jour(avant), moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});

test('formatAllure100m : 102 s pour 100 m', () => {
  assert.equal(formatAllure100m(102), `1'42"/100 m`);
  assert.equal(formatAllure100m(65), `1'05"/100 m`);
});

test('volumeNatation : mètres par semaine glissante, seule la natation compte', () => {
  const v = volumeNatation([nage('a', 1, 2, 40), nage('b', 3, 1, 20), nage('c', 9, 1.5, 30), nage('d', 2, 10, 30, 'Run')], 4, AUJOURDHUI);
  assert.deepEqual(v.parSemaine, [0, 0, 1500, 3000]);
  assert.equal(v.derniere, 3000);
  assert.equal(v.ecartPct, 100); // 3000 m contre 1500 m de moyenne
});

test('volumeNatation : sans séance, des zéros et pas d\'écart', () => {
  const v = volumeNatation([], 4, AUJOURDHUI);
  assert.deepEqual(v.parSemaine, [0, 0, 0, 0]);
  assert.equal(v.ecartPct, null);
});

test('allureNatation : 4 semaines contre les 4 d\'avant, en secondes pour 100 m', () => {
  // 2 km en 40 min = 120 s/100 m (période actuelle) ; 1 km en 20 min = 120 s, puis 1 km en 18 min = 108 s (période précédente)
  const a = allureNatation([nage('a', 2, 2, 40), nage('b', 35, 1, 18)], AUJOURDHUI);
  assert.equal(a.actuelle, 120);
  assert.equal(a.precedente, 108);
  assert.equal(a.evolutionPct, 11.1); // 11,1 % plus lent
  assert.equal(a.parSemaine.length, 8);
});

test('allureNatation : une séance de moins de 300 m ne compte pas pour l\'allure', () => {
  const a = allureNatation([nage('a', 2, 0.2, 10)], AUJOURDHUI);
  assert.equal(a.actuelle, null);
  assert.equal(a.evolutionPct, null);
});

test('meilleuresNatation : la plus longue, et la plus rapide parmi les séances d\'au moins 500 m', () => {
  const m = meilleuresNatation([nage('a', 5, 2.5, 55), nage('b', 8, 1, 17), nage('c', 12, 0.3, 4)]);
  assert.equal(m.plusLongue?.id, 'a');
  assert.equal(m.plusRapide?.id, 'b'); // 102 s/100 m ; la séance c (80 s/100 m) fait moins de 500 m
  assert.equal(m.plusRapide?.allure, 102);
  assert.equal(meilleuresNatation([]).plusLongue, null);
});
