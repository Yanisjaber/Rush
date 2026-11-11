import assert from 'node:assert/strict';
import test from 'node:test';
import { journeeSki, statsSki } from '../../src/data/outils/descentes-ski.ts';

// Une journée : 3 fois (remontée de 400 m à 1,5 m/s, descente de 390 m à 12 m/s), à 1 point par seconde
function journee(montees: number[], descentes: number[]) {
  const alt: number[] = [];
  const vit: number[] = [];
  let v = 1800;
  montees.forEach((m, k) => {
    for (let i = 0; i < 200; i++) {
      v += m / 200;
      alt.push(v);
      vit.push(1.5);
    }
    for (let i = 0; i < 40; i++) {
      v -= descentes[k] / 40;
      alt.push(v);
      vit.push(i === 20 ? 21.5 : 12);
    }
  });
  return { temps: alt.map((_, i) => i), altitude: alt, vitesse: vit };
}

test('statsSki : descentes, dénivelé descendu, vitesse max et altitude max', () => {
  const s = statsSki(journee([400, 400, 400], [390, 390, 390]));
  assert.ok(s);
  assert.equal(s.descentes, 3);
  assert.ok(Math.abs(s.descenteM - 1170) <= 60, `descendu ${s.descenteM}`);
  assert.equal(s.vmaxKmh, 77); // 21,5 m/s
  assert.ok(s.altMax! >= 2200 && s.altMax! <= 2230);
});

test('statsSki : une baisse de moins de 40 m compte dans le dénivelé mais pas comme descente', () => {
  const s = statsSki(journee([300, 300], [25, 25]));
  assert.equal(s?.descentes, 0);
  assert.ok(s!.descenteM >= 40);
});

test('statsSki : une baisse lente (remontée en traversée) n\'est pas une descente', () => {
  const j = journee([400], [100]);
  const lent = { ...j, vitesse: j.vitesse.map(() => 1) };
  assert.equal(statsSki(lent)?.descentes, 0);
});

test('statsSki : sans altitude, ou trop court, rien', () => {
  assert.equal(statsSki(undefined), null);
  assert.equal(statsSki({ temps: [0, 1], altitude: [1, 2] }), null);
  assert.equal(statsSki({ temps: [] }), null);
});

test('statsSki : le bruit de quelques mètres ne crée pas de descentes', () => {
  const alt = Array.from({ length: 200 }, (_, i) => 1500 + (i % 2 ? 2 : -2));
  const s = statsSki({ temps: alt.map((_, i) => i), altitude: alt, vitesse: alt.map(() => 5) });
  assert.equal(s?.descentes, 0);
  assert.equal(s?.descenteM, 0);
});

test('journeeSki : remontée, descente, remontée… dans l\'ordre, avec durées et dénivelés', () => {
  const e = journeeSki(journee([400, 400, 400], [390, 390, 390]));
  assert.ok(e);
  assert.deepEqual(e.map((x) => x.type), ['montee', 'descente', 'montee', 'descente', 'montee', 'descente']);
  assert.ok(e[0].dureeS >= 190 && e[0].dureeS <= 210, `montée ${e[0].dureeS} s`);
  assert.ok(Math.abs(e[0].deniveleM - 400) <= 30);
  assert.ok(e[1].deniveleM >= 360 && e[1].deniveleM <= 400);
  assert.equal(e[1].vmaxKmh, 77);
  assert.equal(e[0].vmaxKmh, null);
  assert.ok(e[2].debutS > e[1].debutS);
});

test('journeeSki : une petite baisse se fond dans la montée, sans altitude rien', () => {
  const e = journeeSki(journee([300, 300], [25, 25]));
  assert.ok(!e || e.every((x) => x.type === 'montee'));
  assert.equal(journeeSki(undefined), null);
  assert.equal(journeeSki({ temps: [0, 1], altitude: [1, 2] }), null);
});
