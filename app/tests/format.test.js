import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuree, formatKm, joursAvant, dateIsoLocale, formatAllureDepuisKmh } from '../src/lib/utils/format.js';

test('formatDuree : minutes seules, puis heures et minutes', () => {
  assert.equal(formatDuree(2400), '40 min');
  assert.equal(formatDuree(3720), '1h02');
  assert.equal(formatDuree(0), '0 min');
  assert.equal(formatDuree(null), '0 min');
});

test('formatKm : virgule française et valeur absente', () => {
  assert.equal(formatKm(28.47), '28,5');
  assert.equal(formatKm(10.15, 2), '10,15');
  assert.equal(formatKm(null), '—');
});

test('joursAvant : jours calendaires, J-62 le 12 octobre pour le 13 décembre', () => {
  assert.equal(joursAvant('2026-12-13', new Date(2026, 9, 12, 15, 0)), 62);
  assert.equal(joursAvant('2026-12-13', new Date(2026, 9, 12, 0, 5)), 62); // même résultat tôt le matin
  assert.equal(joursAvant('2026-10-12', new Date(2026, 9, 12, 22, 0)), 0);
  assert.equal(joursAvant('2026-10-10', new Date(2026, 9, 12)), -2);
});

test('dateIsoLocale : AAAA-MM-JJ avec zéros', () => {
  assert.equal(dateIsoLocale(new Date(2026, 0, 5)), '2026-01-05');
});

test('formatAllureDepuisKmh : min/km en course, min/100 m en natation, vitesse nulle = tiret', () => {
  assert.equal(formatAllureDepuisKmh(12), '5:00');
  assert.equal(formatAllureDepuisKmh(10), '6:00');
  assert.equal(formatAllureDepuisKmh(11.5), '5:13');
  assert.equal(formatAllureDepuisKmh(3.6, true), '1:40'); // 3,6 km/h = 1 m/s = 100 s les 100 m
  assert.equal(formatAllureDepuisKmh(0), '—');
  assert.equal(formatAllureDepuisKmh(null), '—');
});
