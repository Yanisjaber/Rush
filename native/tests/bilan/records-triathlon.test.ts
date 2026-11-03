import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordsTriathlon } from '../../src/data/bilan/records-triathlon.ts';
import { recordsBasiquesActivites } from '../../src/data/bilan/records.ts';
import { texteRecordSimple } from '../../src/data/bilan/records-texte.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';

const act = (id: string, famille: string, o: Partial<ActiviteBilan> = {}): ActiviteBilan => ({
  id, name: id, iso: '2026-03-01', sport: famille === 'velo' ? 'cyclisme' : famille === 'course' ? 'course' : 'natation', famille, duree_min: 60, distance_km: 10, d_plus: 0, tss: 0, ...o,
});

test('recordsTriathlon : la plus longue séance et la plus grosse charge toutes disciplines, puis la plus longue de chaque discipline', () => {
  const r = recordsTriathlon([
    act('nat1', 'natation', { distance_km: 1.9, duree_min: 45, tss: 40, iso: '2026-02-01' }),
    act('nat2', 'natation', { distance_km: 3.8, duree_min: 90, tss: 70, iso: '2026-05-01' }),
    act('velo1', 'velo', { distance_km: 120, duree_min: 270, d_plus: 1800, tss: 210, type: 'Ride' }),
    act('velo2', 'velo', { distance_km: 60, duree_min: 100, d_plus: 400, tss: 90, type: 'Ride' }),
    act('virt', 'velo', { distance_km: 150, duree_min: 200, d_plus: 3000, tss: 150, type: 'VirtualRide' }), // simulé : ni distance ni D+
    act('run1', 'course', { distance_km: 21.1, duree_min: 110, tss: 120 }),
  ]);
  const cle = (c: string) => r.find((x) => x.cle === c)!;
  assert.deepEqual(r.map((x) => x.cle), ['duree', 'tss', 'nat_distance', 'velo_distance', 'course_distance', 'velo_dplus']);
  assert.equal(cle('duree').top[0].id, 'velo1');
  assert.equal(cle('tss').top[0].id, 'velo1');
  assert.deepEqual(cle('nat_distance').top.map((e) => e.id), ['nat2', 'nat1']);
  assert.equal(cle('velo_distance').top[0].id, 'velo1'); // pas le vélo virtuel (150 km simulés)
  assert.equal(cle('velo_dplus').top[0].valeur, 1800);
  assert.equal(cle('course_distance').top[0].valeur, 21.1);
  assert.equal(cle('course_distance').top[0].famille, 'course');
});

test('recordsTriathlon : une discipline sans séance n\'a pas de record (duathlon : pas de natation)', () => {
  const r = recordsTriathlon([act('v', 'velo', { distance_km: 50, d_plus: 300, type: 'Ride' }), act('c', 'course', { distance_km: 8 })]);
  assert.deepEqual(r.map((x) => x.cle), ['duree', 'tss' , 'velo_distance', 'course_distance', 'velo_dplus'].filter((c) => c !== 'tss'));
  assert.deepEqual(recordsTriathlon([]), []);
});

test('natation : l\'allure moyenne au 100 m (300 m ou plus), la plus rapide d\'abord', () => {
  const r = recordsBasiquesActivites([
    act('lent', 'natation', { distance_km: 1.5, duree_min: 45 }), // 2 km/h = 3'00"/100 m
    act('vite', 'natation', { distance_km: 2, duree_min: 40 }), // 3 km/h = 2'00"/100 m
    act('court', 'natation', { distance_km: 0.2, duree_min: 3 }), // sous 300 m : pas de record d'allure
  ], 'natation');
  const allure = r.find((x) => x.cle === 'allure100')!;
  assert.deepEqual(allure.top.map((e) => e.id), ['vite', 'lent']);
  assert.equal(allure.unite, 'allure100');
  assert.equal(texteRecordSimple(allure.top[0].valeur, 'allure100'), `2'00" /100 m`);
  assert.equal(texteRecordSimple(allure.top[1].valeur, 'allure100'), `3'00" /100 m`);
});
