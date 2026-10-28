import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deniveleSkiParSemaine, estSkiDeFond, kmSkiParSemaine, meilleuresSortiesSki, minutesParSemaineSurfaces, repartitionSurfaces, surfaceDe } from '../../src/data/sports/ski.ts';
import { intensiteParZone } from '../../src/data/sports/hebdo.ts';
import { prepaDistance } from '../../src/data/sports/natation.ts';
import type { Seance } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const sortie = (id: string, avant: number, sport: string, km: number, minutes: number, extra: Partial<Seance> = {}): Seance => ({
  id, name: id, sport, start_date_local: `${jour(avant)}T08:00:00`, moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});

test('estSkiDeFond / surfaceDe : neige, roulettes, hors-piste ; ni le ski alpin ni le snowboard', () => {
  assert.equal(surfaceDe({ sport: 'NordicSki' }), 'neige');
  assert.equal(surfaceDe({ sport: 'RollerSki' }), 'roulettes');
  assert.equal(surfaceDe({ sport: 'BackcountrySki' }), 'horspiste');
  for (const sport of ['AlpineSki', 'Snowboard', 'Run']) {
    assert.equal(surfaceDe({ sport }), null, sport);
    assert.equal(estSkiDeFond({ sport }), false, sport);
  }
  assert.equal(estSkiDeFond({ sport: 'RollerSki' }), true);
});

test('repartitionSurfaces : le temps et la distance par surface, sur 12 semaines', () => {
  const r = repartitionSurfaces([sortie('n', 2, 'NordicSki', 20, 90), sortie('r1', 5, 'RollerSki', 25, 60), sortie('r2', 9, 'RollerSki', 15, 30), sortie('h', 12, 'BackcountrySki', 10, 120), sortie('alpin', 3, 'AlpineSki', 30, 200), sortie('vieux', 120, 'NordicSki', 30, 150)], 12, AUJOURDHUI);
  assert.ok(r);
  assert.equal(r.total, 300 * 60); // 90 + 60 + 30 + 120 ; le ski alpin et la sortie de plus de 12 semaines sont écartés
  assert.deepEqual(r.parts.map((p) => [p.cle, p.pct, p.km]), [['neige', 30, 20], ['roulettes', 30, 40], ['horspiste', 40, 10]]);
  assert.equal(repartitionSurfaces([], 12, AUJOURDHUI), null);
});

test('minutesParSemaineSurfaces : une série par surface, de la plus ancienne semaine à la plus récente', () => {
  const s = minutesParSemaineSurfaces([sortie('n', 1, 'NordicSki', 10, 60), sortie('r', 9, 'RollerSki', 20, 90)], 3, AUJOURDHUI);
  assert.deepEqual(s.map((x) => [x.cle, x.minutes]), [['neige', [0, 0, 60]], ['roulettes', [0, 90, 0]], ['horspiste', [0, 0, 0]]]);
});

test('ski : les kilomètres et le dénivelé par semaine comptent le ski de fond et les roulettes, pas le ski alpin', () => {
  const seances = [sortie('n', 1, 'NordicSki', 20, 90, { total_elevation_gain: 300 }), sortie('r', 3, 'RollerSki', 15.5, 60, { total_elevation_gain: 200 }), sortie('a', 2, 'AlpineSki', 40, 120, { total_elevation_gain: 900 }), sortie('v', 9, 'NordicSki', 10, 45, { total_elevation_gain: 100 })];
  assert.deepEqual(kmSkiParSemaine(seances, 4, AUJOURDHUI).parSemaine, [0, 0, 10, 35.5]);
  assert.deepEqual(deniveleSkiParSemaine(seances, 4, AUJOURDHUI).parSemaine, [0, 0, 100, 500]);
});

test('ski : les meilleures sorties', () => {
  const m = meilleuresSortiesSki([sortie('a', 2, 'NordicSki', 30, 150, { total_elevation_gain: 400 }), sortie('b', 9, 'RollerSki', 45, 200, { total_elevation_gain: 900 }), sortie('alpin', 3, 'AlpineSki', 60, 300, { total_elevation_gain: 3000 })], 12, AUJOURDHUI);
  assert.equal(m.plusGrosDPlus?.id, 'b');
  assert.equal(m.plusLongue?.id, 'b');
  assert.deepEqual(m.top.map((s) => s.id), ['b', 'a']);
});

test('ski : la préparation à une course de ski de fond compare ta plus longue sortie à sa distance', () => {
  const objectifs = [{ name: 'La Transju', date: jour(-100).slice(0, 10), sport: 'NordicSki', km: 50 }, { name: 'Un 10 km', date: jour(-20).slice(0, 10), sport: 'Run', km: 10 }];
  const p = prepaDistance([sortie('a', 3, 'NordicSki', 30, 150), sortie('b', 10, 'RollerSki', 20, 100), sortie('alpin', 5, 'AlpineSki', 80, 200)], objectifs, estSkiDeFond, (o) => ['NordicSki', 'RollerSki', 'BackcountrySki'].includes(o.sport), AUJOURDHUI);
  assert.equal(p.cible?.nom, 'La Transju');
  assert.equal(p.plusLongue, 30); // le ski alpin n'entre pas dans la préparation
  assert.equal(p.pctDistance, 60);
  assert.equal(p.metres4Semaines, 50000);
});

test('ski : l\'intensité range le temps selon le cardio moyen, pour le ski seulement', () => {
  const r = intensiteParZone([sortie('a', 2, 'NordicSki', 20, 60, { avg_heartrate: 140 }), sortie('b', 4, 'RollerSki', 20, 60, { avg_heartrate: 170 }), sortie('alpin', 3, 'AlpineSki', 20, 60, { avg_heartrate: 190 })], 200, estSkiDeFond, 4, AUJOURDHUI);
  assert.ok(r);
  assert.deepEqual(r.zones.map((z) => z.temps / 60), [60, 0, 60]); // 140 bpm = 70 % (modérée), 170 bpm = 85 % (intense) ; le ski alpin est écarté
});
