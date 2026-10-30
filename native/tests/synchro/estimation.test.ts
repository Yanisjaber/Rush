import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancement, avancerAffichage, formaterDuree, formaterPourcent, tempsCalcul } from '../../src/data/synchro/estimation.ts';

test('tempsCalcul : le temps des sorties restantes, sans pause', () => {
  assert.equal(tempsCalcul(1352, 2), 2704);
  assert.equal(tempsCalcul(-5, 2), 0);
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

test('avancerAffichage : avance à vitesse constante, sans jamais dépasser la fin du lot', () => {
  // 0,5 sortie par seconde, lot de 20 : 10 s = 5 sorties de plus
  let v = 100;
  for (let i = 0; i < 100; i++) v = avancerAffichage(v, 100, 1352, 0.5, 0.1, 20);
  assert.ok(Math.abs(v - 105) < 1e-9);
  // longtemps après : bloqué à la 19e du lot (la 20e attend la réponse du serveur)
  for (let i = 0; i < 5000; i++) v = avancerAffichage(v, 100, 1352, 0.5, 0.1, 20);
  assert.equal(v, 119);
});

test('avancerAffichage : une réponse du serveur ne fait pas sauter le compteur, il la rattrape en glissant', () => {
  // le compteur est à 105 mais le serveur confirme 120 : on glisse, pas de saut de 15
  let v = 105;
  const pas: number[] = [];
  for (let i = 0; i < 60; i++) {
    const suivant = avancerAffichage(v, 120, 1352, 0.5, 0.1, 20);
    pas.push(suivant - v);
    v = suivant;
  }
  assert.ok(Math.max(...pas) < 1.6, `plus grand pas : ${Math.max(...pas)}`);
  assert.ok(v >= 119);
  assert.ok(pas.every((x) => x >= 0)); // jamais en arrière
});

test('avancerAffichage : jamais au-delà du total, ni de vitesse négative', () => {
  assert.equal(avancerAffichage(1351, 1350, 1352, 5, 10, 20), 1352);
  assert.equal(avancerAffichage(100, 100, 1352, -3, 1, 20), 100);
  assert.equal(avancerAffichage(100, 100, 1352, 0, 5, 20), 100);
});

test('formaterPourcent : une décimale, une virgule, jamais 100 avant la fin', () => {
  assert.equal(formaterPourcent(0), '0,0');
  assert.equal(formaterPourcent(0.0234), '2,3');
  assert.equal(formaterPourcent(0.5), '50,0');
  assert.equal(formaterPourcent(0.9996), '99,9');
  assert.equal(formaterPourcent(1), '100');
  assert.equal(formaterPourcent(7), '100');
});

test('avancement : la part des sorties faites, entre 0 et 1', () => {
  assert.equal(avancement(338, 1352), 0.25);
  assert.equal(avancement(5, 0), 1);
  assert.equal(avancement(2000, 1352), 1);
});
