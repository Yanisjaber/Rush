import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alerteVariation, lisser, moyenneSur, proteinesParKg, serieDe, variationHebdo } from '../../src/data/sante/suivi-corps.ts';
import type { MesuresParJour } from '../../src/data/sante/sante-catalogue.ts';

const iso = (i: number) => {
  const d = new Date(2026, 0, 1 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mesures = (n: number, f: (i: number) => number, metric = 'poids_kg'): MesuresParJour => Object.fromEntries(Array.from({ length: n }, (_, i) => [iso(i), { [metric]: f(i) }]));

test('serieDe : une mesure jour après jour, triée, sans les jours vides', () => {
  const m: MesuresParJour = { '2026-01-03': { poids_kg: 70 }, '2026-01-01': { poids_kg: 71 }, '2026-01-02': { tension_sys: 120 } };
  assert.deepEqual(serieDe(m, 'poids_kg'), [{ date: '2026-01-01', valeur: 71 }, { date: '2026-01-03', valeur: 70 }]);
  assert.deepEqual(serieDe(null, 'poids_kg'), []);
});

test('lisser : la moyenne mobile suit la tendance sans le bruit du jour', () => {
  const l = lisser(serieDe(mesures(10, () => 70), 'poids_kg'));
  assert.ok(l.every((p) => p.lisse === 70)); // une valeur constante reste constante
  // un pic isolé de +3 kg est amorti : la valeur lissée bouge de moins d'1 kg
  const pic = lisser(serieDe(mesures(10, (i) => (i === 9 ? 73 : 70)), 'poids_kg'));
  assert.ok(pic[9].lisse > 70 && pic[9].lisse < 71, String(pic[9].lisse));
  assert.equal(pic[0].lisse, 70); // le premier point démarre la série
});

test('variationHebdo : pente lissée par semaine et en pourcentage ; pas de jugement avec moins de 7 jours', () => {
  assert.equal(variationHebdo(lisser(serieDe(mesures(5, (i) => 70 - i * 0.5), 'poids_kg'))), null); // 5 jours : trop court
  const baisse = variationHebdo(lisser(serieDe(mesures(30, (i) => 80 - i * 0.1), 'poids_kg')));
  assert.ok(baisse && baisse.parSemaine < -0.5 && baisse.parSemaine > -0.8, JSON.stringify(baisse)); // environ -0,7 kg par semaine
  assert.ok(baisse && baisse.pctParSemaine < 0 && baisse.pctParSemaine > -1);
  const stable = variationHebdo(lisser(serieDe(mesures(30, () => 75), 'poids_kg')));
  assert.equal(stable?.parSemaine, 0);
});

test('alerteVariation : perte ou prise de plus de 1 % par semaine', () => {
  assert.equal(alerteVariation(null), null);
  assert.equal(alerteVariation({ parSemaine: -0.4, pctParSemaine: -0.5, jours: 14 }), null);
  assert.equal(alerteVariation({ parSemaine: -0.9, pctParSemaine: -1.2, jours: 14 }), 'perte_rapide');
  assert.equal(alerteVariation({ parSemaine: 0.9, pctParSemaine: 1.1, jours: 14 }), 'prise_rapide');
  const rapide = variationHebdo(lisser(serieDe(mesures(30, (i) => 80 - i * 0.2), 'poids_kg'))); // -1,4 kg par semaine, soit environ -1,7 %
  assert.equal(alerteVariation(rapide), 'perte_rapide');
});

test('moyenneSur : la moyenne des N derniers jours renseignés', () => {
  const m = mesures(10, (i) => 2000 + i * 100, 'calories_kcal');
  const r = moyenneSur(m, 'calories_kcal', 7, iso(9));
  assert.equal(r?.n, 7);
  assert.equal(r?.moyenne, 2600); // jours 3 à 9 : 2300 à 2900
  assert.equal(moyenneSur(m, 'poids_kg', 7, iso(9)), null);
  assert.equal(moyenneSur(m, 'calories_kcal', 7, '2025-01-01'), null); // aucune donnée avant la fin demandée
});

test('proteinesParKg : repère de 1,4 à 2,0 g par kilo', () => {
  assert.deepEqual(proteinesParKg(100, 80), { gParKg: 1.25, niveau: 'limite' });
  assert.equal(proteinesParKg(80, 80)?.niveau, 'basse');
  assert.equal(proteinesParKg(130, 70)?.niveau, 'bonne');
  assert.equal(proteinesParKg(200, 70)?.niveau, 'haute');
  assert.equal(proteinesParKg(140, 70)?.niveau, 'bonne'); // 2,0 pile : encore dans le repère
  assert.equal(proteinesParKg(147, 70)?.niveau, 'haute'); // 2,1 : au-dessus du repère dessiné, donc plus de vert
  assert.equal(proteinesParKg(100, 0), null);
  assert.equal(proteinesParKg(null, 70), null);
  assert.equal(proteinesParKg(NaN, 70), null);
});
