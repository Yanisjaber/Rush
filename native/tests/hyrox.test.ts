import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyserTest, ciblesSegments, ecartsParSegment, ecrireTemps, formatEcart, formatEcartLong, lireTemps, NB_SEGMENTS, resumeTests, SEGMENTS, segmentsDepuisTours,
  STATIONS, validerObjectif, validerTest,
} from '../src/data/sports/hyrox.ts';
import { objectifHyroxDemo, testsHyroxDemo } from '../src/data/demo/demo.ts';
import type { TestHyrox } from '../src/data/types.ts';

const date = new Date(2026, 9, 19);

test('structure : 8 stations officielles, 16 segments run / station en alternance', () => {
  assert.equal(STATIONS.length, 8);
  assert.equal(NB_SEGMENTS, 16);
  assert.deepEqual(SEGMENTS.map((s) => s.type), Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 'run' : 'station')));
  assert.equal(SEGMENTS[0].court, 'R1');
  assert.equal(SEGMENTS[1].court, 'SKI');
  assert.equal(SEGMENTS[15].court, 'WALL');
});

test('lireTemps : mm:ss, h:mm:ss, secondes seules, apostrophes ; NaN si invalide', () => {
  assert.equal(lireTemps('4:52'), 292);
  assert.equal(lireTemps('1:13:42'), 4422);
  assert.equal(lireTemps('292'), 292);
  assert.equal(lireTemps("4'52\""), 292);
  assert.equal(lireTemps(' 4 : 52 '), 292);
  for (const mauvais of ['', 'abc', '4:75', '1:61:00', '1:2:3:4', null, undefined]) assert.ok(Number.isNaN(lireTemps(mauvais)), String(mauvais));
});

test('ecrireTemps : l\'inverse de lireTemps', () => {
  assert.equal(ecrireTemps(292), '4:52');
  assert.equal(ecrireTemps(4422), '1:13:42');
  assert.equal(ecrireTemps(0), '0:00');
  assert.equal(ecrireTemps(null), '0:00');
  for (const s of [1, 59, 60, 292, 3599, 3600, 4422]) assert.equal(lireTemps(ecrireTemps(s)), s);
});

test('formatEcart et formatEcartLong : signe, tiret du moins typographique', () => {
  assert.equal(formatEcart(27), '+27 s');
  assert.equal(formatEcart(-10), '−10 s');
  assert.equal(formatEcart(0), '0 s');
  assert.equal(formatEcartLong(222), "+3'42\"");
  assert.equal(formatEcartLong(-65), "−1'05\"");
});

test('analyserTest : total, somme des runs, somme des stations, les 8 temps de run', () => {
  const segs = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 300 : 250));
  const a = analyserTest(segs);
  assert.deepEqual(a, { total: 4400, runs: 2400, stations: 2000, allures: Array(8).fill(300) });
  assert.deepEqual(analyserTest(null), { total: 0, runs: 0, stations: 0, allures: [] });
  assert.equal(analyserTest([100, 'x', 100]).total, 200);
});

test('démo : trois tests qui progressent, objectif 1h10', () => {
  const t = testsHyroxDemo(date);
  assert.equal(t.length, 3);
  assert.ok(t[0].total_s < t[1].total_s && t[1].total_s < t[2].total_s, 'le plus récent est le plus rapide');
  assert.ok(t.every((x) => x.segments.length === 16 && x.total_s === x.segments.reduce((a, b) => a + b, 0)));
  assert.equal(objectifHyroxDemo().total_s, 4200);
});

test('ciblesSegments : les temps saisis par segment, sinon l\'objectif réparti au prorata du test', () => {
  const t = testsHyroxDemo(date)[0];
  const parSegment = Array.from({ length: 16 }, () => 200);
  assert.deepEqual(ciblesSegments({ total_s: 3200, segments: parSegment }, t), parSegment);
  const prorata = ciblesSegments({ total_s: 4200, segments: null }, t);
  assert.equal(prorata?.length, 16);
  const k = 4200 / t.total_s;
  assert.deepEqual(prorata, t.segments.map((v) => Math.round(v * k)));
});

test('ciblesSegments : sans objectif ou sans test, null', () => {
  const t = testsHyroxDemo(date)[0];
  assert.equal(ciblesSegments(null, t), null);
  assert.equal(ciblesSegments({ total_s: 4200, segments: null }, null), null);
  assert.equal(ciblesSegments({ total_s: 0, segments: null }, t), null);
});

test('ecartsParSegment : positif = temps à gagner ; seulement les stations par défaut', () => {
  const t = testsHyroxDemo(date)[0];
  const cibles = ciblesSegments(objectifHyroxDemo(), t)!;
  const stations = ecartsParSegment(t, cibles);
  assert.equal(stations.length, 8);
  assert.ok(stations.every((e) => e.type === 'station'));
  assert.ok(stations.every((e) => e.ecart === Math.round(e.test - e.cible)));
  assert.equal(ecartsParSegment(t, cibles, 'run').length, 8);
  assert.deepEqual(ecartsParSegment(null, cibles), []);
  assert.deepEqual(ecartsParSegment(t, null), []);
});

test('resumeTests : dernier, meilleur et précédent', () => {
  const t = testsHyroxDemo(date);
  const r = resumeTests(t);
  assert.equal(r.dernier, t[0]);
  assert.equal(r.precedent, t[1]);
  assert.equal(r.meilleur, t[0]); // le plus récent est aussi le plus rapide
  assert.deepEqual(resumeTests([]), { dernier: null, meilleur: null, precedent: null });
});

const tempsBons = (): string[] => testsHyroxDemo(date)[0].segments.map(ecrireTemps);
const formulaire = (surcharge: Partial<{ date: string; label: string; kind: string; temps: string[]; notes: string }> = {}) => ({
  date: '2026-10-19', label: 'Test', kind: 'test', temps: tempsBons(), notes: '', ...surcharge,
});

test('validerTest : un formulaire correct donne les valeurs, avec le total', () => {
  const r = validerTest(formulaire());
  assert.ok(r.valeurs);
  assert.equal(r.valeurs.segments.length, 16);
  assert.equal(r.valeurs.total_s, testsHyroxDemo(date)[0].total_s);
  assert.equal(r.valeurs.notes, null);
});

test('validerTest : erreurs de date, de nom, de temps manquant, de total trop long', () => {
  assert.ok(validerTest(formulaire({ date: 'demain' })).erreurs.date);
  assert.ok(validerTest(formulaire({ label: '  ' })).erreurs.label);
  assert.ok(validerTest(formulaire({ label: 'x'.repeat(81) })).erreurs.label);
  assert.ok(validerTest(formulaire({ notes: 'n'.repeat(501) })).erreurs.notes);
  const manque = tempsBons();
  manque[3] = '';
  assert.match(validerTest(formulaire({ temps: manque })).erreurs.temps, /Sled Push/);
  assert.match(validerTest(formulaire({ temps: Array(16).fill('1:59:59') })).erreurs.temps, /10 heures/);
});

test('validerObjectif : entre 10 min et 10 h, 16 temps ou aucun', () => {
  assert.deepEqual(validerObjectif('1:10:00'), { valeurs: { total_s: 4200, segments: null }, erreur: '' });
  assert.ok(validerObjectif('5:00').erreur);
  assert.ok(validerObjectif('10:00:01').erreur);
  assert.ok(validerObjectif('abc').erreur);
  assert.ok(validerObjectif('1:10:00', ['1:00']).erreur);
  assert.equal(validerObjectif('1:10:00', Array(16).fill('')).valeurs?.segments, null);
});

test('segmentsDepuisTours : exactement 16 tours valides, sinon null (on ne devine jamais un découpage)', () => {
  const tours = (n: number, v: number) => Array.from({ length: n }, () => ({ elapsed_time: v }));
  assert.deepEqual(segmentsDepuisTours(tours(16, 300)), Array(16).fill(300));
  assert.equal(segmentsDepuisTours(tours(15, 300)), null);
  assert.equal(segmentsDepuisTours(tours(17, 300)), null);
  assert.equal(segmentsDepuisTours(tours(16, 0)), null);
  assert.equal(segmentsDepuisTours(null), null);
});

test('TestHyrox : forme de la démo', () => {
  const t: TestHyrox = testsHyroxDemo(date)[0];
  assert.equal(t.kind, 'test');
  assert.equal(t.id, 'demo-hx-3');
});
