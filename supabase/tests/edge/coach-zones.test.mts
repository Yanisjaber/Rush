// deno-lint-ignore-file
import test from 'node:test';
import assert from 'node:assert/strict';
import { BORNES_DEFAUT, contexteZones, modelesProposables, validerProposition } from '../../functions/_shared/coach-zones.ts';

const refs = { ftp: 200, lthr: 189, seuilKmh: null };

test('modèles proposables : seulement ceux dont la référence existe', () => {
  assert.deepEqual(modelesProposables(refs), ['puissance', 'cardio']);
  assert.deepEqual(modelesProposables({ ftp: null, lthr: null, seuilKmh: 11.5 }), ['allure']);
  assert.deepEqual(modelesProposables({ ftp: null, lthr: null, seuilKmh: null }), []);
});

test('proposition valide : acceptée, arrondie à 0,1', () => {
  const r = validerProposition({ explication: ' Ton cœur monte vite. ', cardio: [82, 90.04, 95, 101] }, ['puissance', 'cardio']);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.proposition.cardio, [82, 90, 95, 101]);
    assert.equal(r.explication, 'Ton cœur monte vite.');
  }
});

test('proposition refusée : explication manquante, hors plafond de 10 points, mal ordonnée, mauvais nombre de limites, texte à la place des nombres', () => {
  const p = ['puissance', 'cardio'] as const;
  assert.equal(validerProposition({ cardio: [81, 90, 94, 100] }, p).ok, false); // pas d'explication
  assert.equal(validerProposition({ explication: 'x', cardio: [95, 90, 94, 100] }, p).ok, false); // écart > 10 et pas croissante
  assert.equal(validerProposition({ explication: 'x', cardio: [81, 90, 91, 100] }, p).ok, false); // 90 → 91 : moins de 2 points
  assert.equal(validerProposition({ explication: 'x', cardio: [81, 90, 94] }, p).ok, false); // 3 au lieu de 4
  assert.equal(validerProposition({ explication: 'x', cardio: ['81', '90', '94', '100'] }, p).ok, false);
  assert.equal(validerProposition({ explication: 'x', puissance: [56, 76, 91, 106, 121, 175] }, p).ok, false); // 175 : 24 points au-dessus de 151
  assert.equal(validerProposition(null, p).ok, false);
});

test('un modèle invalide est écarté, un autre valide est gardé ; un modèle non proposable est ignoré', () => {
  const r = validerProposition({ explication: 'ok', puissance: [56, 76, 91, 106, 121, 175], cardio: [80, 89, 94, 100], allure: [81, 89, 95, 103] }, ['puissance', 'cardio']);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(Object.keys(r.proposition), ['cardio']); // puissance hors plafond, allure pas proposable
});

test('les limites par défaut sont toujours valides (le modèle peut rendre « rien ne change »)', () => {
  const r = validerProposition({ explication: 'Rien à changer.', puissance: BORNES_DEFAUT.puissance, cardio: BORNES_DEFAUT.cardio }, ['puissance', 'cardio']);
  assert.equal(r.ok, true);
});

test('contexte : que des nombres et les limites par défaut des modèles proposables', () => {
  const c = contexteZones({ references: refs, fcMax: 200, courbePuissance: [{ duree_s: 1200, w90: 246, wTout: 300 }], fcMaxObservee: { p99: 199, sorties: 120 }, effortsCourse: [{ km: 6, kmh: 12.1, fcMoyenne: 174 }] });
  assert.match(c, /Modèles proposables : puissance, cardio/);
  assert.match(c, /1200 s : 246 \/ 300 W/);
  assert.match(c, /Limites par défaut cardio.*81, 90, 94, 100/);
  assert.doesNotMatch(c, /allure \(%/);
});
