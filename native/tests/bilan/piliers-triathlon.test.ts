import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesuresMultisport, niveauGlobalMultisport, piliersMultisport, type MesuresMultisportAnnee } from '../../src/data/bilan/piliers-triathlon.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';

const maintenant = new Date(2026, 5, 15, 12);
const act = (iso: string, famille: string, min: number, km: number): ActiviteBilan => ({ id: iso + famille + min, name: iso, iso, sport: 'autre', famille, duree_min: min, distance_km: km, d_plus: 0, tss: 0 });
const mesure = (an: number, o: Partial<MesuresMultisportAnnee> = {}): MesuresMultisportAnnee => ({ an, heures: 0, joursActifs: 0, joursMultisport: 0, joursCouverts: 365, allure100: null, nNatation: 0, ...o });
const TRI = ['natation', 'velo', 'course'] as const;
const DUA = ['course', 'velo'] as const;
const sans = new Map<number, number | null>();

test('piliersMultisport : triathlon = natation, vélo, course, volume ; duathlon = vélo, course, volume', () => {
  assert.deepEqual(piliersMultisport(TRI).map((p) => p.cle), ['natation', 'velo', 'course', 'volume']);
  assert.deepEqual(piliersMultisport(DUA).map((p) => p.cle), ['velo', 'course', 'volume']);
});

test('mesuresMultisport : heures, jours actifs, journées multisport et allure médiane au 100 m (séances de 300 m ou plus)', () => {
  const acts = [
    act('2025-03-01', 'natation', 40, 1.6), // 2'30"/100 m
    act('2025-03-01', 'velo', 90, 40), // même jour : une journée multisport
    act('2025-03-05', 'natation', 50, 2), // 2'30"/100 m
    act('2025-03-09', 'natation', 6, 0.2), // sous 300 m : pas dans l'allure
    act('2025-03-12', 'course', 50, 10),
    act('2025-03-12', 'muscu', 60, 0), // pas une discipline du triathlon
    act('2026-02-01', 'velo', 60, 25),
  ];
  const m = mesuresMultisport(acts, TRI, maintenant);
  assert.deepEqual(m.map((x) => x.an), [2025, 2026]);
  const a25 = m[0];
  assert.ok(Math.abs(a25.heures - (40 + 90 + 50 + 6 + 50) / 60) < 1e-9);
  assert.equal(a25.joursActifs, 4);
  assert.equal(a25.joursMultisport, 1);
  assert.equal(a25.nNatation, 2);
  assert.ok(Math.abs((a25.allure100 as number) - 150) < 1e-9, `${a25.allure100}`); // 150 s pour 100 m
  assert.equal(m[1].allure100, null);
  assert.equal(m[1].joursCouverts, 166);
  assert.deepEqual(mesuresMultisport([], TRI, maintenant), []);
  // Le duathlon ne compte pas la natation
  assert.equal(mesuresMultisport(acts, DUA, maintenant)[0].nNatation, 0);
});

test('niveauGlobalMultisport : la natation se compare à ta meilleure année ; le vélo et la course viennent de leurs scores ; la preuve manque sans score', () => {
  const scoresVelo = new Map<number, number | null>([[2024, 80], [2025, 60]]);
  const scoresCourse = new Map<number, number | null>([[2024, 70], [2025, null]]);
  const g = niveauGlobalMultisport(
    [
      mesure(2024, { heures: 300, joursActifs: 200, joursMultisport: 20, allure100: 100, nNatation: 10 }),
      mesure(2025, { heures: 300, joursActifs: 200, joursMultisport: 20, allure100: 125, nNatation: 10 }),
    ],
    TRI,
    scoresVelo,
    scoresCourse,
  )!;
  const a24 = g.annees[0], a25 = g.annees[1];
  assert.equal(a24.piliers.natation, 100); // ta meilleure année
  assert.ok(Math.abs(a25.piliers.natation - 20) < 1e-9, `${a25.piliers.natation}`); // 100 ÷ 125 = 0,8 → (0,8 − 0,75) ÷ 0,25 = 20
  assert.equal(a24.piliers.velo, 80);
  assert.equal(a25.piliers.velo, 60);
  assert.equal(a24.piliers.course, 70);
  assert.equal(a25.piliers.course, 0);
  assert.equal(a25.preuves.course, 0); // pas de score de course en 2025 : pas de preuve
  assert.equal(a24.piliers.volume, 100);
  // 2024 : 4 piliers prouvés : moyenne (100 + 80 + 70 + 100) ÷ 4 = 87,5 → 88 ; 2025 : 3 prouvés : score malgré la course absente
  assert.equal(a24.nbPiliers, 4);
  assert.equal(a24.global, 88);
  assert.equal(a25.nbPiliers, 3);
  assert.ok(a25.global !== null && a25.global < 88);
  assert.equal(g.meilleur.an, 2024);
});

test('niveauGlobalMultisport : moins de 3 piliers prouvés = pas de score global ; le volume est ramené à une année complète', () => {
  const g = niveauGlobalMultisport(
    [mesure(2023, { heures: 200, joursActifs: 150, joursMultisport: 10 }), mesure(2026, { heures: 100, joursActifs: 70, joursMultisport: 6, joursCouverts: 150, allure100: 120, nNatation: 5 })],
    TRI,
    new Map([[2026, 75]]),
    sans,
  )!;
  const a23 = g.annees[0], a26 = g.annees[1];
  assert.equal(a23.global, null); // seul le volume est prouvé
  assert.equal(a23.nbPiliers, 1);
  assert.equal(a26.nbPiliers, 3); // natation, vélo et volume
  assert.ok(a26.global !== null);
  // 2026 : 100 h en 150 jours → 243 h sur une année, plus que 2023 (200 h) : le volume ne s'effondre pas parce que l'année n'est pas finie
  assert.ok(a26.piliers.volume >= a23.piliers.volume, `${a26.piliers.volume} contre ${a23.piliers.volume}`);
  // Moins de 30 jours de données : pas de volume mesuré
  const court = niveauGlobalMultisport([mesure(2026, { heures: 3, joursActifs: 3, joursCouverts: 10 })], DUA, sans, sans)!;
  assert.equal(court.actuel.piliers.volume, 0);
  assert.equal(court.actuel.preuves.volume, 0);
  assert.equal(niveauGlobalMultisport([], TRI, sans, sans), null);
});
