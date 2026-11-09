import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { deBase64, traceDepuisListes, traceDepuisReponse, traceDepuisStreams } from '../../src/data/outils/trace-sortie.ts';
import { enBase64 } from '../../src/data/calendrier/import-activite.ts';

const pos = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [43.5 + i * 1e-4, 1.4 + i * 1e-4]);
const alt = (n: number) => Array.from({ length: n }, (_, i) => 150 + (i % 5));
const dis = (n: number) => Array.from({ length: n }, (_, i) => i * 10);
const stocke = (flux: unknown) => enBase64(gzipSync(new TextEncoder().encode(JSON.stringify(flux))));

test('deBase64 : va-retour avec enBase64, et chaîne invalide = rien', () => {
  const octets = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
  assert.deepEqual(deBase64(enBase64(octets)), octets);
  assert.equal(deBase64('pas du base64 !!').length, 0);
});

test('traceDepuisListes : listes alignées, positions invalides écartées avec leurs valeurs', () => {
  const p: unknown[] = pos(5);
  p[1] = [200, 1];
  p[2] = null;
  const t = traceDepuisListes(p, alt(5), dis(5))!;
  assert.equal(t.latlng.length, 3);
  assert.deepEqual(t.distance, [0, 30, 40]);
});

test('traceDepuisListes : allège une très longue trace et garde les extrémités', () => {
  const t = traceDepuisListes(pos(20000), alt(20000), dis(20000))!;
  assert.equal(t.latlng.length, 5000);
  assert.equal(t.altitude.length, 5000);
  assert.equal(t.distance[0], 0);
  assert.equal(t.distance[4999], 19999 * 10);
});

test('traceDepuisListes : sans altitude ni distance la trace reste ; pas de trace sans 2 positions', () => {
  const t = traceDepuisListes(pos(10), undefined, null)!;
  assert.equal(t.latlng.length, 10);
  assert.deepEqual(t.altitude, []);
  assert.equal(traceDepuisListes(pos(1), alt(1), dis(1)), null);
  assert.equal(traceDepuisListes('texte', null, null), null);
});

test('traceDepuisReponse : revérifie tout ce qui vient du réseau', () => {
  assert.equal(traceDepuisReponse(null), null);
  assert.equal(traceDepuisReponse({ ok: true, trace: null }), null);
  assert.equal(traceDepuisReponse({ ok: true, trace: 'x' }), null);
  assert.equal(traceDepuisReponse({ trace: { latlng: [[999, 0], [0, 999]] } }), null);
  assert.equal(traceDepuisReponse({ ok: true, trace: { latlng: pos(8), altitude: alt(8), distance: dis(8) } })!.latlng.length, 8);
});

test('traceDepuisStreams : les deux formats stockés (tableau et objet)', () => {
  const tableau = stocke([
    { type: 'latlng', data: pos(6) },
    { type: 'altitude', data: alt(6) },
    { type: 'distance', data: dis(6) },
  ]);
  const objet = stocke({ latlng: { data: pos(6) }, altitude: alt(6), distance: { data: dis(6) } });
  for (const s of [tableau, objet]) {
    const t = traceDepuisStreams(s)!;
    assert.equal(t.latlng.length, 6);
    assert.equal(t.altitude.length, 6);
    assert.equal(t.distance.length, 6);
  }
});

test('traceDepuisStreams : sans positions (sortie Strava synchronisée), vide ou illisible, jamais d\'exception', () => {
  assert.equal(traceDepuisStreams(stocke([{ type: 'altitude', data: alt(10) }, { type: 'time', data: dis(10) }])), null);
  assert.equal(traceDepuisStreams(null), null);
  assert.equal(traceDepuisStreams(''), null);
  assert.equal(traceDepuisStreams('%%%'), null);
  assert.equal(traceDepuisStreams(enBase64(new TextEncoder().encode('pas du gzip'))), null);
});
