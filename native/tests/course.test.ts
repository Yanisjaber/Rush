import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmParSemaine, repartitionAllure } from '../src/data/course.ts';
import type { Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T08:00:00`;
};
const sortie = (id: string, avant: number, km: number, minutes: number, sport = 'Run'): Seance => ({
  id, name: null, sport, start_date_local: jour(avant), moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});

test('kmParSemaine : km par semaine glissante, seule la course compte', () => {
  const k = kmParSemaine([sortie('a', 1, 10, 55), sortie('b', 3, 5, 28), sortie('c', 9, 8, 45), sortie('d', 2, 40, 90, 'Ride')], 4, AUJOURDHUI);
  assert.deepEqual(k.parSemaine, [0, 0, 8, 15]);
  assert.equal(k.derniere, 15);
  assert.equal(k.ecartPct, 88); // 15 km contre 8 km de moyenne
});

test('kmParSemaine : sans sortie, des zéros et pas d\'écart', () => {
  const k = kmParSemaine([], 4, AUJOURDHUI);
  assert.deepEqual(k.parSemaine, [0, 0, 0, 0]);
  assert.equal(k.ecartPct, null);
});

test('repartitionAllure : chaque sortie va dans la zone de son allure moyenne', () => {
  // Vitesse seuil 15 km/h. 10 km en 60 min = 10 km/h = 67 % (Z1) ; 10 km en 44 min = 13,6 km/h = 91 % (Z3) ; 5 km en 20 min = 15 km/h = 100 % (Z4)
  const r = repartitionAllure([sortie('a', 2, 10, 60), sortie('b', 5, 10, 44), sortie('c', 8, 5, 20)], 15, 4, AUJOURDHUI);
  assert.ok(r);
  assert.equal(r.total, (60 + 44 + 20) * 60);
  assert.deepEqual(r.zones.map((z) => z.temps / 60), [60, 0, 44, 20, 0]);
  assert.equal(r.dominante, 0);
  const somme = r.zones.reduce((s, z) => s + z.pct, 0);
  assert.ok(somme >= 99 && somme <= 101, `somme des % : ${somme}`); // les arrondis peuvent faire 99
});

test('repartitionAllure : plus vite que la dernière zone reste dans la dernière ; hors période ignoré', () => {
  const r = repartitionAllure([sortie('a', 1, 5, 12), sortie('b', 40, 10, 60)], 15, 4, AUJOURDHUI); // 25 km/h = 167 %
  assert.ok(r);
  assert.deepEqual(r.zones.map((z) => z.temps / 60), [0, 0, 0, 0, 12]);
});

test('repartitionAllure : sans vitesse seuil ou sans sortie, null', () => {
  assert.equal(repartitionAllure([sortie('a', 1, 10, 55)], null, 4, AUJOURDHUI), null);
  assert.equal(repartitionAllure([sortie('a', 1, 10, 55)], 0, 4, AUJOURDHUI), null);
  assert.equal(repartitionAllure([], 15, 4, AUJOURDHUI), null);
});
