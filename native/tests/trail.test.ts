import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cibleTrail, deniveleTrailParSemaine, kmEffort, kmEffortParSemaine, meilleuresTrail, prepaTrail } from '../src/data/trail.ts';
import type { Objectif, Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (delta: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const sortie = (id: string, avant: number, km: number, dPlus: number | null, minutes = 120, sport = 'TrailRun'): Seance => ({
  id, name: id, sport, start_date_local: `${jour(-avant)}T08:00:00`, moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: dPlus, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});
const objectif = (id: string, delta: number, extra: Partial<Objectif> = {}): Objectif => ({ id, name: id, date: jour(delta), sport: 'TrailRun', km: 30, d_plus: 1500, priority: 'A', duration: 300, category: 'competition', ...extra });

test('kmEffort : 1 km-effort = 1 km + 100 m de D+', () => {
  assert.equal(kmEffort(sortie('a', 1, 20, 1000)), 30);
  assert.equal(kmEffort(sortie('b', 1, 10, null)), 10);
});

test('deniveleTrailParSemaine : seul le trail compte, pas la course sur route', () => {
  const d = deniveleTrailParSemaine([sortie('a', 1, 20, 900), sortie('b', 3, 10, 300), sortie('c', 9, 15, 600), sortie('d', 2, 10, 200, 60, 'Run')], 4, AUJOURDHUI);
  assert.deepEqual(d.parSemaine, [0, 0, 600, 1200]);
  assert.equal(d.ecartPct, 100); // 1200 m contre 600 m de moyenne
});

test('kmEffortParSemaine : distance et dénivelé réunis', () => {
  const k = kmEffortParSemaine([sortie('a', 1, 20, 1000), sortie('b', 9, 10, 500)], 4, AUJOURDHUI);
  assert.deepEqual(k.parSemaine, [0, 0, 15, 30]);
});

test('meilleuresTrail : plus gros D+, plus longue distance, plus longue durée, et le top 5 des D+', () => {
  const m = meilleuresTrail([sortie('a', 2, 30, 800, 240), sortie('b', 9, 20, 1500, 200), sortie('c', 16, 12, 400, 100), sortie('vieux', 120, 50, 3000, 400)], 12, AUJOURDHUI);
  assert.equal(m.plusGrosDPlus?.id, 'b');
  assert.equal(m.plusLongue?.id, 'a');
  assert.equal(m.plusLongueDuree?.id, 'a');
  assert.deepEqual(m.top.map((s) => s.id), ['b', 'a', 'c']); // la sortie de plus de 12 semaines est écartée
  assert.equal(meilleuresTrail([], 12, AUJOURDHUI).plusGrosDPlus, null);
});

test('cibleTrail : la prochaine course à dénivelé, jamais une course passée, sans D+, ni une course sur route à petit dénivelé', () => {
  const c = cibleTrail([objectif('passee', -5), objectif('sansdplus', 10, { d_plus: null }), objectif('hyrox', 12, { sport: 'Hyrox' }), objectif('route', 5, { sport: 'Run', km: 10, d_plus: 42 }), objectif('lointaine', 90), objectif('proche', 40, { sport: 'Run', d_plus: 300 })], AUJOURDHUI);
  assert.equal(c?.nom, 'proche');
  assert.equal(c?.joursRestants, 40);
  assert.equal(cibleTrail([objectif('passee', -5)], AUJOURDHUI), null);
});

test('prepaTrail : ta plus grosse sortie face à la course visée, et ton D+ des 4 dernières semaines', () => {
  const p = prepaTrail([sortie('a', 2, 24, 900), sortie('b', 20, 30, 1200), sortie('c', 40, 18, 600), sortie('vieux', 120, 50, 3000)], [objectif('cible', 50, { km: 40, d_plus: 2000 })], AUJOURDHUI);
  assert.equal(p.cible?.nom, 'cible');
  assert.equal(p.meilleureDPlus, 1200); // la sortie de plus de 12 semaines ne compte pas
  assert.equal(p.meilleureDistance, 30);
  assert.equal(p.pctDPlus, 60);
  assert.equal(p.pctDistance, 75);
  assert.equal(p.dPlus4Semaines, 2100); // les sorties d'il y a 2 et 20 jours ; celle d'il y a 40 jours est trop ancienne
  assert.equal(p.dPlusParSemaine, 525);
});

test('prepaTrail : sans course visée, les pourcentages sont nuls mais les chiffres restent', () => {
  const p = prepaTrail([sortie('a', 2, 24, 900)], [], AUJOURDHUI);
  assert.equal(p.cible, null);
  assert.equal(p.pctDPlus, null);
  assert.equal(p.meilleureDPlus, 900);
});
