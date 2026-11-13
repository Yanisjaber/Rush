import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { fenetre, moisDuTrimestre, nomTrimestre, notesTrimestrielles, trimestreDe } from '../../src/data/bilan/niveau-trimestriel.ts';

const act = (iso: string, duree_min: number, extra: Partial<ActiviteBilan> = {}): ActiviteBilan => ({
  id: iso + duree_min + (extra.famille ?? ''),
  name: 'S',
  iso,
  sport: 'course',
  famille: 'course',
  duree_min,
  distance_km: 0,
  d_plus: 0,
  tss: 0,
  ...extra,
});
const maintenant = new Date(2026, 4, 15); // 15 mai 2026 = T2 2026

test('trimestreDe : trois mois du calendrier', () => {
  assert.equal(trimestreDe('2026-01-01'), '2026-T1');
  assert.equal(trimestreDe('2026-03-31'), '2026-T1');
  assert.equal(trimestreDe('2026-04-01'), '2026-T2');
  assert.equal(trimestreDe('2026-12-31'), '2026-T4');
});

test('la note combine heures, charge et records, le meilleur trimestre vaut 100', () => {
  // T1 : 10 h, 100 pts, et sa séance est la plus longue ET la plus chargée (2 records). T2 : 5 h, 50 pts.
  const [c] = notesTrimestrielles([act('2026-01-10', 600, { tss: 100 }), act('2026-04-10', 300, { tss: 50 })], maintenant);
  assert.equal(c.points[0].note, 100);
  assert.equal(c.points[0].records, 2);
  assert.equal(c.points[1].note, 33); // (50 % + 50 % + 0 %) / 3
  assert.equal(c.meilleur.trimestre, '2026-T1');
});

test('les séances des trois mois du même trimestre s\'additionnent', () => {
  const [c] = notesTrimestrielles([act('2026-01-10', 60, { tss: 40 }), act('2026-02-20', 60, { tss: 60 }), act('2026-03-25', 60, { tss: 10 }), act('2026-04-01', 60, { tss: 50 })], maintenant);
  assert.equal(c.points[0].heures, 3);
  assert.equal(c.points[0].charge, 110);
});

test('les records sont rattachés au trimestre où ils ont été posés, même s\'il est moins chargé', () => {
  const t1 = Array.from({ length: 20 }, (_, i) => act(`2026-01-${String(i + 1).padStart(2, '0')}`, 60, { tss: 10 }));
  const [c] = notesTrimestrielles([...t1, act('2026-04-05', 180, { tss: 20 })], maintenant);
  assert.equal(c.points.find((p) => p.trimestre === '2026-T2')?.records, 2); // la plus longue séance et la plus grosse charge
  assert.equal(c.points.find((p) => p.trimestre === '2026-T1')?.records, 0);
});

test('sans charge dans le sport, seuls les heures et les records comptent', () => {
  const [c] = notesTrimestrielles([act('2026-01-10', 600), act('2026-04-10', 300)], maintenant);
  assert.equal(c.points[0].note, 100);
  assert.equal(c.points[1].note, 25); // (50 % + 0 %) / 2
});

test('un trimestre sans séance vaut 0, sans trou, jusqu\'au trimestre en cours', () => {
  const [c] = notesTrimestrielles([act('2025-10-10', 600)], maintenant);
  assert.deepEqual(c.points.map((p) => p.trimestre), ['2025-T4', '2026-T1', '2026-T2']);
  assert.deepEqual(c.points.map((p) => p.note), [100, 0, 0]);
  assert.equal(c.points[2].enCours, true);
});

test('une courbe par sport, le plus pratiqué d\'abord, chacune avec son propre meilleur trimestre', () => {
  const g = notesTrimestrielles([act('2026-01-10', 600, { famille: 'velo' }), act('2026-01-12', 100), act('2026-04-10', 50)], maintenant);
  assert.deepEqual(g.map((c) => c.famille), ['velo', 'course']);
  assert.equal(g[1].meilleur.trimestre, '2026-T1');
});

test('une séance du futur ou sans durée ne compte pas', () => {
  assert.equal(notesTrimestrielles([act('2026-09-01', 600), act('2026-01-10', 0)], maintenant).length, 0);
});

test('à égalité, le premier trimestre en date est le meilleur', () => {
  const [c] = notesTrimestrielles([act('2026-01-10', 300), act('2026-04-10', 300)], maintenant);
  assert.equal(c.meilleur.trimestre, '2026-T1');
});

test('fenêtre : les 3 derniers trimestres gardent les notes de tout l\'historique', () => {
  const g = notesTrimestrielles([act('2024-06-10', 1200), act('2025-10-10', 300), act('2026-04-10', 600)], maintenant);
  const f = fenetre(g, 3, maintenant);
  assert.deepEqual(f.trimestres, ['2025-T4', '2026-T1', '2026-T2']);
  assert.deepEqual(f.courbes[0].points.map((p) => p.note), [13, 0, 25]); // 100 = T2 2024, hors fenêtre
  assert.equal(fenetre(g, null, maintenant).trimestres.length, 9); // de T2 2024 à T2 2026
});

test('« Autres » n\'a pas de courbe : ski, trek… n\'ont aucun rapport entre eux', () => {
  const g = notesTrimestrielles([act('2026-01-10', 600, { famille: 'autre' }), act('2026-01-12', 100)], maintenant);
  assert.deepEqual(g.map((c) => c.famille), ['course']);
});

test('noms', () => {
  assert.equal(nomTrimestre('2026-T1'), 'T1 2026');
  assert.equal(moisDuTrimestre('2026-T3'), 'juil. – sept.');
});
