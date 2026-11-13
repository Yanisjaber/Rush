import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { fenetre, nomMois, notesMensuelles } from '../../src/data/bilan/niveau-mensuel.ts';

const act = (iso: string, duree_min: number, famille = 'course'): ActiviteBilan => ({ id: iso + duree_min + famille, name: 'S', iso, sport: 'course', famille, duree_min, distance_km: 0, d_plus: 0, tss: 0 });
const maintenant = new Date(2026, 4, 15); // 15 mai 2026

test('la note vaut 100 pour le meilleur mois, les autres sont un pourcentage de ses heures', () => {
  const [c] = notesMensuelles([act('2026-01-10', 600), act('2026-02-10', 300), act('2026-03-10', 150)], maintenant);
  assert.equal(c.points[0].note, 100); // 10 h
  assert.equal(c.points[1].note, 50); // 5 h
  assert.equal(c.points[2].note, 25); // 2,5 h
  assert.equal(c.meilleur.mois, '2026-01');
});

test('un mois sans séance vaut 0, sans trou dans la courbe, jusqu\'au mois en cours', () => {
  const [c] = notesMensuelles([act('2026-01-10', 600)], maintenant);
  assert.deepEqual(c.points.map((p) => p.mois), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
  assert.deepEqual(c.points.map((p) => p.note), [100, 0, 0, 0, 0]);
  assert.equal(c.points[4].enCours, true);
});

test('les séances de plusieurs jours du même mois s\'additionnent', () => {
  const [c] = notesMensuelles([act('2026-03-01', 60), act('2026-03-20', 60), act('2026-04-01', 60)], maintenant);
  assert.equal(c.points[0].heures, 2);
  assert.equal(c.points[0].note, 100);
  assert.equal(c.points[1].note, 50);
});

test('une courbe par sport, le plus pratiqué d\'abord, chacune avec son propre meilleur mois', () => {
  const g = notesMensuelles([act('2026-01-10', 600, 'velo'), act('2026-02-10', 100, 'course'), act('2026-03-10', 50, 'course')], maintenant);
  assert.deepEqual(g.map((c) => c.famille), ['velo', 'course']);
  assert.equal(g[1].meilleur.mois, '2026-02');
  assert.equal(g[1].points[0].note, 100);
  assert.equal(g[1].points[1].note, 50);
});

test('une séance du futur ou sans durée ne compte pas', () => {
  const g = notesMensuelles([act('2026-09-01', 600), act('2026-01-10', 0)], maintenant);
  assert.equal(g.length, 0);
});

test('à égalité, le premier mois en date est le meilleur', () => {
  const [c] = notesMensuelles([act('2026-01-10', 300), act('2026-02-10', 300)], maintenant);
  assert.equal(c.meilleur.mois, '2026-01');
});

test('fenêtre : les 3 derniers mois gardent les notes de tout l\'historique', () => {
  const g = notesMensuelles([act('2025-06-10', 1200), act('2026-04-10', 300), act('2026-05-10', 600)], maintenant);
  const f = fenetre(g, 3, maintenant);
  assert.deepEqual(f.mois, ['2026-03', '2026-04', '2026-05']);
  assert.deepEqual(f.courbes[0].points.map((p) => p.note), [0, 25, 50]); // 100 = juin 2025 (20 h), hors fenêtre
  assert.equal(fenetre(g, null, maintenant).mois.length, 12);
});

test('nomMois', () => {
  assert.equal(nomMois('2026-03'), 'Mars 2026');
});
