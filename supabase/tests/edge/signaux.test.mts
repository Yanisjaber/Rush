// Test du calcul des courbes de signaux du vélo (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/signaux.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSignaux, medianeGlissante, meilleureMoyenne, meilleureVariation, reechantillonnerContinu, SIGNAUX_VERSION } from '../../functions/_shared/signaux.ts';

const secondes = (n: number) => Array.from({ length: n }, (_, i) => i);
const constante = (n: number, v: number) => new Array(n).fill(v);

test('meilleureMoyenne : la meilleure fenêtre, pas la moyenne de la séance', () => {
  const serie = [...constante(600, 100), ...constante(300, 200), ...constante(600, 100)];
  const c = meilleureMoyenne(serie, [60, 300, 1200]);
  assert.equal(c['60'], 200);
  assert.equal(c['300'], 200);
  assert.equal(c['1200'], Math.round((300 * 200 + 900 * 100) / 1200)); // 125 : la fenêtre de 20 min contient les 5 min fortes
  assert.equal(Object.keys(meilleureMoyenne(serie, [3600])).length, 0); // séance plus courte que la durée : rien
});

test('meilleureVariation : la montée nette ramenée à l\'heure, et la descente avec le sens inverse', () => {
  const alt = [...Array.from({ length: 601 }, (_, i) => i * 0.5), ...Array.from({ length: 601 }, (_, i) => 300 - i * 0.5)]; // +300 m en 10 min puis -300 m
  assert.equal(meilleureVariation(alt, [600], 1)['600'], 1800); // 300 m en 10 min = 1 800 m/h
  assert.equal(meilleureVariation(alt, [600], -1)['600'], 1800);
  assert.equal(Object.keys(meilleureVariation(alt.slice(0, 601), [600], -1)).length, 0); // rien ne descend
});

test('reechantillonnerContinu : un trou garde la dernière altitude (pas de zéro)', () => {
  const r = reechantillonnerContinu([100, 100, 120], [0, 1, 6]);
  assert.deepEqual(r, [100, 100, 100, 100, 100, 100, 120].slice(0, 7));
  assert.equal(r.length, 7);
});

test('medianeGlissante : un saut de quelques secondes disparaît', () => {
  const s = medianeGlissante([0, 0, 0, 30, 30, 0, 0, 0, 0], 5);
  assert.equal(Math.max(...s), 0);
});

test('calculerSignaux : FC, cadence, couple, vitesse, VAM et descente sur une séance simple', () => {
  const n = 1800;
  const flux = {
    time: secondes(n),
    heartrate: constante(n, 150),
    cadence: constante(n, 90),
    watts: constante(n, 200),
    velocity_smooth: constante(n, 10), // 36 km/h
    altitude: secondes(n).map((i) => i * 0.2), // 12 m/min = 720 m/h, aucune descente
  };
  const c = calculerSignaux(flux);
  assert.equal(c.v, SIGNAUX_VERSION);
  assert.equal(c.fc!['300'], 150);
  assert.equal(c.cad!['1200'], 90);
  assert.equal(c.vit!['600'], 36);
  assert.equal(c.cou!['300'], Math.round((200 / ((90 * 2 * Math.PI) / 60)) * 10) / 10); // 21,2 N·m
  assert.equal(c.vam!['600'], 720);
  assert.equal(c.des, undefined);
});

test('calculerSignaux : une pointe de capteur à 233 bpm ne compte pas', () => {
  const n = 600;
  const fc = constante(n, 140);
  for (let i = 100; i < 200; i++) fc[i] = 233;
  const c = calculerSignaux({ time: secondes(n), heartrate: fc });
  assert.ok(c.fc!['60'] <= 140);
});

test('calculerSignaux : sans cadence, ni cadence ni couple ; sans données, que la version', () => {
  const n = 600;
  const c = calculerSignaux({ time: secondes(n), watts: constante(n, 200), heartrate: constante(n, 130) });
  assert.equal(c.cad, undefined);
  assert.equal(c.cou, undefined);
  assert.deepEqual(calculerSignaux({}), { v: SIGNAUX_VERSION });
});

test('calculerSignaux : le couple ignore les secondes sans pédalage', () => {
  const n = 600;
  const cad = [...constante(300, 90), ...constante(300, 0)];
  const c = calculerSignaux({ time: secondes(n), watts: constante(n, 200), cadence: cad });
  assert.equal(c.cou!['300'], Math.round((200 / ((90 * 2 * Math.PI) / 60)) * 10) / 10);
  assert.ok(c.cou!['600'] < c.cou!['300']); // la fenêtre de 10 min contient 5 min d'arrêt
});

test('calculerSignaux : les durées courtes (5 s, 30 s) existent pour les signaux, la VAM et la descente à partir de 30 s', () => {
  const n = 900;
  const c = calculerSignaux({ time: secondes(n), heartrate: constante(n, 150), cadence: constante(n, 90), velocity_smooth: constante(n, 10), altitude: secondes(n).map((i) => 1000 - i * 0.2) });
  for (const d of ['1', '2', '3', '4', '5']) assert.equal(c.fc![d], 150);
  assert.equal(c.cad!['30'], 90);
  assert.equal(c.vit!['5'], 36);
  assert.equal(c.des!['30'], 720);
  assert.equal(c.vam, undefined);
  assert.equal(c.des!['5'], undefined);
});

test('calculerSignaux : une pointe de cadence à 250 tr/min ne compte pas', () => {
  const n = 120;
  const cad = constante(n, 90);
  for (let i = 20; i < 50; i++) cad[i] = 250;
  const c = calculerSignaux({ time: secondes(n), cadence: cad });
  assert.ok(c.cad!['30'] <= 90);
});

test('calculerSignaux : un saut d\'altitude de 90 m sur 4 secondes ne fait pas un record de VAM', () => {
  const n = 300;
  const alt = constante(n, 500);
  for (let i = 100; i < 104; i++) alt[i] = 590;
  const c = calculerSignaux({ time: secondes(n), altitude: alt });
  assert.equal(c.vam, undefined);
  assert.equal(c.des, undefined);
});

test('meilleureVariation : une montée trop rapide pour être vraie est écartée par le plafond', () => {
  const alt = secondes(120).map((i) => i * 3); // 3 m/s, soit 10 800 m/h
  assert.equal(meilleureVariation(alt, [30], 1, 1.3)['30'], undefined);
  assert.equal(meilleureVariation(alt, [30], 1)['30'], 10800);
});

test('calculerSignaux : les signaux ont les mêmes durées que la puissance (44), la VAM et la descente à partir de 30 s', () => {
  const n = 4000;
  const c = calculerSignaux({ time: secondes(n), heartrate: constante(n, 150), altitude: secondes(n).map((i) => 1000 - i * 0.2) });
  assert.equal(Object.keys(c.fc!).length, 37); // les durées de la liste qui tiennent dans 4 000 s
  assert.equal(c.fc!['7'], 150);
  assert.equal(c.fc!['75'], 150);
  assert.equal(c.fc!['3600'], 150);
  assert.equal(c.des!['25'], undefined);
  assert.equal(c.des!['40'], 720);
});
