import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancement, formaterCompteARebours, formaterDuree, pausesAPrevoir, prochainMinuitUtc, prochainQuartHeure, QUOTA_DEFAUT, quotaValide, secondesAvantReprise, tempsCalcul } from '../../src/data/synchro/estimation.ts';

const MIDI = Date.UTC(2026, 9, 30, 12, 0, 0); // un quart d'heure pile, à 12 h 00 UTC

test('prochainQuartHeure et prochainMinuitUtc : les remises à zéro de Strava', () => {
  assert.equal(prochainQuartHeure(MIDI), MIDI + 15 * 60 * 1000);
  assert.equal(prochainQuartHeure(MIDI + 14 * 60 * 1000), MIDI + 15 * 60 * 1000);
  assert.equal(prochainMinuitUtc(MIDI), Date.UTC(2026, 9, 31));
});

test('tempsCalcul : le temps des sorties seules, sans pause', () => {
  assert.equal(tempsCalcul(1352, 2), 2704);
  assert.equal(tempsCalcul(-5, 2), 0);
});

test('pausesAPrevoir : sous la limite, aucune pause', () => {
  assert.deepEqual(pausesAPrevoir(80, QUOTA_DEFAUT, MIDI, 2), { nombre: 0, secondes: 0, parJour: false });
});

test('pausesAPrevoir : 250 sorties à 2 s = 2 pauses, comptées de la fin du calcul au quart d\'heure suivant', () => {
  // 100 sorties = 200 s de calcul, attente jusqu'à 12 h 15 (700 s) ; 100 de plus, attente jusqu'à 12 h 30 (700 s) ; puis les 50 dernières
  const p = pausesAPrevoir(250, QUOTA_DEFAUT, MIDI, 2);
  assert.equal(p.nombre, 2);
  assert.equal(p.secondes, 1400);
  assert.equal(p.parJour, false);
});

test('pausesAPrevoir : une partie du quota est déjà utilisée', () => {
  const p = pausesAPrevoir(30, { ...QUOTA_DEFAUT, usage15: 90 }, MIDI, 2);
  assert.equal(p.nombre, 1); // 10 sorties, puis il faut attendre la remise à zéro
  assert.equal(p.secondes, 15 * 60 - 20);
});

test('pausesAPrevoir : la limite du jour fait attendre jusqu\'à minuit UTC', () => {
  const p = pausesAPrevoir(1352, QUOTA_DEFAUT, MIDI, 2);
  assert.equal(p.parJour, true);
  assert.ok(p.nombre >= 10); // au moins 9 pauses de quart d'heure avant la limite du jour, puis l'attente de minuit
  assert.ok(p.secondes > 9 * 600);
});

test('pausesAPrevoir : sans limite connue, pas de calcul (pas de division par zéro)', () => {
  assert.deepEqual(pausesAPrevoir(500, { limite15: 0, limiteJour: 0, usage15: 0, usageJour: 0 }, MIDI, 2), { nombre: 0, secondes: 0, parJour: false });
});

test('secondesAvantReprise : le quart d\'heure suivant, ou minuit si la limite du jour est atteinte', () => {
  assert.equal(secondesAvantReprise(null, MIDI + 4 * 60 * 1000), 11 * 60);
  assert.equal(secondesAvantReprise({ ...QUOTA_DEFAUT, usageJour: 1000 }, MIDI), 12 * 3600);
});

test('formaterDuree : arrondie et lisible', () => {
  assert.equal(formaterDuree(20), 'moins d\'une minute');
  assert.equal(formaterDuree(7 * 60), '7 min');
  assert.equal(formaterDuree(43 * 60), '45 min');
  assert.equal(formaterDuree(3 * 3600 + 20 * 60), '3 h 20');
  assert.equal(formaterDuree(2 * 3600), '2 h');
  assert.equal(formaterDuree(2 * 3600 + 58 * 60), '3 h');
  assert.equal(formaterDuree(30 * 3600), '1 jour et 6 h');
  assert.equal(formaterDuree(48 * 3600), '2 jours');
});

test('formaterCompteARebours : minutes et secondes', () => {
  assert.equal(formaterCompteARebours(42), '42 s');
  assert.equal(formaterCompteARebours(11 * 60 + 5), '11 min 05 s');
  assert.equal(formaterCompteARebours(3 * 3600 + 4 * 60), '3 h 04');
});

test('quotaValide : seulement un quota complet et sensé', () => {
  assert.deepEqual(quotaValide({ limite15: 100, limiteJour: 1000, usage15: 12, usageJour: 340 }), { limite15: 100, limiteJour: 1000, usage15: 12, usageJour: 340 });
  assert.equal(quotaValide(null), null);
  assert.equal(quotaValide({ limite15: 100 }), null);
  assert.equal(quotaValide({ limite15: 0, limiteJour: 1000, usage15: 0, usageJour: 0 }), null);
  assert.equal(quotaValide({ limite15: 100, limiteJour: 1000, usage15: -1, usageJour: 0 }), null);
  assert.equal(quotaValide({ limite15: '100', limiteJour: 1000, usage15: 0, usageJour: 0 }), null);
});

test('avancement : la part des sorties faites, entre 0 et 1', () => {
  assert.equal(avancement(338, 1352), 0.25);
  assert.equal(avancement(5, 0), 1);
  assert.equal(avancement(2000, 1352), 1);
});
