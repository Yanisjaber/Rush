import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cibleDenivele, deniveleParSemaineSport, kmParSemaineSport, meilleuresSorties, prepaDenivele } from '../src/data/trail.ts';
import { profilTerrain, terrainDe } from '../src/data/vtt.ts';
import type { Objectif, Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (delta: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const sortie = (id: string, avant: number, km: number, dPlus: number | null, sport = 'MountainBikeRide', minutes = 120): Seance => ({
  id, name: id, sport, start_date_local: `${jour(-avant)}T08:00:00`, moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: dPlus, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});
const objectif = (id: string, delta: number, extra: Partial<Objectif> = {}): Objectif => ({ id, name: id, date: jour(delta), sport: 'MountainBikeRide', km: 50, d_plus: 1500, priority: 'A', duration: 240, category: 'competition', ...extra });

test('VTT : le dénivelé par semaine ne compte que le VTT et le gravel, ni le vélo de route ni le trail', () => {
  const d = deniveleParSemaineSport([sortie('a', 1, 30, 600), sortie('b', 3, 20, 400, 'GravelRide'), sortie('c', 2, 80, 900, 'Ride'), sortie('d', 2, 10, 500, 'TrailRun'), sortie('e', 9, 25, 300)], 'vtt', 4, AUJOURDHUI);
  assert.deepEqual(d.parSemaine, [0, 0, 300, 1000]);
});

test('VTT : les kilomètres par semaine', () => {
  const k = kmParSemaineSport([sortie('a', 1, 30.5, 600), sortie('b', 9, 25, 300), sortie('c', 2, 80, 900, 'Ride')], 'vtt', 4, AUJOURDHUI);
  assert.deepEqual(k.parSemaine, [0, 0, 25, 30.5]);
  // Le trail garde ses propres sorties : le même appel pour le trail ne voit pas le VTT
  assert.deepEqual(kmParSemaineSport([sortie('a', 1, 30.5, 600)], 'trail', 4, AUJOURDHUI).parSemaine, [0, 0, 0, 0]);
});

test('VTT : la cible est une course de VTT avec du dénivelé, jamais une course de route ni de trail', () => {
  const c = cibleDenivele([objectif('route', 5, { sport: 'Ride' }), objectif('trail', 8, { sport: 'TrailRun' }), objectif('sansdplus', 10, { d_plus: null }), objectif('passee', -3), objectif('gravel', 30, { sport: 'GravelRide' }), objectif('vtt', 60)], 'vtt', AUJOURDHUI);
  assert.equal(c?.nom, 'gravel');
  assert.equal(c?.joursRestants, 30);
  assert.equal(cibleDenivele([objectif('route', 5, { sport: 'Ride' })], 'vtt', AUJOURDHUI), null);
});

test('VTT : la préparation compare ta plus grosse sortie à la cible, et ne mélange pas avec le trail', () => {
  const p = prepaDenivele([sortie('a', 2, 40, 900), sortie('b', 20, 55, 1200), sortie('t', 3, 20, 2000, 'TrailRun')], [objectif('cible', 40, { km: 60, d_plus: 2000 })], 'vtt', AUJOURDHUI);
  assert.equal(p.meilleureDPlus, 1200);
  assert.equal(p.pctDPlus, 60);
  assert.equal(p.pctDistance, 92); // 55 km sur 60
  assert.equal(p.dPlus4Semaines, 2100);
});

test('VTT : les meilleures sorties', () => {
  const m = meilleuresSorties([sortie('a', 2, 30, 800, 'MountainBikeRide', 150), sortie('b', 9, 55, 1500, 'GravelRide', 240), sortie('t', 3, 40, 3000, 'TrailRun')], 'vtt', 12, AUJOURDHUI);
  assert.equal(m.plusGrosDPlus?.id, 'b');
  assert.equal(m.plusLongue?.id, 'b');
  assert.deepEqual(m.top.map((s) => s.id), ['b', 'a']);
});

test('terrainDe : roulant sous 15 m/km, vallonné jusqu\'à 30, montagneux au-delà', () => {
  assert.equal(terrainDe(8), 'roulant');
  assert.equal(terrainDe(15), 'vallonne');
  assert.equal(terrainDe(29.9), 'vallonne');
  assert.equal(terrainDe(30), 'montagneux');
});

test('profilTerrain : le dénivelé par kilomètre de chaque sortie, du plus récent au plus ancien, et la moyenne pondérée', () => {
  const p = profilTerrain([sortie('plat', 9, 40, 200), sortie('mont', 2, 30, 1200), sortie('vallon', 5, 20, 400)], 12, AUJOURDHUI);
  assert.deepEqual(p.sorties.map((s) => [s.id, s.ratio, s.terrain]), [['mont', 40, 'montagneux'], ['vallon', 20, 'vallonne'], ['plat', 5, 'roulant']]);
  assert.equal(p.moyenne, 20); // 1800 m sur 90 km
  assert.equal(p.terrain, 'vallonne');
  assert.deepEqual(p.comptes, { roulant: 1, vallonne: 1, montagneux: 1 });
});

test('profilTerrain : ignore les sorties de moins de 3 km, sans dénivelé connu, hors période ou d\'un autre sport ; un D+ de zéro compte', () => {
  const p = profilTerrain([sortie('court', 1, 2, 100), sortie('inconnu', 2, 20, null), sortie('vieux', 120, 30, 900), sortie('route', 3, 40, 500, 'Ride'), sortie('zero', 4, 25, 0)], 12, AUJOURDHUI);
  assert.deepEqual(p.sorties.map((s) => s.id), ['zero']);
  assert.equal(p.moyenne, 0);
  assert.equal(p.terrain, 'roulant');
  const vide = profilTerrain([], 12, AUJOURDHUI);
  assert.equal(vide.moyenne, null);
  assert.equal(vide.terrain, null);
});
