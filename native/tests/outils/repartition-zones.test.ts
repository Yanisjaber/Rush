import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repartitionsSortie, tempsParZone } from '../../src/data/outils/repartition-zones.ts';

test('tempsParZone : chaque point compte pour le temps jusqu au suivant', () => {
  // 10 points toutes les 10 s : 5 en zone 0 (< 100), 5 en zone 1 (≥ 100)
  const temps = Array.from({ length: 10 }, (_, i) => i * 10);
  const valeurs = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
  assert.deepEqual(tempsParZone(valeurs, temps, [0, 100]), [50, 50]);
});

test('tempsParZone : une pause ne compte pas, une valeur sous la première borne va dans la première zone', () => {
  const temps = [0, 10, 20, 30, 1000, 1010];
  const r = tempsParZone([10, 10, 10, 10, 10, 10], temps, [50, 100])!;
  assert.equal(r[1], 0);
  assert.ok(r[0] < 100); // 30 s de pause plafonnées à 3 fois l'écart habituel, pas 970 s
});

test('tempsParZone : sans temps, la durée totale est répartie en parts égales ; sans rien, null', () => {
  assert.deepEqual(tempsParZone([1, 1, 200, 200], null, [0, 100], 40), [20, 20]);
  assert.equal(tempsParZone([1, 1, 200, 200], null, [0, 100]), null);
  assert.equal(tempsParZone([NaN, NaN], [0, 10], [0, 100]), null);
});

test('repartitionsSortie : une mesure par flux présent, avec un message quand la référence manque', () => {
  const temps = Array.from({ length: 60 }, (_, i) => i * 10);
  const brut = { temps, fc: Array.from({ length: 60 }, () => 175), watts: Array.from({ length: 60 }, () => 200), vitesse: Array.from({ length: 60 }, () => 3) };
  const r = repartitionsSortie(brut, { lthr: { bpm: 172, estimee: true }, ftp: null, seuilKmh: 12.5 }, true, 600);
  assert.deepEqual(r.map((m) => m.cle), ['fc', 'watts', 'allure']);
  assert.match(r[1].manque ?? '', /FTP/); // pas de FTP : l'onglet est là, avec un message
  assert.equal(r[1].zones.length, 0);
  assert.equal(r[0].estimee, true);
  assert.equal(r[0].zones.length, 5); // Z5a, Z5b et Z5c regroupées : un seul Z5, comme les bandes des courbes
  assert.equal(Math.round(r[0].zones.reduce((a, z) => a + z.secondes, 0)), 600);
  assert.equal(r[0].zones[4].court, 'Z5'); // 175 bpm / 172 = 102 % : zone Z5
  assert.ok(r[0].zones[4].secondes > 500);
  // La plage sous chaque colonne : « <139 », puis « 139–154 »… sans chevauchement, et « 207+ » pour la dernière
  assert.equal(r[0].zones[0].borne, '<139');
  assert.equal(r[0].zones[1].borne, '139–154');
  assert.match(r[0].zones[4].borne, /^\d+\+$/);
  assert.equal(r[0].unite, 'bpm');
  // Puissance : Z6 et Z7 regroupées (6 zones), le temps total reste le même
  const pw = repartitionsSortie({ ...brut, watts: Array.from({ length: 60 }, () => 400) }, { ftp: 200 }, false, 600).find((m) => m.cle === 'watts')!;
  assert.equal(pw.zones.length, 6);
  assert.equal(Math.round(pw.zones[5].secondes), 600);
  assert.equal(repartitionsSortie(brut, { lthr: { bpm: 172, estimee: false }, seuilKmh: 12.5 }, false, 600).some((m) => m.cle === 'allure'), false); // allure : course seulement
  assert.match(repartitionsSortie(brut, {}, true, 600).find((m) => m.cle === 'allure')?.manque ?? '', /vitesse seuil/); // sans seuil : message
  assert.deepEqual(repartitionsSortie(null, { ftp: 250 }, true, 600), []);
});
