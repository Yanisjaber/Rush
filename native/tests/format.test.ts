import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateIsoLocale, formatDateCourte, formatDuree, formatDistanceSport, formatHeuresMinutes, formatKm } from '../src/data/format.ts';

test('formatDuree : minutes seules, puis heures et minutes sur deux chiffres', () => {
  assert.equal(formatDuree(2400), '40 min');
  assert.equal(formatDuree(3720), '1h02');
  assert.equal(formatDuree(7325), '2h02');
  assert.equal(formatDuree(0), '0 min');
});

test('formatDuree : valeurs absentes ou négatives donnent 0 min', () => {
  assert.equal(formatDuree(null), '0 min');
  assert.equal(formatDuree(undefined), '0 min');
  assert.equal(formatDuree(-5), '0 min');
});

test('formatKm : virgule française, une décimale par défaut', () => {
  assert.equal(formatKm(28.47), '28,5');
  assert.equal(formatKm(10), '10,0');
  assert.equal(formatKm(3.14159, 2), '3,14');
});

test('formatKm : valeur absente ou invalide donne un tiret', () => {
  assert.equal(formatKm(null), '—');
  assert.equal(formatKm(undefined), '—');
  assert.equal(formatKm(Number.NaN), '—');
});

test('formatDateCourte : une date invalide donne une chaîne vide', () => {
  assert.equal(formatDateCourte('nimportequoi'), '');
  assert.equal(formatDateCourte(''), '');
});

test('formatDateCourte : jour du mois et mois en français', () => {
  const t = formatDateCourte('2026-12-13');
  assert.match(t, /13/);
  assert.match(t, /déc/);
});

test('dateIsoLocale : AAAA-MM-JJ avec zéros', () => {
  assert.equal(dateIsoLocale(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dateIsoLocale(new Date(2026, 11, 31)), '2026-12-31');
});

test('formatHeuresMinutes : toujours 0h00, pour que des durées empilées s\'alignent', () => {
  assert.equal(formatHeuresMinutes(3240), '0h54');
  assert.equal(formatHeuresMinutes(9000), '2h30');
  assert.equal(formatHeuresMinutes(0), '0h00');
  assert.equal(formatHeuresMinutes(null), '0h00');
  assert.equal(formatHeuresMinutes(5100), '1h25');
});

test('formatDistanceSport : mètres en natation, kilomètres ailleurs, rien sans distance', () => {
  assert.equal(formatDistanceSport(2.4, 'natation'), '2\u00a0400 m');
  assert.equal(formatDistanceSport(0.75, 'natation'), '750 m');
  assert.equal(formatDistanceSport(7.4, 'course'), '7,4 km');
  assert.equal(formatDistanceSport(0, 'natation'), '');
  assert.equal(formatDistanceSport(null, 'velo'), '');
});
