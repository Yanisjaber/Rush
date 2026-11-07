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
