import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deniveleParSemaine, equivalenceWattsFc, evolutionFtp, ftpReference, kmVeloParSemaine, repartitionPuissance, wattsACardioEgal } from '../src/data/sports/velo.ts';
import type { Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T08:00:00`;
};
const sortie = (id: string, avant: number, extra: Partial<Seance> = {}): Seance => ({
  id, name: null, sport: 'Ride', start_date_local: jour(avant), moving_time: 3600, distance_km: 30,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});

test('kmVeloParSemaine : seul le vélo compte', () => {
  const k = kmVeloParSemaine([sortie('a', 1, { distance_km: 40 }), sortie('b', 9, { distance_km: 25.5 }), sortie('c', 2, { sport: 'Run', distance_km: 10 })], 4, AUJOURDHUI);
  assert.deepEqual(k.parSemaine, [0, 0, 25.5, 40]);
  assert.equal(k.ecartPct, 57); // 40 km contre 25,5 km de moyenne
});

test('deniveleParSemaine : somme des mètres, une sortie sans dénivelé compte pour zéro', () => {
  const d = deniveleParSemaine([sortie('a', 1, { total_elevation_gain: 800 }), sortie('b', 2, { total_elevation_gain: 400 }), sortie('c', 3), sortie('d', 9, { total_elevation_gain: 600 })], 4, AUJOURDHUI);
  assert.deepEqual(d.parSemaine, [0, 0, 600, 1200]);
  assert.equal(d.derniere, 1200);
});

test('evolutionFtp : la dernière sortie de la semaine fait foi, une semaine sans sortie garde la FTP d\'avant', () => {
  const e = evolutionFtp([sortie('a', 22, { ftp_at_time: 240 }), sortie('b', 15, { ftp_at_time: 250 }), sortie('c', 14, { ftp_at_time: 252 }), sortie('d', 1, { ftp_at_time: 260 })], 4, AUJOURDHUI);
  assert.ok(e);
  assert.deepEqual(e.parSemaine, [240, 252, 252, 260]);
  assert.equal(e.actuelle, 260);
  assert.equal(e.evolutionPct, 8.3); // 240 → 260
  assert.equal(e.meilleure, 260);
});

test('evolutionFtp : une FTP qui ne bouge pas n\'a pas d\'évolution ; sans FTP, null', () => {
  assert.equal(evolutionFtp([sortie('a', 1, { ftp_at_time: 250 }), sortie('b', 8, { ftp_at_time: 250 })], 4, AUJOURDHUI)?.evolutionPct, null);
  assert.equal(evolutionFtp([sortie('a', 1)], 4, AUJOURDHUI), null);
});

test('repartitionPuissance : classée par puissance normalisée (sinon moyenne), selon la FTP', () => {
  // FTP 200 : 100 W = 50 % (Z1) ; 160 W = 80 % (Z3) ; NP 210 = 105 % (Z4), même si la moyenne dit 150
  const r = repartitionPuissance([sortie('a', 2, { avg_watts: 100 }), sortie('b', 4, { avg_watts: 160 }), sortie('c', 6, { avg_watts: 150, np: 210 })], 200, 4, AUJOURDHUI);
  assert.ok(r);
  assert.deepEqual(r.zones.map((z) => z.temps / 3600), [1, 0, 1, 1, 0, 0, 0]);
});

test('repartitionPuissance : sans FTP, sans puissance ou hors période, null', () => {
  assert.equal(repartitionPuissance([sortie('a', 1, { avg_watts: 150 })], null, 4, AUJOURDHUI), null);
  assert.equal(repartitionPuissance([sortie('a', 1)], 200, 4, AUJOURDHUI), null);
  assert.equal(repartitionPuissance([sortie('a', 40, { avg_watts: 150 })], 200, 4, AUJOURDHUI), null);
});

test('ftpReference : le profil d\'abord, sinon la sortie la plus récente', () => {
  assert.equal(ftpReference(255, [sortie('a', 1, { ftp_at_time: 240 })]), 255);
  assert.equal(ftpReference(null, [sortie('a', 9, { ftp_at_time: 240 }), sortie('b', 1, { ftp_at_time: 250 })]), 250);
  assert.equal(ftpReference(null, []), null);
});

const facile = (id: string, avant: number, watts: number, fc: number, minutes = 60): Seance => sortie(id, avant, { avg_watts: watts, avg_heartrate: fc, moving_time: minutes * 60 });

test('wattsACardioEgal : sorties faciles seulement, moyenne par semaine, évolution entre la première et la dernière', () => {
  const w = wattsACardioEgal(
    [facile('a', 15, 150, 130), facile('b', 8, 155, 132), facile('c', 1, 165, 131), facile('d', 2, 220, 175), facile('e', 3, 100, 120, 10)],
    190, 4, AUJOURDHUI,
  );
  // FC max 190 : « facile » = 114 à 152 bpm. La sortie à 175 bpm (trop dure) et celle de 10 min sont ignorées.
  assert.ok(w);
  assert.deepEqual(w.points.map((p) => p.watts), [150, 155, 165]);
  assert.equal(w.actuelle, 165);
  assert.equal(w.evolutionPct, 10);
});

test('wattsACardioEgal : moins de trois semaines, null', () => {
  assert.equal(wattsACardioEgal([facile('a', 1, 150, 130), facile('b', 8, 155, 132)], 190, 4, AUJOURDHUI), null);
});

test('equivalenceWattsFc : retrouve la droite, et la table reste dans la plage observée', () => {
  // watts = 2 × FC − 100, sans bruit : 120 bpm → 140 W, 150 bpm → 200 W
  const sorties = [120, 128, 135, 142, 150, 156].map((fc, i) => facile(`s${i}`, i + 1, 2 * fc - 100, fc));
  const e = equivalenceWattsFc(sorties, 12, AUJOURDHUI);
  assert.ok(e);
  assert.ok(Math.abs(e.pente - 2) < 1e-9 && Math.abs(e.ordonnee + 100) < 1e-9);
  assert.ok(e.r2 > 0.999);
  assert.deepEqual(e.table, [{ fc: 120, watts: 140 }, { fc: 130, watts: 160 }, { fc: 140, watts: 180 }, { fc: 150, watts: 200 }]);
});

test('equivalenceWattsFc : une plage étroite donne une équivalence tous les 5 bpm', () => {
  const sorties = [140, 144, 148, 152, 156, 158].map((fc, i) => facile(`e${i}`, i + 1, 2 * fc - 100, fc));
  assert.deepEqual(equivalenceWattsFc(sorties, 12, AUJOURDHUI)?.table.map((t) => t.fc), [140, 145, 150, 155]);
});

test('equivalenceWattsFc : trop peu de sorties, FC trop proches, ou relation qui descend : null', () => {
  assert.equal(equivalenceWattsFc([120, 130, 140].map((fc, i) => facile(`a${i}`, i + 1, fc, fc)), 12, AUJOURDHUI), null);
  assert.equal(equivalenceWattsFc([130, 131, 132, 133, 134, 135].map((fc, i) => facile(`b${i}`, i + 1, 150 + i, fc)), 12, AUJOURDHUI), null);
  assert.equal(equivalenceWattsFc([120, 130, 140, 150, 160, 170].map((fc, i) => facile(`c${i}`, i + 1, 300 - 5 * i, fc)), 12, AUJOURDHUI), null);
});
