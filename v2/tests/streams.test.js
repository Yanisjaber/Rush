import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decoderStreams, extraireStream, reduire, statistiques, tempsParZone, ZONES_PUISSANCE, ZONES_CARDIO } from '../src/lib/data/streams.js';

const encoder = (objet) => zlib.gzipSync(Buffer.from(JSON.stringify(objet))).toString('base64');

test('decoderStreams : décompresse base64(gzip(JSON))', async () => {
  const original = [{ type: 'watts', data: [100, 200, 300] }, { type: 'time', data: [0, 1, 2] }];
  assert.deepEqual(await decoderStreams(encoder(original)), original);
});

test('extraireStream : tableau de streams, objet par type, absent ou piégé', () => {
  const tableau = [{ type: 'watts', data: [1, 2] }, { type: 'heartrate', data: [] }];
  assert.deepEqual(extraireStream(tableau, 'watts'), [1, 2]);
  assert.equal(extraireStream(tableau, 'heartrate'), null); // vide
  assert.equal(extraireStream(tableau, 'altitude'), null);
  assert.deepEqual(extraireStream({ watts: { data: [3, 4] } }, 'watts'), [3, 4]);
  assert.deepEqual(extraireStream({ watts: [5, 6] }, 'watts'), [5, 6]);
  assert.equal(extraireStream({ watts: [5] }, 'constructor'), null); // pas de propriété héritée
  assert.equal(extraireStream(null, 'watts'), null);
});

test('reduire : moyenne par paquets, garde les séries courtes, gère les trous', () => {
  assert.deepEqual(reduire([1, 2, 3, 4], 2), [1.5, 3.5]);
  assert.deepEqual(reduire([1, 2, 3], 10), [1, 2, 3]);
  assert.deepEqual(reduire([null, null, 4, 6], 2), [null, 5]);
  assert.equal(reduire(Array.from({ length: 10000 }, (_, i) => i), 300).length, 300);
  assert.deepEqual(reduire(null), []);
});

test('statistiques : moyenne et maximum, valeurs absentes ignorées', () => {
  assert.deepEqual(statistiques([100, null, 200, NaN, 300]), { moyenne: 200, max: 300 });
  assert.equal(statistiques([]), null);
  assert.equal(statistiques(null), null);
});

test('tempsParZone : puissance en pourcentage de la FTP', () => {
  // FTP 200 : 100 W = 50 % → Z1 ; 150 W = 75 % → Z3 (borne basse incluse) ; 190 W = 95 % → Z4 ; 400 W = 200 % → Z7
  const z = tempsParZone([100, 150, 190, 400], 200, ZONES_PUISSANCE);
  assert.equal(z.length, 7);
  assert.equal(z[0].secondes, 1);
  assert.equal(z[2].secondes, 1);
  assert.equal(z[3].secondes, 1);
  assert.equal(z[6].secondes, 1);
  assert.ok(Math.abs(z.reduce((a, b) => a + b.part, 0) - 1) < 1e-9);
});

test('tempsParZone : cardio, valeurs absentes ignorées, sans référence → null', () => {
  const z = tempsParZone([100, 130, 150, 170, 190, null], 200, ZONES_CARDIO);
  assert.equal(z.length, 5);
  assert.deepEqual(z.map((x) => x.secondes), [1, 1, 1, 1, 1]);
  assert.equal(tempsParZone([100], 0, ZONES_CARDIO), null);
  assert.equal(tempsParZone([100], null, ZONES_CARDIO), null);
  assert.equal(tempsParZone([], 200, ZONES_CARDIO), null);
});
