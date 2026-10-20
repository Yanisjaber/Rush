import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIANCE_MINI, indiceCharge, indiceContreReference, indiceDepuisEcart, indicateurs, lecture, niveauDe, phi, POIDS_FORME, serieEtatDeForme } from '../src/data/forme-sante.ts';
import type { Metrique, Nuit } from '../src/data/types.ts';

const proche = (a: number, b: number, eps = 0.002) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

function nuit(i: number, plus: Partial<Nuit> = {}): Nuit {
  const d = new Date(2026, 0, 1 + i);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    date, bedtime: null, wake_time: null, total_sec: 7.5 * 3600, deep_sec: 5400, light_sec: 15000, rem_sec: 6000, awake_sec: 600, awake_count: 2, restless_count: null,
    avg_stress: 30, avg_heart_rate: 55, resting_heart_rate: 50, body_battery_change: null, hrv_avg: 60, hrv_status: null, resp_avg: null, resp_min: null, resp_max: null,
    spo2_avg: null, score: null, score_qualifier: null, segments: null, ...plus,
  };
}
const nuits = (n: number, f: (i: number) => Partial<Nuit> = () => ({})) => Array.from({ length: n }, (_, i) => nuit(i, f(i)));
const metrique = (date: string, tsb: number): Metrique => ({ iso_date: date, tss: 0, ctl: 50, atl: 50 - tsb, tsb, duration_min: 0, activity_count: 0 });

test('phi : la loi normale (valeurs de référence)', () => {
  proche(phi(0), 0.5, 1e-6);
  proche(phi(1.96), 0.975, 1e-3);
  proche(phi(-1), 0.1587, 1e-3);
  proche(phi(1) + phi(-1), 1, 1e-6);
});

test('indiceDepuisEcart : 50 comme d\'habitude, plus haut = mieux, borné à ±2,5 écarts-types', () => {
  assert.equal(indiceDepuisEcart(0), 50);
  assert.equal(indiceDepuisEcart(1), 84);
  assert.equal(indiceDepuisEcart(-1), 16);
  assert.equal(indiceDepuisEcart(10), indiceDepuisEcart(2.5));
  assert.equal(indiceDepuisEcart(-10), indiceDepuisEcart(-2.5));
});

test('indiceContreReference : pas de référence suffisante = null ; le sens et le plancher d\'écart-type', () => {
  assert.equal(indiceContreReference(60, [60, 61, 59], 1, 1), null); // moins de 10 valeurs
  const ref = Array.from({ length: 20 }, () => 60); // référence constante : écart-type nul, c'est le plancher qui s'applique
  assert.equal(indiceContreReference(60, ref, 1, 2), 50);
  assert.equal(indiceContreReference(62, ref, 1, 2), 84); // +1 écart-type (plancher 2)
  assert.equal(indiceContreReference(62, ref, -1, 2), 16); // même écart, mais « plus haut = moins bien » (FC, stress)
});

test('indiceCharge : la fraîcheur de Banister ramenée entre 0 et 100', () => {
  assert.equal(indiceCharge(0), 50);
  assert.equal(indiceCharge(20), 80);
  assert.equal(indiceCharge(-20), 20);
  assert.equal(indiceCharge(-100), 0);
  assert.equal(indiceCharge(100), 100);
});

test('les poids des piliers font 1', () => {
  proche(Object.values(POIDS_FORME).reduce((a, b) => a + b, 0), 1, 1e-9);
});

test('serieEtatDeForme : une nuit comme les précédentes est « comme d\'habitude » (indice des piliers à 50)', () => {
  const serie = serieEtatDeForme(nuits(40), [metrique('2026-02-09', 0)]);
  const dernier = serie[serie.length - 1];
  const par = (cle: string) => dernier.composantes.find((c) => c.cle === cle)?.indice;
  assert.equal(par('hrv'), 50);
  assert.equal(par('fc'), 50);
  assert.equal(par('stress'), 50);
  assert.equal(par('charge'), 50);
  assert.ok((par('sommeil') ?? 0) > 60); // 7 h 30 bien dormies : le score absolu est bon
  assert.ok(dernier.indice != null && dernier.indice >= 50 && dernier.indice <= 70);
  assert.equal(dernier.confiance, 1);
});

test('serieEtatDeForme : la référence ne contient jamais le futur, et les premières nuits n\'ont pas de HRV comparée', () => {
  const serie = serieEtatDeForme(nuits(40), []);
  assert.equal(serie[0].composantes.find((c) => c.cle === 'hrv')?.indice, null); // aucune nuit avant
  assert.equal(serie[8].composantes.find((c) => c.cle === 'hrv')?.indice, null); // 8 nuits avant : sous le minimum de 10
  assert.notEqual(serie[12].composantes.find((c) => c.cle === 'hrv')?.indice, null);
});

test('serieEtatDeForme : une HRV plus haute et une FC plus basse font monter l\'indice, l\'inverse le fait descendre', () => {
  const base = serieEtatDeForme(nuits(40), []);
  const mieux = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 80, resting_heart_rate: 46 } : {})), []);
  const moins = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 42, resting_heart_rate: 56 } : {})), []);
  const fin = (s: ReturnType<typeof serieEtatDeForme>) => s[s.length - 1].indice as number;
  assert.ok(fin(mieux) > fin(base), `${fin(mieux)} > ${fin(base)}`);
  assert.ok(fin(moins) < fin(base), `${fin(moins)} < ${fin(base)}`);
});

test('serieEtatDeForme : trop de données manquantes = pas d\'indice ; les poids disponibles sont renormalisés', () => {
  // Rien d'autre que le sommeil (poids 0,25 < 0,55) : pas d'indice
  const seul = serieEtatDeForme(nuits(40, () => ({ hrv_avg: null, resting_heart_rate: null, avg_stress: null })), []);
  assert.equal(seul[39].indice, null);
  assert.ok(seul[39].confiance < CONFIANCE_MINI);
  // Sans la charge (poids 0,10), le reste est renormalisé : l'indice existe quand même
  const sansCharge = serieEtatDeForme(nuits(40), []);
  assert.equal(sansCharge[39].confiance, 0.9);
  assert.notEqual(sansCharge[39].indice, null);
  assert.deepEqual(serieEtatDeForme(null, null), []);
});

test('niveauDe, lecture et indicateurs : seuils 65 et 40, point faible sous 45', () => {
  assert.equal(niveauDe(65), 'bon');
  assert.equal(niveauDe(64), 'moyen');
  assert.equal(niveauDe(40), 'moyen');
  assert.equal(niveauDe(39), 'faible');
  assert.equal(niveauDe(null), null);
  const point = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 40, resting_heart_rate: 58 } : {})), [metrique('2026-02-09', 0)])[39];
  const l = lecture(point);
  assert.ok(l && l.niveau !== 'bon');
  assert.ok(l?.pointFaible && l.pointFaible.indice != null && l.pointFaible.indice < 45);
  assert.equal(lecture({ date: '2026-01-01', indice: null, confiance: 0, composantes: [] }), null);
  const ind = indicateurs(point);
  assert.deepEqual(ind.map((i) => i.cle), ['sommeil', 'recuperation', 'forme']);
  assert.equal(ind[2].indice, 50);
});
