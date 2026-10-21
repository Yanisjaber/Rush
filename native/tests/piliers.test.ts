import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donneesDemo, mesuresDemo, sommeilDemo } from '../src/data/demo.ts';
import { serieEtatDeForme } from '../src/data/forme-sante.ts';
import { construirePiliers, construireSuivis, ecartTexte, historiquePilier, motifsDuJour, NOM_COURT, texteValeur } from '../src/data/piliers.ts';
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
  // Les cinq piliers d'abord, du plus bas au plus haut ; puis les trois éléments surveillés (stress, respiration, température), eux aussi du plus bas au plus haut
  assert.deepEqual(piliers.slice(0, 5).map((p) => p.surveille), [false, false, false, false, false]);
  assert.deepEqual(piliers.slice(5).map((p) => p.cle).sort(), ['resp', 'stress', 'temperature']);
  for (const groupe of [piliers.slice(0, 5), piliers.slice(5)]) {
    const indices = groupe.map((p) => p.indice as number);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  }
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

test('construirePiliers : sans appareil, la respiration et la température sont masquées (surveillées, sans ligne vide)', () => {
  const sansAppareil = Object.fromEntries(Object.entries(mesures).map(([d, m]) => [d, Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'resp_nuit' && k !== 'temp_cutanee_ecart'))]));
  const s = serieEtatDeForme(nuits, metriques, sansAppareil);
  const piliers = construirePiliers(nuits, metriques, sansAppareil, s);
  assert.ok(!piliers.some((p) => p.cle === 'resp' || p.cle === 'temperature'));
  assert.ok(piliers.some((p) => p.cle === 'stress' && p.surveille)); // le stress de nuit vient de la montre : il reste
  assert.deepEqual(s[s.length - 1].manquants, []); // ces deux-là ne sont pas des piliers : ils ne rendent pas l'estimation « moins précise »
});

test('construirePiliers : un pilier sans donnée passe à la fin avec sa consigne ; sans série, rien', () => {
  const sansRessenti = Object.fromEntries(Object.entries(mesures).map(([d, m]) => [d, Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('ressenti_')))]));
  const s = serieEtatDeForme(nuits, metriques, sansRessenti);
  const piliers = construirePiliers(nuits, metriques, sansRessenti, s);
  const principaux = piliers.filter((p) => !p.surveille);
  const dernier = principaux[principaux.length - 1];
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

test('motifsDuJour : les écarts qui ont le plus d\'effet, signés, au plus trois, classés par impact', () => {
  const piliers = construirePiliers(nuits, metriques, mesures, serie);
  const motifs = motifsDuJour(piliers);
  assert.ok(motifs.length >= 1 && motifs.length <= 3);
  for (const m of motifs) {
    assert.ok(/^[+−]\d+$/.test(m.delta), m.delta);
    assert.equal(m.nom, NOM_COURT[m.cle]);
    assert.ok(m.vers.startsWith('/sante/'));
  }
  // classés du plus fort au plus faible impact
  const impact = (cle: string) => {
    const p = piliers.find((x) => x.cle === cle)!;
    return Math.abs((p.indice as number) - 50) * p.poids;
  };
  const impacts = motifs.map((m) => impact(m.cle));
  assert.deepEqual(impacts, [...impacts].sort((a, b) => b - a));
  assert.equal(motifsDuJour(piliers, 1).length, 1);
  assert.deepEqual(motifsDuJour([]), []);
  // un pilier sans écart connu (la charge dit « Équilibré », le ressenti n'a pas de référence) n'apparaît jamais
  assert.ok(!motifs.some((m) => m.cle === 'charge' || m.cle === 'ressenti'));
  // les éléments surveillés (stress, respiration, température) ne comptent pas dans le chiffre : jamais dans les motifs
  assert.ok(!motifs.some((m) => m.cle === 'stress' || m.cle === 'resp' || m.cle === 'temperature'));
});
