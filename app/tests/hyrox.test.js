import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEGMENTS,
  STATIONS,
  NB_SEGMENTS,
  lireTemps,
  ecrireTemps,
  formatEcart,
  formatEcartLong,
  analyserTest,
  ciblesSegments,
  ecartsParSegment,
  formulaireTestVide,
  formulaireDepuisTest,
  validerTest,
  validerObjectif,
  segmentsDepuisTours,
  resumeTests,
} from '../src/lib/data/hyrox.js';

test('16 segments dans l\'ordre officiel (run, station, run, station…)', () => {
  assert.equal(NB_SEGMENTS, 16);
  assert.equal(STATIONS.length, 8);
  SEGMENTS.forEach((s, i) => {
    assert.equal(s.i, i);
    assert.equal(s.type, i % 2 === 0 ? 'run' : 'station');
  });
  assert.equal(SEGMENTS[1].nom, 'SkiErg');
  assert.equal(SEGMENTS[15].nom, 'Wall Balls');
  assert.equal(SEGMENTS[0].court, 'R1');
});

test('lireTemps / ecrireTemps', () => {
  assert.equal(lireTemps('4:52'), 292);
  assert.equal(lireTemps('1:13:42'), 4422);
  assert.equal(lireTemps("4'52"), 292);
  assert.equal(lireTemps('4\'52"'), 292);
  assert.equal(lireTemps('292'), 292);
  assert.ok(Number.isNaN(lireTemps('')));
  assert.ok(Number.isNaN(lireTemps('4:75')));
  assert.ok(Number.isNaN(lireTemps('abc')));
  assert.ok(Number.isNaN(lireTemps('1:99:00')));
  assert.ok(Number.isNaN(lireTemps('-5')));
  assert.equal(ecrireTemps(292), '4:52');
  assert.equal(ecrireTemps(4422), '1:13:42');
  assert.equal(ecrireTemps(lireTemps('12:05')), '12:05');
});

test('formats d\'écart', () => {
  assert.equal(formatEcart(27), '+27 s');
  assert.equal(formatEcart(-10), '−10 s');
  assert.equal(formatEcart(0), '0 s');
  assert.equal(formatEcartLong(222), '+3\'42"');
  assert.equal(formatEcartLong(-65), '−1\'05"');
});

// Test type : runs à 280 s, stations à 200 s → total 8 × 280 + 8 × 200 = 3840 s
const segments = (run, station) => Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? run : station));
const TEST = { total_s: 3840, segments: segments(280, 200), date: '2026-10-08', label: 'Test', kind: 'test' };

test('analyse d\'un test : total, runs, stations, allures', () => {
  const a = analyserTest(TEST.segments);
  assert.equal(a.total, 3840);
  assert.equal(a.runs, 2240);
  assert.equal(a.stations, 1600);
  assert.equal(a.allures.length, 8);
  assert.equal(a.allures[0], 280);
  assert.equal(analyserTest(null).total, 0);
});

test('cibles : temps saisis par segment, sinon objectif réparti au prorata du test', () => {
  const direct = { total_s: 3600, segments: segments(260, 190) };
  assert.equal(ciblesSegments(direct, TEST)[0], 260);
  const prorata = ciblesSegments({ total_s: 3456, segments: null }, TEST); // 3456 / 3840 = 0,9
  assert.equal(prorata[0], 252);
  assert.equal(prorata[1], 180);
  assert.equal(ciblesSegments(null, TEST), null);
  assert.equal(ciblesSegments({ total_s: 3456, segments: null }, null), null);
});

test('écarts par station : positif = temps à gagner', () => {
  const cibles = segments(260, 190);
  const e = ecartsParSegment(TEST, cibles, 'station');
  assert.equal(e.length, 8);
  assert.ok(e.every((x) => x.type === 'station' && x.ecart === 10));
  const r = ecartsParSegment(TEST, cibles, 'run');
  assert.equal(r.length, 8);
  assert.equal(r[0].ecart, 20);
  assert.deepEqual(ecartsParSegment(null, cibles), []);
});

test('formulaire de test : valide un test complet', () => {
  const f = formulaireTestVide('2026-10-12');
  assert.equal(f.temps.length, 16);
  assert.ok(validerTest(f).erreurs.temps); // aucun temps saisi
  f.temps = f.temps.map((_, i) => (i % 2 === 0 ? '4:40' : '3:20'));
  const { valeurs, erreurs } = validerTest(f);
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.total_s, 3840);
  assert.equal(valeurs.segments.length, 16);
  assert.equal(valeurs.kind, 'test');
  assert.equal(valeurs.notes, null);
});

test('formulaire de test : erreurs (temps invalide, nom vide, date, segment trop long)', () => {
  const f = formulaireTestVide('2026-10-12');
  f.temps = f.temps.map(() => '4:00');
  f.temps[3] = '4:99';
  f.label = ' ';
  f.date = 'hier';
  const { valeurs, erreurs } = validerTest(f);
  assert.equal(valeurs, null);
  assert.ok(erreurs.temps && erreurs.label && erreurs.date);
  const long = formulaireTestVide('2026-10-12');
  long.temps = long.temps.map(() => '4:00');
  long.temps[0] = '3:00:00'; // 3 h pour un segment : refusé
  assert.ok(validerTest(long).erreurs.temps);
});

test('aller-retour formulaire ↔ test enregistré', () => {
  const f = formulaireDepuisTest({ ...TEST, notes: 'ok' });
  assert.equal(f.temps[0], '4:40');
  assert.equal(f.notes, 'ok');
  assert.equal(validerTest(f).valeurs.total_s, 3840);
  // segments absents ou trop courts : 16 champs quand même
  assert.equal(formulaireDepuisTest({ date: '2026-10-01', segments: [60, 60] }).temps.length, 16);
});

test('objectif : total seul, avec temps par segment, et erreurs', () => {
  assert.deepEqual(validerObjectif('1:10:00').valeurs, { total_s: 4200, segments: null });
  assert.ok(validerObjectif('5:00').erreur); // moins de 10 min
  assert.ok(validerObjectif('abc').erreur);
  const temps = Array.from({ length: 16 }, () => '3:00');
  assert.equal(validerObjectif('1:10:00', temps).valeurs.segments.length, 16);
  assert.ok(validerObjectif('1:10:00', temps.slice(0, 5)).erreur);
  assert.ok(validerObjectif('1:10:00', temps.map((t, i) => (i === 2 ? 'x' : t))).erreur);
  assert.deepEqual(validerObjectif('1:10:00', new Array(16).fill('')).valeurs, { total_s: 4200, segments: null });
});

test('tours de montre : seulement 16 tours valides', () => {
  const tours = Array.from({ length: 16 }, (_, i) => ({ elapsed_time: 200 + i }));
  assert.equal(segmentsDepuisTours(tours).length, 16);
  assert.equal(segmentsDepuisTours(tours)[3], 203);
  assert.equal(segmentsDepuisTours(tours.slice(0, 15)), null);
  assert.equal(segmentsDepuisTours([...tours.slice(0, 15), { elapsed_time: 0 }]), null);
  assert.equal(segmentsDepuisTours(null), null);
});

test('résumé des tests : dernier, meilleur, précédent', () => {
  const t = [{ total_s: 4000 }, { total_s: 3800 }, { total_s: 4100 }];
  const r = resumeTests(t);
  assert.equal(r.dernier.total_s, 4000);
  assert.equal(r.meilleur.total_s, 3800);
  assert.equal(r.precedent.total_s, 3800);
  assert.deepEqual(resumeTests([]), { dernier: null, meilleur: null, precedent: null });
});
