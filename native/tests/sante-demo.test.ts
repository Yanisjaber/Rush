import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mesuresDemo } from '../src/data/demo/demo.ts';
import { defMesure, resoudreMesures, valeurValide } from '../src/data/sante/sante-catalogue.ts';
import { serieEtatDeForme } from '../src/data/sante/forme-sante.ts';
import { donneesDemo, sommeilDemo } from '../src/data/demo/demo.ts';

const AUJOURDHUI = new Date(2026, 9, 20);

test('mesuresDemo : déterministe, et chaque ligne est valide pour le catalogue et pour la base', () => {
  const a = mesuresDemo(AUJOURDHUI, 90);
  assert.deepEqual(a, mesuresDemo(AUJOURDHUI, 90));
  assert.ok(a.length > 800);
  for (const l of a) {
    assert.ok(defMesure(l.metric), l.metric);
    assert.equal(valeurValide(l.metric, l.value), l.value, `${l.metric} = ${l.value} hors bornes`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(l.date));
    assert.ok(['manual', 'apple_sante', 'whoop'].includes(l.source));
  }
  // jamais deux fois la même mesure du même jour pour la même source (contrainte d'unicité de la table)
  const cles = a.map((l) => `${l.date}|${l.metric}|${l.source}`);
  assert.equal(new Set(cles).size, cles.length);
});

test('mesuresDemo : toutes les familles sauf le cycle, la maladie et la blessure aux bons jours, la priorité des sources visible', () => {
  const a = mesuresDemo(AUJOURDHUI, 90);
  const metrics = new Set(a.map((l) => l.metric));
  for (const m of ['ressenti_fatigue', 'evt_malade', 'evt_blesse', 'evt_voyage', 'alcool_verres', 'poids_kg', 'masse_grasse_pct', 'tension_sys', 'calories_kcal', 'proteines_g', 'eau_l', 'resp_nuit', 'temp_cutanee_ecart']) assert.ok(metrics.has(m), m);
  assert.ok(!metrics.has('cycle_phase'));
  assert.equal(a.filter((l) => l.metric === 'evt_malade').length, 3);
  // le poids vient tantôt de ta saisie, tantôt d'Apple Santé : la résolution garde une seule valeur par jour
  const sources = new Set(a.filter((l) => l.metric === 'poids_kg').map((l) => l.source));
  assert.deepEqual([...sources].sort(), ['apple_sante', 'manual']);
  const resolu = resoudreMesures(a);
  assert.equal(Object.keys(resolu).length, 90);
});

test('mesuresDemo avec les nuits d\'exemple : un état de forme avec une précision, et les freins aux bons jours', () => {
  const nuits = sommeilDemo(AUJOURDHUI, 90);
  const metriques = donneesDemo(AUJOURDHUI).metriques;
  const serie = serieEtatDeForme(nuits, metriques, resoudreMesures(mesuresDemo(AUJOURDHUI, 90)));
  const dernier = serie[serie.length - 1];
  assert.notEqual(dernier.indice, null);
  assert.equal(dernier.precision, 'elevee'); // HRV, sommeil, FC, stress, charge, ressenti, respiration et température
  const malade = serie.find((p) => p.freins.some((f) => f.startsWith('Malade')));
  assert.ok(malade && (malade.indice as number) <= 35);
  assert.ok(serie.some((p) => p.freins.some((f) => f.startsWith('Blessé'))));
  assert.ok(serie.some((p) => p.contexte.length > 0)); // de l'alcool ou un voyage
});
