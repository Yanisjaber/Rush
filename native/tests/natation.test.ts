import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allureNatation, allureParSemaineNatation, alluresParDistance, bilanMoisNatation, meilleuresNatation, prepaNatation, volumeNatation } from '../src/data/natation.ts';
import { formatAllure100m } from '../src/data/format.ts';
import type { Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21); // 21 octobre 2026
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T08:00:00`;
};
const nage = (id: string, avant: number, km: number, minutes: number, sport = 'Swim'): Seance => ({
  id, name: null, sport, start_date_local: jour(avant), moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});

test('formatAllure100m : 102 s pour 100 m', () => {
  assert.equal(formatAllure100m(102), `1'42"/100 m`);
  assert.equal(formatAllure100m(65), `1'05"/100 m`);
});

test('volumeNatation : mètres par semaine glissante, seule la natation compte', () => {
  const v = volumeNatation([nage('a', 1, 2, 40), nage('b', 3, 1, 20), nage('c', 9, 1.5, 30), nage('d', 2, 10, 30, 'Run')], 4, AUJOURDHUI);
  assert.deepEqual(v.parSemaine, [0, 0, 1500, 3000]);
  assert.equal(v.derniere, 3000);
  assert.equal(v.ecartPct, 100); // 3000 m contre 1500 m de moyenne
});

test('volumeNatation : sans séance, des zéros et pas d\'écart', () => {
  const v = volumeNatation([], 4, AUJOURDHUI);
  assert.deepEqual(v.parSemaine, [0, 0, 0, 0]);
  assert.equal(v.ecartPct, null);
});

test('allureNatation : 4 semaines contre les 4 d\'avant, en secondes pour 100 m', () => {
  // 2 km en 40 min = 120 s/100 m (période actuelle) ; 1 km en 20 min = 120 s, puis 1 km en 18 min = 108 s (période précédente)
  const a = allureNatation([nage('a', 2, 2, 40), nage('b', 35, 1, 18)], AUJOURDHUI);
  assert.equal(a.actuelle, 120);
  assert.equal(a.precedente, 108);
  assert.equal(a.evolutionPct, 11.1); // 11,1 % plus lent
  assert.equal(a.parSemaine.length, 8);
});

test('allureNatation : une séance de moins de 300 m ne compte pas pour l\'allure', () => {
  const a = allureNatation([nage('a', 2, 0.2, 10)], AUJOURDHUI);
  assert.equal(a.actuelle, null);
  assert.equal(a.evolutionPct, null);
});

test('meilleuresNatation : la plus longue, et la plus rapide parmi les séances d\'au moins 500 m', () => {
  const m = meilleuresNatation([nage('a', 5, 2.5, 55), nage('b', 8, 1, 17), nage('c', 12, 0.3, 4)]);
  assert.equal(m.plusLongue?.id, 'a');
  assert.equal(m.plusRapide?.id, 'b'); // 102 s/100 m ; la séance c (80 s/100 m) fait moins de 500 m
  assert.equal(m.plusRapide?.allure, 102);
  assert.equal(meilleuresNatation([]).plusLongue, null);
});

test('allureParSemaineNatation : une allure par semaine nagée, de la plus ancienne à la plus récente, avec l\'évolution', () => {
  const a = allureParSemaineNatation([nage('a', 1, 2, 40), nage('b', 9, 2, 44), nage('c', 17, 2, 48), nage('court', 25, 0.2, 5)], 4, AUJOURDHUI);
  assert.ok(a);
  assert.deepEqual(a.points, [144, 132, 120]); // 2 km en 48, 44 puis 40 minutes ; les 200 m de la semaine du 25e jour sont trop courts
  assert.equal(a.actuelle, 120);
  assert.equal(a.premiere, 144);
  assert.equal(a.meilleure, 120);
  assert.equal(a.evolutionPct, -16.7);
});

test('allureParSemaineNatation : une seule semaine n\'a pas d\'évolution ; sans natation, null', () => {
  assert.equal(allureParSemaineNatation([nage('a', 1, 2, 40)], 4, AUJOURDHUI)?.evolutionPct, null);
  assert.equal(allureParSemaineNatation([nage('c', 1, 2, 40, 'Run')], 4, AUJOURDHUI), null);
});

test('bilanMoisNatation : le mois en cours face au mois d\'avant au même jour du mois', () => {
  // Aujourd'hui : 21 octobre. Octobre : le 20 (2 km) et le 5 (1,5 km). Septembre : le 10 (2 km), le 25 (3 km, après le 21). Août : ignoré.
  const b = bilanMoisNatation([nage('o1', 1, 2, 40), nage('o2', 16, 1.5, 30), nage('s1', 41, 2, 40), nage('s2', 26, 3, 60), nage('a1', 52, 2, 40), nage('run', 2, 10, 50, 'Run')], AUJOURDHUI);
  assert.deepEqual(b.actuel, { metres: 3500, seances: 2, secondes: 4200 });
  assert.deepEqual(b.precedent, { metres: 5000, seances: 2, secondes: 6000 });
  assert.deepEqual(b.precedentMemeJour, { metres: 2000, seances: 1 });
  assert.equal(b.ecartPct, 75);
  assert.deepEqual([b.mois, b.annee, b.jour], [10, 2026, 21]);
});

test('bilanMoisNatation : sans natation le mois d\'avant, pas de comparaison ; rien nagé, zéro', () => {
  assert.equal(bilanMoisNatation([nage('o1', 1, 2, 40)], AUJOURDHUI).ecartPct, null);
  const vide = bilanMoisNatation([], AUJOURDHUI);
  assert.deepEqual(vide.actuel, { metres: 0, seances: 0, secondes: 0 });
});

test('alluresParDistance : l\'allure moyenne par tranche de distance, la plus rapide et la plus lente', () => {
  const r = alluresParDistance([nage('c', 2, 1, 18), nage('m', 5, 2, 40), nage('l', 9, 3, 66)], 12, AUJOURDHUI);
  assert.deepEqual(r.tranches.map((t) => [t.cle, t.seances, t.allure]), [['courte', 1, 108], ['moyenne', 1, 120], ['longue', 1, 132]]);
  assert.equal(r.plusRapide, 'courte');
  assert.equal(r.plusLente, 'longue');
});

test('alluresParDistance : une seule tranche n\'a ni plus rapide ni plus lente ; les séances trop anciennes ou trop courtes sont ignorées', () => {
  const r = alluresParDistance([nage('c', 2, 1, 18), nage('vieux', 120, 3, 60), nage('court', 3, 0.2, 5)], 12, AUJOURDHUI);
  assert.deepEqual(r.tranches.map((t) => t.seances), [1, 0, 0]);
  assert.equal(r.plusRapide, null);
  assert.equal(r.tranches[1].allure, null);
});

test('prepaNatation : ta plus longue séance face à la distance de la course visée, et ton volume des 4 dernières semaines', () => {
  const objectifs = [
    { name: 'Traversée du lac', date: jour(-30).slice(0, 10), sport: 'Swim', km: 3 },
    { name: 'Un 10 km', date: jour(-10).slice(0, 10), sport: 'Run', km: 10 },
    { name: 'Passée', date: jour(5).slice(0, 10), sport: 'Swim', km: 5 },
  ];
  const p = prepaNatation([nage('a', 3, 2.4, 50), nage('b', 10, 1.6, 35), nage('c', 40, 2.0, 40), nage('vieux', 120, 4, 90)], objectifs, AUJOURDHUI);
  assert.equal(p.cible?.nom, 'Traversée du lac');
  assert.equal(p.cible?.joursRestants, 30);
  assert.equal(p.plusLongue, 2.4); // la séance de 4 km date de plus de 12 semaines
  assert.equal(p.pctDistance, 80);
  assert.equal(p.metres4Semaines, 4000);
  assert.equal(p.metresParSemaine, 1000);
  assert.equal(prepaNatation([nage('a', 3, 2.4, 50)], [], AUJOURDHUI).cible, null);
  assert.equal(prepaNatation([nage('a', 3, 2.4, 50)], [], AUJOURDHUI).pctDistance, null);
});
