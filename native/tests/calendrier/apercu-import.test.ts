import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apercuImport, echantillonner, profilAltitude, regionDeTrace } from '../../src/data/calendrier/apercu-import.ts';
import type { ActiviteImportee } from '../../src/data/calendrier/import-activite.ts';

const base = (): ActiviteImportee => ({ type: 'Ride', debut: null, dureeS: 3600, distanceKm: 30, denivele: 250, fc: 140, nom: '', flux: [], tours: [], extras: null });

test('echantillonner : garde le premier et le dernier, jamais plus que demandé', () => {
  const l = Array.from({ length: 1000 }, (_, i) => i);
  const e = echantillonner(l, 50);
  assert.equal(e.length, 50);
  assert.equal(e[0], 0);
  assert.equal(e[49], 999);
  assert.deepEqual(echantillonner([1, 2, 3], 10), [1, 2, 3]);
  assert.deepEqual(echantillonner([], 5), []);
});

test('regionDeTrace : centre, marge, et jamais plus étroite que ~400 m', () => {
  assert.equal(regionDeTrace([]), null);
  const r = regionDeTrace([{ latitude: 43, longitude: 1 }, { latitude: 43.1, longitude: 1.2 }]);
  assert.ok(r && Math.abs(r.latitude - 43.05) < 1e-9 && Math.abs(r.longitude - 1.1) < 1e-9);
  assert.ok(r && Math.abs(r.latitudeDelta - 0.14) < 1e-9 && Math.abs(r.longitudeDelta - 0.28) < 1e-9);
  const point = regionDeTrace([{ latitude: 43, longitude: 1 }]);
  assert.equal(point?.latitudeDelta, 0.004);
});

test('profilAltitude : pas réguliers en distance (une pause ne l\'étire pas) et altitude manquante reprise', () => {
  // 100 points arrêtés (même distance) puis 100 points qui avancent : en distance, la pause ne pèse qu'un point
  const alt = [...Array(100).fill(100), ...Array.from({ length: 100 }, (_, i) => 100 + i)];
  const dist = [...Array(100).fill(0), ...Array.from({ length: 100 }, (_, i) => (i + 1) * 10)];
  const p = profilAltitude(alt, dist, 11);
  assert.equal(p.length, 11);
  assert.ok(p[1] > 100 && p[1] < 115); // dès le deuxième pas, on a déjà avancé
  assert.equal(p[10], 199);
  assert.deepEqual(profilAltitude([null, 5, null, 7], null, 10), [5, 5, 5, 7]);
  assert.deepEqual(profilAltitude([null, null], null), []);
});

test('apercuImport : sans flux, seulement les chiffres', () => {
  const r = apercuImport(base(), 'Ride');
  assert.deepEqual(r.trace, []);
  assert.equal(r.region, null);
  assert.deepEqual(r.profil, []);
  assert.deepEqual(r.stats.map((s) => s.libelle), ['Distance', 'Durée', 'Dénivelé +', 'Vitesse moy.', 'FC moy.']);
  assert.equal(r.stats[0].valeur, '30,0 km');
  assert.equal(r.stats[1].valeur, '1h00');
  assert.equal(r.stats[3].valeur, '30,0 km/h');
});

test('apercuImport : course (allure), natation (mètres), vélo avec puissance (FC max, puissance norm. et tours ne sont pas montrés)', () => {
  assert.equal(apercuImport({ ...base(), distanceKm: 10, dureeS: 3000 }, 'Run').stats.find((s) => s.libelle === 'Allure')?.valeur, `5'00"/km`);
  const nage = apercuImport({ ...base(), distanceKm: 1.5, dureeS: 2400 }, 'Swim').stats;
  assert.equal(nage[0].valeur, '1 500 m');
  assert.equal(nage.some((s) => /Allure|Vitesse/.test(s.libelle)), false);
  const velo = apercuImport(
    { ...base(), distanceKm: 119.33, extras: { avg_watts: 148, max_watts: 995, np: 182, max_heartrate: 189, avg_cadence: 76, calories: 1, kj: 1, avg_speed_kmh: 25.8 }, tours: [1, 2].map((i) => ({ index: i, name: 'T', elapsed_time: 1, moving_time: 1, distance: 1 })) },
    'Ride',
  ).stats;
  assert.deepEqual(velo.map((s) => `${s.libelle}=${s.valeur}`), ['Distance=119 km', 'Durée=1h00', 'Dénivelé +=250 m', 'Vitesse moy.=25,8 km/h', 'FC moy.=140 bpm', 'Puissance moy.=148 W']);
});

test('apercuImport : trace allégée et profil depuis les flux', () => {
  const n = 5000;
  const flux = [
    { type: 'latlng' as const, data: Array.from({ length: n }, (_, i) => (i % 500 === 7 ? null : ([41 + i * 1e-5, 0.8 + i * 1e-5] as [number, number]))) },
    { type: 'altitude' as const, data: Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 300) * 40) },
    { type: 'distance' as const, data: Array.from({ length: n }, (_, i) => i * 5) },
  ];
  const r = apercuImport({ ...base(), flux }, 'Ride');
  assert.equal(r.trace.length, 600);
  assert.ok(r.region && r.region.latitudeDelta >= 0.004);
  assert.equal(r.profil.length, 160);
  assert.ok((r.altitudeMax as number) <= 140.01 && (r.altitudeMin as number) >= 59.99);
});
