import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { recordSemainesAffilee, recordsSeance } from '../../src/data/bilan/records.ts';

const act = (iso: string, extra: Partial<ActiviteBilan> = {}): ActiviteBilan => ({ id: iso + Math.random(), name: 'Séance', iso, sport: 'course', famille: 'course', duree_min: 60, distance_km: 10, d_plus: 0, tss: 50, ...extra });
// Les lundis de novembre 2026 : 2, 9, 16, 23, 30
const semaine = (lundi: string, n: number): ActiviteBilan[] => Array.from({ length: n }, (_, i) => act(lundi.slice(0, 8) + String(Number(lundi.slice(8)) + i).padStart(2, '0')));

test('semaines d\'affilée : trois semaines de suite à 3 séances = 3', () => {
  const acts = [...semaine('2026-11-02', 3), ...semaine('2026-11-09', 4), ...semaine('2026-11-16', 3)];
  const r = recordSemainesAffilee(acts);
  assert.equal(r.top[0].valeur, 3);
  assert.equal(r.top[0].iso, '2026-11-02');
  assert.equal(r.top[0].fin, '2026-11-22'); // le dimanche de la dernière semaine
});

test('une semaine à 2 séances casse la série', () => {
  const acts = [...semaine('2026-11-02', 3), ...semaine('2026-11-09', 2), ...semaine('2026-11-16', 3), ...semaine('2026-11-23', 3)];
  const r = recordSemainesAffilee(acts);
  assert.equal(r.top[0].valeur, 2);
  assert.equal(r.top[0].iso, '2026-11-16');
});

test('aucune semaine à 3 séances : pas de record', () => {
  assert.equal(recordSemainesAffilee(semaine('2026-11-02', 2)).top.length, 0);
});

test('records de séance : la plus longue durée porte le sport de la séance', () => {
  const g = recordsSeance([act('2026-11-03', { duree_min: 372, famille: 'velo' }), act('2026-11-04', { duree_min: 60 })]);
  const duree = g.records.find((r) => r.cle === 'duree');
  assert.equal(duree?.top[0].valeur, 372);
  assert.equal(duree?.top[0].famille, 'velo');
});

test('records de séance : la sortie avec le plus gros dénivelé (une seule séance, pas le cumul du jour)', () => {
  const g = recordsSeance([act('2026-11-03', { d_plus: 900, name: 'Col', type: 'Ride', famille: 'velo' }), act('2026-11-03', { d_plus: 800 }), act('2026-11-04', { d_plus: 100 })]);
  const r = g.records.find((x) => x.cle === 'dplus_seance');
  assert.equal(r?.top[0].valeur, 900);
  assert.equal(r?.top[0].nom, 'Col');
  assert.equal(r?.top[0].sport, 'Ride');
  // le record « par jour » cumule, lui : 900 + 800
  assert.equal(g.records.find((x) => x.cle === 'dplus')?.top[0].valeur, 1700);
});
