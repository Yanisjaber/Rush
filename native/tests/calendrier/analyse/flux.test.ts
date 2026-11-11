import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allureFenetre, arrets, debutDerive, flux1Hz, kmA, moyenne, percentile, tempsParZoneCoeur } from '../../../src/data/calendrier/analyse/flux.ts';

// Une sortie : n secondes, une fonction pour la vitesse et le cœur à chaque seconde
const sortie = (n: number, vitesse: (i: number) => number, fc: (i: number) => number, w?: (i: number) => number) => ({
  temps: Array.from({ length: n }, (_, i) => i),
  vitesse: Array.from({ length: n }, (_, i) => vitesse(i)),
  fc: Array.from({ length: n }, (_, i) => fc(i)),
  ...(w ? { watts: Array.from({ length: n }, (_, i) => w(i)) } : {}),
});

test('flux1Hz : mêmes secondes qu\'en entrée quand tout est déjà à 1 Hz', () => {
  const f = flux1Hz(sortie(600, () => 3, () => 150))!;
  assert.equal(f.n, 600);
  assert.equal(f.pauseS, 0);
  assert.equal(f.v[10], 3);
});

test('flux1Hz : un enregistrement toutes les 2 s tient chaque valeur 2 s ; une longue pause est retirée', () => {
  const t = [...Array.from({ length: 100 }, (_, i) => i * 2), ...Array.from({ length: 100 }, (_, i) => 200 + 600 + i * 2)];
  const f = flux1Hz({ temps: t, vitesse: t.map(() => 3), fc: t.map(() => 150) })!;
  // 200 points tenus 2 s = 400 s, la pause de 600 s n'est pas dans l'échelle (une seconde garde la place du trou)
  assert.ok(f.n >= 396 && f.n <= 402, String(f.n));
  assert.ok(f.pauseS >= 590);
});

test('flux1Hz : refus (null) sans vitesse, trop court, ou temps qui ne croissent pas', () => {
  assert.equal(flux1Hz(null), null);
  assert.equal(flux1Hz({ temps: [0, 1], vitesse: [3, 3] }), null);
  assert.equal(flux1Hz({ temps: Array.from({ length: 100 }, () => 5), vitesse: new Array(100).fill(3) }), null);
});

test('flux1Hz : les valeurs absurdes deviennent « inconnu » (cœur 0, puissance 0, vitesse 0)', () => {
  const f = flux1Hz(sortie(120, () => 3, (i) => (i === 10 ? 999 : 150), (i) => (i === 10 ? 99999 : 200)))!;
  assert.equal(f.fc[10], 0);
  assert.equal(f.w[10], 0);
  assert.equal(f.fc[11], 150);
});

test('moyenne, allureFenetre, percentile, kmA', () => {
  const f = flux1Hz(sortie(600, () => 4, (i) => (i < 300 ? 140 : 0)))!;
  assert.equal(moyenne(f.fc, 0, 600), 140); // les 0 sont ignorés
  assert.equal(moyenne(f.fc, 400, 500), null);
  assert.equal(allureFenetre(f.v, 0, 600), 250); // 4 m/s = 250 s/km
  assert.equal(kmA(f, 500), 2);
  assert.equal(percentile([100, 120, 140, 160, 180], 0.5), 140);
  assert.equal(percentile([0, 0], 0.5), null);
});

test('arrets : un feu rouge de 30 s est repéré avec le kilomètre où il a eu lieu', () => {
  const f = flux1Hz(sortie(900, (i) => (i >= 400 && i < 430 ? 0 : 4), () => 150))!;
  const a = arrets(f);
  assert.equal(a.length, 1);
  assert.equal(a[0].dureeS, 30);
  assert.ok(Math.abs(a[0].km - 1.6) < 0.01); // 400 s à 4 m/s
  assert.equal(arrets(flux1Hz(sortie(900, (i) => (i >= 400 && i < 405 ? 0 : 4), () => 150))!).length, 0); // 5 s : pas un arrêt
});

test('tempsParZoneCoeur : sans cœur, rien ne compte', () => {
  const f = flux1Hz(sortie(600, () => 3, (i) => (i < 200 ? 120 : i < 400 ? 160 : 0)))!;
  assert.deepEqual(tempsParZoneCoeur(f, [0, 140, 170]), [200, 200, 0]);
});

test('debutDerive : le cœur monte à vitesse constante à partir de 15 min, repéré à ±5 min', () => {
  const f = flux1Hz(sortie(2100, () => 3, (i) => (i < 900 ? 150 : 150 + (i - 900) * 0.03)))!;
  const d = debutDerive(f, 'vitesse')!;
  assert.ok(d, 'une dérive attendue');
  assert.ok(d.debutS >= 900 && d.debutS <= 1500, String(d.debutS));
  assert.ok(d.km > 2.5 && d.km < 4.6);
});

test('debutDerive : un cœur stable ne dérive pas ; une sortie courte non plus', () => {
  assert.equal(debutDerive(flux1Hz(sortie(2100, () => 3, () => 150))!, 'vitesse'), null);
  assert.equal(debutDerive(flux1Hz(sortie(900, () => 3, (i) => 150 + i * 0.1))!, 'vitesse'), null);
});
