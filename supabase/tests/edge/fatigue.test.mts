// Test de la puissance après fatigue (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/fatigue.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleFatigue } from '../../functions/_shared/fatigue.ts';

const constante = (n: number, v: number) => new Array(n).fill(v);

test('cleFatigue : le meilleur 20 min démarre après 30 kJ/kg (70 kg → 2100 kJ)', () => {
  // 2 h à 250 W = 1800 kJ ; puis 200 W : le seuil de 2100 kJ tombe 1500 s plus tard (300 kJ), à 8700 s ; le meilleur 20 min qui suit est celui à 230 W
  const watts = [...constante(7200, 250), ...constante(1500, 200), ...constante(1200, 230), ...constante(1800, 150)];
  assert.deepEqual(cleFatigue(watts, 70), { fat20: 230 });
});

test('cleFatigue : le poids du profil change le seuil, 70 kg si absent', () => {
  const watts = [...constante(3600, 300), ...constante(1200, 200), ...constante(1200, 260)];
  // 3600 × 300 = 1080 kJ, + 1200 × 200 = 240 → 1320 kJ, + 1200 × 260 = 312 → 1632 kJ : les 2100 kJ de 70 kg ne sont jamais atteints
  assert.deepEqual(cleFatigue(watts, 70), {});
  assert.deepEqual(cleFatigue(watts), {});
  // 40 kg : seuil 1200 kJ, atteint à 4200 s (1080 + 120 en 600 s à 200 W) ; il reste 1800 s : le meilleur 20 min est dans les 260 W finaux
  const r = cleFatigue(watts, 40).fat20;
  assert.ok(r >= 230 && r <= 260, `${r}`);
});

test('cleFatigue : une sortie courte ou qui n\'a plus 20 min après le seuil ne donne rien', () => {
  assert.deepEqual(cleFatigue(constante(600, 300), 70), {});
  assert.deepEqual(cleFatigue(constante(7000, 300), 70), {}); // 2100 kJ atteints à 7000 s, plus rien derrière
  assert.deepEqual(cleFatigue([], 70), {});
});
