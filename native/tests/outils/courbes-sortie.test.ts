import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { courbesDepuisStreams, moyennesParTranche } from '../../src/data/outils/courbes-sortie.ts';

const base64 = (flux: unknown) => Buffer.from(gzipSync(new TextEncoder().encode(JSON.stringify(flux)))).toString('base64');

test('courbes : une valeur par tranche de distance, toutes alignées', () => {
  const L = 400;
  const flux = {
    distance: { data: Array.from({ length: L }, (_, i) => i * 10) },
    heartrate: { data: Array.from({ length: L }, (_, i) => 120 + i / 10) },
    velocity_smooth: { data: Array.from({ length: L }, () => 3) },
    altitude: { data: Array.from({ length: L }, (_, i) => 150 + Math.sin(i / 20) * 10) },
  };
  const c = courbesDepuisStreams(base64(flux), 20)!;
  assert.equal(c.n, 20);
  assert.equal(c.km, 3.99);
  assert.equal(c.fc!.length, 20);
  assert.ok(c.fc![19] > c.fc![0]);
  assert.ok(Math.abs(c.vitesse![5] - 3) < 1e-9);
  assert.equal(c.cadence, undefined);
});

test('courbes : format liste [{type, data}] accepté, sans distance on découpe par durée', () => {
  const L = 100;
  const c = courbesDepuisStreams(base64([{ type: 'heartrate', data: Array.from({ length: L }, () => 150) }]), 10)!;
  assert.equal(c.km, null);
  assert.deepEqual(c.fc, new Array(10).fill(150));
});

test('courbes : flux vide, illisible ou trop court → null', () => {
  assert.equal(courbesDepuisStreams(null), null);
  assert.equal(courbesDepuisStreams('pas du base64 !'), null);
  assert.equal(courbesDepuisStreams(base64({ heartrate: { data: [150, 151] } })), null);
});

test('moyennes : les tranches vides prennent la valeur voisine, trop de trous → null', () => {
  assert.deepEqual(moyennesParTranche([10, 20, 30], [0, 1, 3], 4, () => true), [10, 20, 20, 30]);
  assert.equal(moyennesParTranche([10], [0], 10, () => true), null);
  assert.deepEqual(moyennesParTranche([0, 160, 170, 180], [0, 1, 2, 3], 4, (v) => v > 0), [160, 160, 170, 180]);
});
