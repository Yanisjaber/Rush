import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePalier, efficacitePct, latenceMin, scoreNuit, qualificatifDe, tonDe, preparer, texteHM, moyenneHeure, analyserHoraires, analyser, signauxPhysio, synthese, planAction, comparaisons, bandeStress } from '../src/lib/data/score-sommeil.js';

const nuitParfaite = (date = '2026-10-10') => ({
  date, bedtime: `${date} 23:00`, wake_time: `${date} 07:30`, total_sec: 28800, awake_sec: 1200, awake_count: 1,
  deep_sec: 4900, rem_sec: 6300, light_sec: 17600, segments: [[0, 5, 3], [5, 400, 1]], hrv_avg: 60, avg_heart_rate: 52, resp_avg: 14, spo2_avg: 96, avg_stress: 20,
});

test('scorePalier : 100 au bon seuil, 25 au seuil inapproprié, 0 au point zéro, dégradé entre les deux', () => {
  assert.equal(scorePalier(85, 85, 75, 40, true), 100);
  assert.equal(scorePalier(80, 85, 75, 40, true), 62.5);
  assert.equal(scorePalier(75, 85, 75, 40, true), 25);
  assert.equal(scorePalier(57.5, 85, 75, 40, true), 12.5);
  assert.equal(scorePalier(30, 85, 75, 40, true), 0);
  assert.equal(scorePalier(15, 15, 45, 90, false), 100);
  assert.equal(scorePalier(30, 15, 45, 90, false), 62.5);
  assert.equal(scorePalier(null, 85, 75, 40, true), null);
});

test('efficacité et latence', () => {
  assert.equal(Math.round(efficacitePct({ total_sec: 28800, awake_sec: 1200 })), 96);
  assert.equal(efficacitePct({ total_sec: null, awake_sec: 5 }), null);
  assert.equal(latenceMin({ segments: [[0, 20, 3], [20, 100, 1]] }), 20);
  assert.equal(latenceMin({ segments: [[0, 100, 1]] }), 0);
  assert.equal(latenceMin({ segments: [] }), null);
  assert.equal(latenceMin({}), null);
});

test('scoreNuit : nuit idéale = 100 Excellent, nuit blanche = 0, durée courte pénalisée', () => {
  const s = scoreNuit(nuitParfaite());
  assert.equal(s.total, 100);
  assert.equal(s.qualificatif, 'EXCELLENT');
  assert.equal(scoreNuit({ total_sec: 0 }).total, 0);
  const courte = scoreNuit({ ...nuitParfaite(), total_sec: 5 * 3600 });
  assert.equal(courte.composants.duree, 17);
  assert.ok(courte.total < 100);
  assert.equal(scoreNuit(null), null);
});

test('scoreNuit : composants sans donnée exclus, poids redistribué', () => {
  const sansSegments = scoreNuit({ ...nuitParfaite(), segments: undefined });
  assert.equal(sansSegments.total, 100);
  assert.ok(!('latence' in sansSegments.composants));
});

test('qualificatif et ton', () => {
  assert.equal(qualificatifDe(80), 'EXCELLENT');
  assert.equal(qualificatifDe(65), 'GOOD');
  assert.equal(qualificatifDe(50), 'FAIR');
  assert.equal(qualificatifDe(49), 'POOR');
  assert.equal(tonDe('GOOD'), 'bon');
  assert.equal(tonDe('FAIR'), 'moyen');
  assert.equal(tonDe('POOR'), 'faible');
});

test('heures : texte et moyenne autour de minuit', () => {
  assert.equal(texteHM(462), '7h42');
  assert.equal(moyenneHeure(['23:00', '01:00']), 0); // minuit, pas midi
  assert.equal(moyenneHeure([]), null);
  assert.equal(moyenneHeure(['n’importe quoi']), null);
});

test('preparer : tri décroissant et score ajouté', () => {
  const p = preparer([nuitParfaite('2026-10-08'), nuitParfaite('2026-10-10'), nuitParfaite('2026-10-09')]);
  assert.deepEqual(p.map((n) => n.date), ['2026-10-10', '2026-10-09', '2026-10-08']);
  assert.equal(p[0].score_maison.total, 100);
  assert.deepEqual(preparer(null), []);
});

test('analyserHoraires : régularité, durée moyenne, composant le plus faible', () => {
  const nuits = preparer([
    { ...nuitParfaite('2026-10-10'), total_sec: 21600 },
    { ...nuitParfaite('2026-10-09'), bedtime: '2026-10-09 01:00', total_sec: 21600 },
  ]);
  const h = analyserHoraires(nuits);
  assert.equal(h.dureeMoyMin, 360);
  assert.equal(h.ecartCoucherMin, 120); // 23h et 1h : 2 h d'écart
  assert.equal(h.plusFaible, 'duree');
  assert.equal(analyserHoraires([]), null);
});

test('analyser : dette sur 7 jours, efficacité, phases', () => {
  const nuits = preparer(Array.from({ length: 3 }, (_, i) => ({ ...nuitParfaite(`2026-10-0${i + 1}`), total_sec: 21600 })));
  const a = analyser(nuits);
  assert.equal(a.detteMin, 360); // 3 nuits × 2 h
  assert.equal(a.nbNuits, 3);
  assert.ok(a.efficaciteMoy > 90);
  assert.equal(analyser([]), null);
});

test('signaux physiologiques : HRV en baisse marquée, SpO2 basse', () => {
  const nuits = preparer([
    { ...nuitParfaite('2026-10-10'), hrv_avg: 40, spo2_avg: 93 },
    ...Array.from({ length: 5 }, (_, i) => ({ ...nuitParfaite(`2026-10-0${i + 1}`), hrv_avg: 60 })),
  ]);
  const s = signauxPhysio(analyser(nuits));
  const hrv = s.find((x) => x.cle === 'hrv');
  assert.equal(hrv.ton, 'mauvais'); // -33 % par rapport à la moyenne
  assert.match(hrv.texte, /Baisse marquée/);
  assert.equal(s.find((x) => x.cle === 'spo2').ton, 'mauvais');
  assert.equal(s.find((x) => x.cle === 'stress').ton, 'bon');
});

test('synthèse et plan d\'action : pas de HTML, priorité n°1 présente, conseils généraux toujours là', () => {
  const nuits = preparer(Array.from({ length: 5 }, (_, i) => ({ ...nuitParfaite(`2026-10-0${i + 1}`), total_sec: 19800 })));
  const pro = analyser(nuits);
  const texte = synthese(nuits, pro);
  assert.ok(!/[<>]/.test(texte));
  assert.match(texte, /5 dernières nuits/);
  const plan = planAction(pro);
  assert.equal(plan[0].impact, 'fort');
  assert.match(plan[0].texte, /Priorité n°1/);
  assert.equal(plan.filter((a) => a.impact === 'general').length, 4);
  assert.ok(plan.every((a) => !/[<>]/.test(a.texte)));
  assert.match(synthese([], pro), /Pas encore/);
});

test('comparaisons : null sans assez de nuits, récent contre précédent sinon', () => {
  assert.deepEqual(comparaisons(preparer([nuitParfaite()])), { recent: null, semaineWeekEnd: null });
  const nuits = preparer(Array.from({ length: 14 }, (_, i) => ({ ...nuitParfaite(`2026-09-${String(30 - i).padStart(2, '0')}`), total_sec: i < 7 ? 25200 : 21600 })));
  const c = comparaisons(nuits);
  assert.equal(c.recent.a.n, 7);
  assert.equal(c.recent.a.dureeSec, 25200);
  assert.equal(c.recent.b.dureeSec, 21600);
  assert.ok(c.semaineWeekEnd);
});

test('bande de stress', () => {
  assert.equal(bandeStress(10), 'repos');
  assert.equal(bandeStress(40), 'bas');
  assert.equal(bandeStress(60), 'moyen');
  assert.equal(bandeStress(90), 'élevé');
  assert.equal(bandeStress(null), '');
});
