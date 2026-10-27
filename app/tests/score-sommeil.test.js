import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePalier, efficacitePct, latenceMin, scoreNuit, qualificatifDe, tonDe, preparer, texteHM, moyenneHeure, analyserHoraires, analyser, signauxPhysio, synthese, planAction, comparaisons, bandeStress, ecartHeures, tesDernieresNuits, nuitsDeLaSemaine, bornesAuto, joursSansNuit } from '../src/lib/data/score-sommeil.js';

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

test('scoreNuit : nuit idéale = 100 Excellent, durée courte pénalisée, nuit sans durée = pas de score', () => {
  const s = scoreNuit(nuitParfaite());
  assert.equal(s.total, 100);
  assert.equal(s.qualificatif, 'EXCELLENT');
  assert.equal(scoreNuit({ total_sec: 0 }), null);
  assert.equal(scoreNuit({ total_sec: null }), null);
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

test('écart entre deux heures : par le chemin le plus court, minuit compris', () => {
  assert.equal(ecartHeures(30, 23 * 60 + 30), 60); // 00h30 contre 23h30
  assert.equal(ecartHeures(23 * 60 + 30, 30), -60);
  assert.equal(ecartHeures(8 * 60, 7 * 60), 60);
  assert.equal(ecartHeures(null, 100), null);
});

test('preparer : une nuit sans durée (montre pas portée) disparaît, elle ne compte ni en score ni en dette', () => {
  const nuits = preparer([nuitParfaite('2026-10-26'), { date: '2026-10-27', total_sec: 0 }, { date: '2026-10-25', total_sec: null }]);
  assert.deepEqual(nuits.map((n) => n.date), ['2026-10-26']);
});

test('horaires : un coucher mal formé est ignoré au lieu de compter pour midi', () => {
  const bonnes = [0, 1, 2].map((i) => ({ ...nuitParfaite(`2026-10-2${i}`), bedtime: `2026-10-2${i} 23:00`, wake_time: `2026-10-2${i} 07:00` }));
  const mauvaise = { ...nuitParfaite('2026-10-23'), bedtime: 'pas une heure', wake_time: '2026-10-23 07:00' };
  const h = analyserHoraires(preparer([...bonnes, mauvaise]));
  assert.equal(h.coucherMoyen, '23h00');
  assert.equal(h.ecartCoucherMin, 0);
});

test('« tes N dernières nuits » : singulier correct, et l\'analyse porte sur 14 nuits au plus', () => {
  assert.equal(tesDernieresNuits(1), 'ta dernière nuit');
  assert.equal(tesDernieresNuits(14), 'tes 14 dernières nuits');
  const nuits = preparer(Array.from({ length: 30 }, (_, i) => nuitParfaite(`2026-09-${String(30 - i).padStart(2, '0')}`)));
  const pro = analyser(nuits);
  assert.equal(pro.nbAnalysees, 14);
  assert.ok(pro.horaires.nbNuits <= 14);
  const une = preparer([nuitParfaite('2026-09-30')]);
  assert.ok(!synthese(une, analyser(une)).includes('1 dernières'));
});

test('latence : des segments mal formés ne font pas planter, ils sont ignorés', () => {
  assert.equal(latenceMin({ segments: [null, [0, 10, 3], [10, 'x', 1], [10, 40, 1]] }), 10);
  assert.equal(latenceMin({ segments: [null, 'x'] }), null);
});

test('cible de durée : 8 h partout (dette, coucher visé, plan d\'action)', () => {
  const nuits = preparer(Array.from({ length: 10 }, (_, i) => ({ ...nuitParfaite(`2026-09-${String(30 - i).padStart(2, '0')}`), total_sec: 7 * 3600, bedtime: `2026-09-${String(29 - i).padStart(2, '0')} 23:00`, wake_time: `2026-09-${String(30 - i).padStart(2, '0')} 07:00` })));
  const pro = analyser(nuits);
  assert.equal(pro.detteMin, 7 * 60); // 1 h manquante par nuit × 7 nuits
  assert.equal(pro.horaires.coucherVise, '23h00'); // lever 7h − 8 h
  assert.ok(planAction(pro).some((a) => a.texte.includes('vise plutôt 8h00')));
});

test('7 derniers jours : par dates, un trou de synchronisation n\'est pas comblé par de vieilles nuits', () => {
  // 5 nuits récentes, puis rien pendant 3 semaines, puis 6 vieilles nuits
  const recentes = [30, 29, 28, 27, 26].map((j) => nuitParfaite(`2026-10-${j}`));
  const vieilles = [5, 4, 3, 2, 1, 0].map((j) => nuitParfaite(`2026-10-0${j + 1}`));
  const nuits = preparer([...recentes, ...vieilles]);
  assert.equal(nuitsDeLaSemaine(nuits, 0).length, 5);
  assert.equal(nuitsDeLaSemaine(nuits, 7).length, 0);
  assert.equal(comparaisons(nuits).recent, null); // rien dans les 7 jours d'avant : pas de « tendance »
  assert.equal(analyser(nuits).nbNuitsDette, 5);
});

test('bornesAuto : échelle collée aux valeurs, vide sans valeur, ignore les trous', () => {
  assert.deepEqual(bornesAuto([14, 15, null, 16]), { min: 13, max: 17 });
  assert.deepEqual(bornesAuto([null, NaN]), {});
  const plat = bornesAuto([60, 60]);
  assert.ok(plat.min < 60 && plat.max > 60);
});

test('joursSansNuit : compte les jours manquants entre la première et la dernière nuit', () => {
  assert.equal(joursSansNuit([{ date: '2026-10-01' }, { date: '2026-10-02' }, { date: '2026-10-03' }]), 0);
  assert.equal(joursSansNuit([{ date: '2026-10-05' }, { date: '2026-10-01' }]), 3); // les 2, 3 et 4
  assert.equal(joursSansNuit([{ date: '2026-10-05' }]), 0);
  assert.equal(joursSansNuit([]), 0);
});
