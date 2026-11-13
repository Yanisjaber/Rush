import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { DUREES_COURSE, DUREES_VELO, pointsRecordsParTrimestre, POIDS_RANG, recordLonguesSorties, recordsDesLignes, recordsNatation } from '../../src/data/bilan/records-niveau.ts';

const act = (iso: string, extra: Partial<ActiviteBilan> = {}): ActiviteBilan => ({ id: iso + Math.random(), name: 'S', iso, sport: 'course', famille: 'course', duree_min: 60, distance_km: 10, d_plus: 0, tss: 0, ...extra });
const tri = (iso: string): string => `${iso.slice(0, 4)}-T${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

test('les poids : la meilleure séance pèse le plus, la 5e le moins', () => {
  assert.equal(POIDS_RANG.length, 5);
  for (let i = 1; i < 5; i++) assert.ok(POIDS_RANG[i] < POIDS_RANG[i - 1]);
});

test('les durées demandées : vélo avec 5 s et 30 s, course à partir d\'1 minute', () => {
  assert.ok(DUREES_VELO.includes(5) && DUREES_VELO.includes(30) && DUREES_VELO.includes(7200));
  assert.ok(!DUREES_COURSE.includes(5) && !DUREES_COURSE.includes(30) && DUREES_COURSE.includes(60));
});

test('recordsDesLignes : garde les durées demandées et les 5 premiers rangs, dans l\'ordre du rang', () => {
  const lignes = [
    { cle: 300, rang: 2, start_date_local: '2024-05-02T08:00:00' },
    { cle: 300, rang: 1, start_date_local: '2026-03-10T08:00:00' },
    { cle: 300, rang: 6, start_date_local: '2020-01-01T08:00:00' }, // hors des 5 premiers
    { cle: 999, rang: 1, start_date_local: '2025-01-01T08:00:00' }, // durée non demandée
  ];
  const r = recordsDesLignes('velo', 'w', lignes, DUREES_VELO);
  assert.equal(r.length, 1);
  assert.equal(r[0].cle, 'w-300');
  assert.deepEqual(r[0].dates, ['2026-03-10', '2024-05-02']);
});

test('la plus longue sortie : les 5 plus longues du sport, la plus longue d\'abord', () => {
  const acts = [act('2026-01-01', { distance_km: 30 }), act('2025-01-01', { distance_km: 50 }), act('2024-01-01', { distance_km: 40 }), act('2023-01-01', { distance_km: 5, famille: 'velo' })];
  const [r] = recordLonguesSorties(acts, 'course');
  assert.deepEqual(r.dates, ['2025-01-01', '2024-01-01', '2026-01-01']);
});

test('natation : une allure par distance de séance et la plus longue sortie', () => {
  const acts = [act('2026-02-01', { famille: 'natation', distance_km: 1.6, duree_min: 40 }), act('2025-02-01', { famille: 'natation', distance_km: 0.4, duree_min: 10 })];
  const r = recordsNatation(acts);
  assert.ok(r.some((x) => x.cle === 'allure-300'));
  assert.ok(r.some((x) => x.cle === 'plus-longue-sortie'));
  assert.ok(!r.some((x) => x.cle === 'allure-2000')); // aucune séance n'atteint 2 000 m
});

test('un 2e meilleur record de 2024 donne un petit coup de pouce à 2024, même si le 1er date de 2026', () => {
  const pts = pointsRecordsParTrimestre([{ famille: 'velo', cle: 'w-300', dates: ['2026-03-10', '2024-05-02'] }], tri).get('velo');
  assert.equal(pts?.get('2026-T1')?.points, 1);
  assert.equal(pts?.get('2024-T2')?.points, 0.8);
});

test('les points d\'un trimestre s\'additionnent sur tous les records', () => {
  const pts = pointsRecordsParTrimestre(
    [
      { famille: 'velo', cle: 'a', dates: ['2026-01-10', '2025-01-10'] },
      { famille: 'velo', cle: 'b', dates: ['2025-02-10', '2026-02-10'] },
      { famille: 'course', cle: 'c', dates: ['2026-01-05'] },
    ],
    tri,
  );
  assert.equal(pts.get('velo')?.get('2026-T1')?.points, 1 + 0.8);
  assert.equal(pts.get('velo')?.get('2026-T1')?.nb, 2);
  assert.equal(pts.get('velo')?.get('2025-T1')?.points, 0.8 + 1);
  assert.equal(pts.get('course')?.get('2026-T1')?.points, 1);
});
