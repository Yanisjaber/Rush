// Test du calcul de la dérive cardiaque (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/derive.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleDerive } from '../../functions/_shared/derive.ts';

const constante = (n: number, v: number) => new Array(n).fill(v);

test('cleDerive : mêmes watts, cardio qui monte de 10 % en 2e moitié → dérive d\'environ 9 %', () => {
  const n = 3 * 3600;
  const watts = constante(n, 200);
  const milieu = Math.floor((600 + n) / 2);
  const fc = [...constante(milieu, 140), ...constante(n - milieu, 154)];
  // efficacité 200/140 puis 200/154 : (1 − 140/154) = 9,1 %
  assert.deepEqual(cleDerive(watts, fc), { drift: 9.1 });
});

test('cleDerive : une sortie régulière ne dérive pas ; une 2e moitié plus efficace donne une dérive négative', () => {
  const n = 90 * 60 + 600;
  assert.deepEqual(cleDerive(constante(n, 180), constante(n, 135)), { drift: 0 });
  const milieu = Math.floor((600 + n) / 2);
  const watts = [...constante(milieu, 180), ...constante(n - milieu, 198)];
  assert.deepEqual(cleDerive(watts, constante(n, 135)), { drift: -10 });
});

test('cleDerive : l\'échauffement (10 premières minutes) ne compte pas', () => {
  const n = 2 * 3600;
  const watts = [...constante(600, 100), ...constante(n - 600, 200)];
  const fc = [...constante(600, 100), ...constante(n - 600, 140)];
  assert.deepEqual(cleDerive(watts, fc), { drift: 0 });
});

test('cleDerive : les secondes sans cardio (pause) sont ignorées', () => {
  const n = 3 * 3600;
  const watts = constante(n, 200);
  const fc = constante(n, 140);
  for (let i = 7000; i < 8000; i++) { watts[i] = 0; fc[i] = 0; } // une pause de 1 000 s en 2e moitié
  assert.deepEqual(cleDerive(watts, fc), { drift: 0 });
});

test('cleDerive : la puissance normalisée compte, pas la moyenne (une moitié par à-coups, à moyenne égale, a une NP plus haute)', () => {
  const n = 2 * 3600;
  const milieu = Math.floor((600 + n) / 2);
  // 1re moitié régulière à 200 W ; 2e moitié par à-coups (300 W 2 min / 100 W 2 min) : même moyenne, NP plus haute → l'efficacité monte, le découplage est négatif
  const b: number[] = [];
  for (let i = 0; i < n - milieu; i++) b.push(Math.floor(i / 120) % 2 === 0 ? 300 : 100);
  const watts = [...constante(milieu, 200), ...b];
  const d = cleDerive(watts, constante(n, 140)).drift;
  assert.ok(d < -2, `${d}`);
});

test('cleDerive : rien sous 90 min, sans cardio, ou pour une balade', () => {
  assert.deepEqual(cleDerive(constante(5399, 200), constante(5399, 140)), {});
  assert.deepEqual(cleDerive(constante(8000, 200), constante(8000, 0)), {});
  assert.deepEqual(cleDerive(constante(8000, 40), constante(8000, 110)), {});
  assert.deepEqual(cleDerive([], []), {});
});
