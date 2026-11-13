import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { fenetre, nomMois, notesMensuelles } from '../../src/data/bilan/niveau-mensuel.ts';

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
const maintenant = new Date(2026, 4, 15); // 15 mai 2026

test('la note combine heures, charge et records, le meilleur mois vaut 100', () => {
  // Janvier : 10 h, 100 pts, et sa séance est la plus longue ET la plus chargée (2 records). Février : 5 h, 50 pts.
  const [c] = notesMensuelles([act('2026-01-10', 600, { tss: 100 }), act('2026-02-10', 300, { tss: 50 })], maintenant);
  assert.equal(c.points[0].note, 100);
  assert.equal(c.points[0].records, 2);
  // février : (50 % + 50 % + 0 %) / 3 = 33 % de la note de janvier (100 %)
  assert.equal(c.points[1].note, 33);
  assert.equal(c.meilleur.mois, '2026-01');
});

test('les records sont rattachés au mois où ils ont été posés, même si ce mois est moins chargé', () => {
  // Février : 20 h en 20 petites séances. Mars : une seule grosse séance de 3 h = la plus longue et la plus chargée (2 records), 3 h seulement.
  const fevrier = Array.from({ length: 20 }, (_, i) => act(`2026-02-${String(i + 1).padStart(2, '0')}`, 60, { tss: 10 }));
  const [c] = notesMensuelles([...fevrier, act('2026-03-05', 180, { tss: 20 })], maintenant);
  const mars = c.points.find((p) => p.mois === '2026-03');
  assert.equal(mars?.records, 2); // la plus longue séance et la plus grosse charge
  assert.equal(c.points.find((p) => p.mois === '2026-02')?.records, 0);
});

test('sans charge dans le sport, seuls les heures et les records comptent', () => {
  const [c] = notesMensuelles([act('2026-01-10', 600), act('2026-02-10', 300)], maintenant);
  // janvier : (100 % + 100 %) / 2 ; février : (50 % + 0 %) / 2 = 25 %
  assert.equal(c.points[0].note, 100);
  assert.equal(c.points[1].note, 25);
});

test('un mois sans séance vaut 0, sans trou dans la courbe, jusqu\'au mois en cours', () => {
  const [c] = notesMensuelles([act('2026-01-10', 600)], maintenant);
  assert.deepEqual(c.points.map((p) => p.mois), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
  assert.deepEqual(c.points.map((p) => p.note), [100, 0, 0, 0, 0]);
  assert.equal(c.points[4].enCours, true);
});

test('les séances du même mois s\'additionnent (heures et charge)', () => {
  const [c] = notesMensuelles([act('2026-03-01', 60, { tss: 40 }), act('2026-03-20', 60, { tss: 60 }), act('2026-04-01', 60, { tss: 50 })], maintenant);
  assert.equal(c.points[0].heures, 2);
  assert.equal(c.points[0].charge, 100);
});

test('une courbe par sport, le plus pratiqué d\'abord, chacune avec son propre meilleur mois', () => {
  const g = notesMensuelles([act('2026-01-10', 600, { famille: 'velo' }), act('2026-02-10', 100), act('2026-03-10', 50)], maintenant);
  assert.deepEqual(g.map((c) => c.famille), ['velo', 'course']);
  assert.equal(g[1].meilleur.mois, '2026-02');
});

test('une séance du futur ou sans durée ne compte pas', () => {
  assert.equal(notesMensuelles([act('2026-09-01', 600), act('2026-01-10', 0)], maintenant).length, 0);
});

test('à égalité, le premier mois en date est le meilleur', () => {
  const [c] = notesMensuelles([act('2026-01-10', 300), act('2026-02-10', 300)], maintenant);
  assert.equal(c.meilleur.mois, '2026-01');
});

test('fenêtre : les 3 derniers mois gardent les notes de tout l\'historique', () => {
  const g = notesMensuelles([act('2025-06-10', 1200), act('2026-04-10', 300), act('2026-05-10', 600)], maintenant);
  const f = fenetre(g, 3, maintenant);
  assert.deepEqual(f.mois, ['2026-03', '2026-04', '2026-05']);
  assert.deepEqual(f.courbes[0].points.map((p) => p.note), [0, 13, 25]); // 100 = juin 2025, hors fenêtre
  assert.equal(fenetre(g, null, maintenant).mois.length, 12);
});

test('nomMois', () => {
  assert.equal(nomMois('2026-03'), 'Mars 2026');
});
