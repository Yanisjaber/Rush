import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donneesDemo, mesuresDemo, sommeilDemo } from '../src/data/demo.ts';
import { serieEtatDeForme } from '../src/data/forme-sante.ts';
import { consignesMasquees, construirePiliers, construireSuivis, ecartTexte, historiquePilier, texteValeur } from '../src/data/piliers.ts';
import { resoudreMesures } from '../src/data/sante-catalogue.ts';

const AUJOURDHUI = new Date(2026, 9, 20);
const nuits = sommeilDemo(AUJOURDHUI, 90);
const metriques = donneesDemo(AUJOURDHUI).metriques;
const mesures = resoudreMesures(mesuresDemo(AUJOURDHUI, 90));
const serie = serieEtatDeForme(nuits, metriques, mesures);

test('ecartTexte : l\'écart à ta moyenne, signé, sans référence suffisante = null', () => {
  const ref = Array.from({ length: 20 }, () => 60);
  assert.equal(ecartTexte(64, ref), '+4 vs ta moyenne');
  assert.equal(ecartTexte(46, ref), '−14 vs ta moyenne'); // un vrai signe moins, pas un tiret
  assert.equal(ecartTexte(60, ref), 'Comme ta moyenne');
  assert.equal(ecartTexte(60, [60, 61]), null); // moins de 10 valeurs
  assert.equal(ecartTexte(NaN, ref), null);
});

test('construirePiliers : triés du plus bas au plus haut, une valeur et une courbe par pilier, un détail ouvrable', () => {
  const piliers = construirePiliers(nuits, metriques, mesures, serie);
  assert.deepEqual(piliers.map((p) => p.cle).sort(), ['charge', 'fc', 'hrv', 'resp', 'ressenti', 'sommeil', 'stress', 'temperature']);
  const indices = piliers.map((p) => p.indice as number);
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b)); // du plus bas au plus haut
  for (const p of piliers) {
    assert.notEqual(p.valeur, '—', p.cle);
    assert.ok(p.courbe.length > 1 && p.courbe.length <= 14, p.cle);
    assert.ok(p.vers.startsWith('/sante/'), p.cle);
    assert.equal(p.manquant, null);
    assert.ok(p.niveau != null);
  }
  // une valeur de chaque pilier est cohérente avec sa nature
  const par = Object.fromEntries(piliers.map((p) => [p.cle, p]));
  assert.equal(par.sommeil.unite, '/100');
  assert.equal(par.hrv.unite, 'ms');
  assert.equal(par.fc.unite, 'bpm');
  assert.equal(par.resp.unite, 'resp/min');
  assert.ok(par.charge.valeur.startsWith('+') || par.charge.valeur.startsWith('−') || par.charge.valeur === '0');
});

test('construirePiliers : sans appareil, la respiration et la température sont masquées et leurs consignes listées à part', () => {
  const sansAppareil = Object.fromEntries(Object.entries(mesures).map(([d, m]) => [d, Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'resp_nuit' && k !== 'temp_cutanee_ecart'))]));
  const s = serieEtatDeForme(nuits, metriques, sansAppareil);
  const piliers = construirePiliers(nuits, metriques, sansAppareil, s);
  assert.ok(!piliers.some((p) => p.cle === 'resp' || p.cle === 'temperature'));
  assert.equal(consignesMasquees(piliers, s[s.length - 1]).length, 2);
});

test('construirePiliers : un pilier sans donnée passe à la fin avec sa consigne ; sans série, rien', () => {
  const sansRessenti = Object.fromEntries(Object.entries(mesures).map(([d, m]) => [d, Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('ressenti_')))]));
  const s = serieEtatDeForme(nuits, metriques, sansRessenti);
  const piliers = construirePiliers(nuits, metriques, sansRessenti, s);
  const dernier = piliers[piliers.length - 1];
  assert.equal(dernier.cle, 'ressenti');
  assert.equal(dernier.valeur, '—');
  assert.ok(dernier.manquant && dernier.manquant.length > 5);
  assert.equal(dernier.indice, null);
  assert.deepEqual(construirePiliers(nuits, metriques, mesures, []), []);
});

test('construireSuivis : le poids lissé et sa tendance, les calories moyennes et les protéines par kilo ; sans donnée, la consigne', () => {
  const [corps, nutrition] = construireSuivis(mesures, '2026-10-20');
  assert.equal(corps.cle, 'corps');
  assert.equal(corps.unite, 'kg');
  assert.ok(/^\d+,\d$/.test(corps.valeur), corps.valeur);
  assert.ok(corps.ecart && corps.ecart.includes('par semaine'), String(corps.ecart));
  assert.ok(corps.courbe.length > 1 && corps.courbe.length <= 14);
  assert.equal(nutrition.unite, 'kcal par jour');
  assert.ok(nutrition.ecart && nutrition.ecart.includes('g/kg'));
  const [c2, n2] = construireSuivis({}, '2026-10-20');
  assert.equal(c2.valeur, '—');
  assert.ok(c2.manquant && n2.manquant);
});

test('historiquePilier et texteValeur : les séries de chaque pilier et leur écriture', () => {
  for (const cle of ['sommeil', 'hrv', 'fc', 'stress', 'ressenti', 'charge', 'resp', 'temperature'] as const) {
    assert.ok(historiquePilier(cle, nuits, metriques, mesures).length > 10, cle);
  }
  assert.deepEqual(historiquePilier('hrv', null, null, null), []);
  assert.equal(texteValeur('hrv', 49.4), '49');
  assert.equal(texteValeur('charge', 7), '+7');
  assert.equal(texteValeur('charge', -12), '−12');
  assert.equal(texteValeur('resp', 14.25), '14,3');
  assert.equal(texteValeur('temperature', -0.3), '−0,3');
});
