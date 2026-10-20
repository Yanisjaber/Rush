import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defMesure, FAMILLES, MESURES, mesuresDe, PRIORITE_SOURCES, remplacerSaisie, resoudreMesures, valeurValide } from '../src/data/sante-catalogue.ts';

test('catalogue : chaque mesure a des bornes cohérentes, une famille connue et une clé valide pour la base', () => {
  for (const [cle, m] of Object.entries(MESURES)) {
    assert.equal(m.cle, cle);
    assert.ok(/^[a-z][a-z0-9_]{1,39}$/.test(cle), `${cle} : clé acceptée par la contrainte SQL`);
    assert.ok(m.min < m.max && m.pas > 0, cle);
    assert.ok(Object.hasOwn(FAMILLES, m.famille), cle);
    if (m.libelles) assert.equal(m.libelles.length, m.max - m.min + 1, `${cle} : un libellé par valeur`);
  }
  assert.equal(mesuresDe('ressenti').length, 5);
  assert.equal(defMesure('inconnue'), null);
  assert.equal(defMesure('__proto__'), null);
  assert.equal(defMesure('constructor'), null);
});

test('valeurValide : bornes, arrondi au pas, virgule française, refus plutôt que correction', () => {
  assert.equal(valeurValide('poids_kg', 72.44), 72.4);
  assert.equal(valeurValide('poids_kg', '72,46'), 72.5);
  assert.equal(valeurValide('poids_kg', 700), null); // faute de frappe
  assert.equal(valeurValide('poids_kg', 5), null);
  assert.equal(valeurValide('poids_kg', ''), null);
  assert.equal(valeurValide('poids_kg', null), null);
  assert.equal(valeurValide('poids_kg', 'abc'), null);
  assert.equal(valeurValide('poids_kg', Infinity), null);
  assert.equal(valeurValide('poids_kg', true), null);
  assert.equal(valeurValide('ressenti_fatigue', 3.4), 3);
  assert.equal(valeurValide('ressenti_fatigue', 0), null);
  assert.equal(valeurValide('ressenti_fatigue', 6), null);
  assert.equal(valeurValide('evt_malade', 1), 1);
  assert.equal(valeurValide('evt_malade', 2), null);
  assert.equal(valeurValide('cycle_phase', 5), null);
  assert.equal(valeurValide('inconnue', 1), null);
  assert.equal(valeurValide('temp_cutanee_ecart', -0.34), -0.3);
});

test('resoudreMesures : une valeur par jour et par mesure, la source la plus prioritaire gagne', () => {
  assert.deepEqual(PRIORITE_SOURCES, ['manual', 'apple_sante', 'whoop', 'garmin', 'strava']);
  const r = resoudreMesures([
    { date: '2026-10-20', metric: 'poids_kg', value: 72.9, source: 'apple_sante' },
    { date: '2026-10-20', metric: 'poids_kg', value: 72.1, source: 'manual' }, // la saisie manuelle l'emporte
    { date: '2026-10-20', metric: 'poids_kg', value: 73.5, source: 'garmin' },
    { date: '2026-10-21', metric: 'poids_kg', value: 72.0, source: 'garmin' },
    { date: '2026-10-21', metric: 'resp_nuit', value: 14.2, source: 'whoop' },
  ]);
  assert.deepEqual(r, { '2026-10-20': { poids_kg: 72.1 }, '2026-10-21': { poids_kg: 72, resp_nuit: 14.2 } });
});

test('resoudreMesures : ignore ce qui est invalide (mesure inconnue, valeur hors bornes, source inconnue, date mal formée)', () => {
  const r = resoudreMesures([
    { date: '2026-10-20', metric: 'inconnue', value: 1, source: 'manual' },
    { date: '2026-10-20', metric: 'poids_kg', value: 900, source: 'manual' },
    { date: '2026-10-20', metric: 'poids_kg', value: 70, source: 'pirate' },
    { date: '20/10/2026', metric: 'poids_kg', value: 70, source: 'manual' },
    { date: '2026-10-20', metric: 'poids_kg', value: 70, source: 'manual' },
  ]);
  assert.deepEqual(r, { '2026-10-20': { poids_kg: 70 } });
  assert.deepEqual(resoudreMesures(null), {});
  assert.deepEqual(resoudreMesures([]), {});
});

test('remplacerSaisie : la saisie remplace l\'ancienne, null l\'efface, un appareil n\'est jamais touché, une valeur invalide ne change rien', () => {
  const base = [
    { date: '2026-10-20', metric: 'poids_kg', value: 72, source: 'manual' },
    { date: '2026-10-20', metric: 'poids_kg', value: 72.5, source: 'apple_sante' },
    { date: '2026-10-19', metric: 'poids_kg', value: 73, source: 'manual' },
  ];
  const apres = remplacerSaisie(base, '2026-10-20', 'poids_kg', 71.26);
  assert.equal(apres.filter((l) => l.date === '2026-10-20' && l.source === 'manual')[0].value, 71.3); // arrondi au pas de 0,1
  assert.equal(apres.length, 3);
  assert.ok(apres.some((l) => l.source === 'apple_sante' && l.value === 72.5)); // l'appareil reste
  assert.equal(remplacerSaisie(base, '2026-10-20', 'poids_kg', null).length, 2);
  assert.equal(remplacerSaisie(base, '2026-10-20', 'poids_kg', 700), base); // hors bornes : rien ne change
  assert.equal(base.length, 3); // la liste d'origine n'est jamais modifiée
  assert.equal(remplacerSaisie([], '2026-10-20', 'ressenti_humeur', 4).length, 1);
});
