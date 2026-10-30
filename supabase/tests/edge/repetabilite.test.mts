// Test du calcul de la répétabilité (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/repetabilite.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clesRepetabilite, meilleursEfforts } from '../../functions/_shared/repetabilite.ts';

const constante = (n: number, v: number) => new Array(n).fill(v);

test('meilleursEfforts : trois efforts de 5 min séparés, du plus fort au plus faible', () => {
  // 3 blocs de 300 s à 300 / 280 / 250 W, séparés de 10 min à 100 W
  const serie = [...constante(600, 100), ...constante(300, 300), ...constante(600, 100), ...constante(300, 280), ...constante(600, 100), ...constante(300, 250), ...constante(600, 100)];
  assert.deepEqual(meilleursEfforts(serie), [300, 280, 250]);
});

test('meilleursEfforts : deux fenêtres qui se chevauchent comptent pour un seul effort', () => {
  // Un seul bloc de 10 min à 300 W : il ne donne qu'un effort ; les deux autres sont pris dans les parties faciles (c'est le rapport qui dira que la sortie n'a pas trois vrais efforts)
  const serie = [...constante(600, 100), ...constante(600, 300), ...constante(600, 100)];
  assert.deepEqual(meilleursEfforts(serie), [300, 100, 100]);
});

test('meilleursEfforts : sortie plus courte que 5 min = rien', () => {
  assert.deepEqual(meilleursEfforts(constante(200, 300)), []);
  assert.deepEqual(meilleursEfforts([]), []);
});

test('meilleursEfforts : les valeurs absentes ou négatives comptent pour zéro', () => {
  const serie: (number | null)[] = [...constante(300, 300), ...constante(300, 0), ...constante(300, 300), ...constante(300, 0), ...constante(300, 300)];
  serie[10] = null;
  const efforts = meilleursEfforts(serie as number[]);
  assert.equal(efforts.length, 3);
  assert.ok(efforts[0] > 290 && efforts[0] <= 300);
});

test('clesRepetabilite : rep_1, rep_2, rep_3 en watts entiers ; rien sans trois efforts', () => {
  const serie = [...constante(600, 100), ...constante(300, 301.4), ...constante(600, 100), ...constante(300, 280), ...constante(600, 100), ...constante(300, 250), ...constante(600, 100)];
  assert.deepEqual(clesRepetabilite(serie), { rep_1: 301, rep_2: 280, rep_3: 250 });
  assert.deepEqual(clesRepetabilite(constante(900, 200)), {}); // 15 min : un seul effort de 5 min possible
  assert.deepEqual(clesRepetabilite(constante(100, 200)), {});
});
