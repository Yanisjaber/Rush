// Le suivi du plan : le coach détecte seul ce qui demande de refaire le plan (séances ratées, test fait, blessure sur des séances prévues).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/suivi-plan.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { detecterSuivi, texteSuivi } from '../../functions/_shared/suivi-plan.ts';

const AUJ = '2026-11-20';
const s = (date: string, faite: boolean, est_test = false) => ({ date, minutes: 40, est_test, faite, activite: faite ? { km: 6, secondes: 2200 } : null });
const resume = (suivi: unknown[], extra: Record<string, unknown> = {}) => ({ plan_suivi: suivi, indisponibilites: [], prevues: [], ...extra });
const codes = (r: unknown, h = { dernierPlan: null as string | null }) => detecterSuivi(r, AUJ, h).map((a) => a.code);

test('tout est fait : aucune alerte', () => {
  assert.deepEqual(codes(resume([s('2026-11-16', true), s('2026-11-18', true)])), []);
  assert.deepEqual(codes({}), []);
  assert.deepEqual(codes(resume('n\'importe quoi' as unknown as unknown[])), []);
});
test('séances ratées : 2 sur les 7 derniers jours, ou 3 sur 14 ; une seule ne suffit pas ; la sortie test n\'est pas « ratée » ici', () => {
  assert.deepEqual(codes(resume([s('2026-11-16', false), s('2026-11-18', false)])), ['seances_manquees']);
  assert.deepEqual(codes(resume([s('2026-11-18', false), s('2026-11-12', true)])), []);
  assert.deepEqual(codes(resume([s('2026-11-08', false), s('2026-11-10', false), s('2026-11-12', false)])), ['seances_manquees']);
  assert.deepEqual(codes(resume([s('2026-11-16', false, true), s('2026-11-18', false)])), []);
  const a = detecterSuivi(resume([s('2026-11-16', false), s('2026-11-18', false)]), AUJ, { dernierPlan: null })[0];
  assert.match(a.constat, /2 séances prévues \(16\/11, 18\/11\)/);
  assert.match(a.action, /ce qui s'est passé/);
  assert.match(a.action, /garde-fou santé/);
});
test('sortie test faite : on demande le temps des 3 km (jamais lu dans l\'activité), puis recalibrage avec chrono', () => {
  const r = detecterSuivi(resume([s('2026-11-15', true, true)]), AUJ, { dernierPlan: null });
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'test_fait');
  assert.match(r[0].action, /temps de ses 3 km/);
  assert.match(r[0].action, /chrono_km et chrono_temps/);
  assert.deepEqual(codes(resume([s('2026-11-15', false, true)])), [], 'test non fait : pas d\'alerte ici');
});
test('rien ne se répète : un plan proposé APRÈS les faits fait taire l\'alerte', () => {
  const r = resume([s('2026-11-15', true, true), s('2026-11-16', false), s('2026-11-18', false)]);
  assert.deepEqual(codes(r), ['test_fait', 'seances_manquees']);
  assert.deepEqual(codes(r, { dernierPlan: '2026-11-19' }), []);
  assert.deepEqual(codes(r, { dernierPlan: '2026-11-16' }), [], 'depuis le 16 : le test est avant, une seule séance ratée');
  assert.deepEqual(codes(resume([s('2026-11-16', false), s('2026-11-18', false)]), { dernierPlan: '2026-11-17' }), [], 'une seule séance ratée depuis le plan');
});
test('blessure ou maladie sur des séances prévues par le coach : replanifier ; pas pour celles faites à la main ni hors période', () => {
  const r = resume([], {
    indisponibilites: [{ type: 'blessure', du: '2026-11-22', au: '2026-11-26' }],
    prevues: [{ date: '2026-11-23', creee_par_ia: true }, { date: '2026-11-24', creee_par_ia: false }, { date: '2026-11-30', creee_par_ia: true }],
  });
  const a = detecterSuivi(r, AUJ, { dernierPlan: null });
  assert.equal(a.length, 1);
  assert.equal(a[0].code, 'blessure_a_venir');
  assert.match(a[0].constat, /1 séance du plan tombe pendant ta période d'indisponibilité \(23\/11\)/);
  assert.match(a[0].action, /proposer_replanification/);
  assert.deepEqual(codes(r, { dernierPlan: '2026-11-25' }), [], 'déjà replanifié depuis');
  assert.deepEqual(codes(resume([], { indisponibilites: [{ type: 'maladie', du: '2026-11-22', au: '2026-11-26' }], prevues: [{ date: '2026-11-24', creee_par_ia: false }] })), []);
});
test('texteSuivi : une ligne par alerte, vide sans alerte', () => {
  assert.equal(texteSuivi([]), '');
  const t = texteSuivi(detecterSuivi(resume([s('2026-11-16', false), s('2026-11-18', false)]), AUJ, { dernierPlan: null }));
  assert.match(t, /^- Tu n'as pas fait 2 séances prévues/);
});

// ---------- Écart d'allure : « tes séances sont trop faciles » ----------
const f = (date: string, reelParKm: number, cible = 361, rpe: number | null = null, extra: Record<string, unknown> = {}) => ({
  date, minutes: 40, est_test: false, faite: true, continue: true, allure_cible_s: cible,
  activite: { km: 6, secondes: Math.round(reelParKm * 6), rpe }, ...extra,
});
test('allure trop rapide : 2 sorties faciles à plus de 5 % sous l\'allure prévue → le coach demande le ressenti et propose de recalibrer', () => {
  const r = detecterSuivi(resume([f('2026-11-14', 300), f('2026-11-17', 310)]), AUJ, { dernierPlan: null });
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'allure_trop_rapide');
  assert.match(r[0].constat, /2 dernières sorties/);
  assert.match(r[0].constat, /5:05\/km au lieu de 6:01\/km prévu \(16 % plus vite\)/);
  assert.match(r[0].action, /comment c'était/);
  assert.match(r[0].action, /chrono_km et chrono_temps/);
  assert.match(r[0].action, /doit rester facile/);
});
test('allure trop lente : plus de 8 % plus lent sur 2 sorties → cause, puis plan plus doux ou test ; le ressenti noté est repris', () => {
  const r = detecterSuivi(resume([f('2026-11-14', 400, 361, 8), f('2026-11-17', 410, 361, 9)]), AUJ, { dernierPlan: null });
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'allure_trop_lente');
  assert.match(r[0].constat, /6:45\/km au lieu de 6:01\/km prévu \(12 % plus lentement\)/);
  assert.match(r[0].constat, /8\.5\/10/);
  assert.match(r[0].action, /fatigue, la chaleur, le relief/);
  assert.match(r[0].action, /garde-fou santé/);
});
test('écart d\'allure : pas d\'alerte dans la marge, avec une seule sortie, pour la sortie test, une séance à échauffement, une sortie trop courte, ou après un nouveau plan', () => {
  assert.deepEqual(codes(resume([f('2026-11-14', 350), f('2026-11-17', 370)])), [], 'dans la marge (−3 % et +2 %)');
  assert.deepEqual(codes(resume([f('2026-11-14', 280)])), [], 'une seule sortie');
  assert.deepEqual(codes(resume([f('2026-11-14', 280, 361, null, { est_test: true }), f('2026-11-17', 280, 361, null, { est_test: true })])), ['test_fait']);
  assert.deepEqual(codes(resume([f('2026-11-14', 280, 361, null, { continue: false }), f('2026-11-17', 280, 361, null, { continue: false })])), [], 'séance avec échauffement : non comparable');
  assert.deepEqual(codes(resume([f('2026-11-14', 280, 361, null, { activite: { km: 1.2, secondes: 336, rpe: null } }), f('2026-11-17', 280, 361, null, { activite: { km: 1.5, secondes: 420, rpe: null } })])), [], 'moins de 2 km');
  assert.deepEqual(codes(resume([f('2026-11-14', 280), f('2026-11-17', 280), f('2026-11-18', 300, 0)])), ['allure_trop_rapide'], 'une cible illisible est ignorée');
  assert.deepEqual(codes(resume([f('2026-11-14', 280), f('2026-11-17', 280)]), { dernierPlan: '2026-11-15' }), [], 'seule une sortie depuis le plan');
});
test('allure trop rapide et séances ratées peuvent se lever ensemble ; chaque alerte a son texte', () => {
  const r = resume([f('2026-11-12', 280), f('2026-11-13', 285), { date: '2026-11-16', minutes: 40, est_test: false, faite: false, activite: null }, { date: '2026-11-18', minutes: 40, est_test: false, faite: false, activite: null }]);
  assert.deepEqual(codes(r), ['seances_manquees', 'allure_trop_rapide']);
  assert.equal(texteSuivi(detecterSuivi(r, AUJ, { dernierPlan: null })).split('\n').length, 2);
});
