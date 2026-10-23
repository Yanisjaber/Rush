import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateDepuisHeure, dateDepuisJour, heureDepuisDate, heureValide, jourDepuisDate } from '../src/data/heure.ts';

test('heure : aller-retour entre « HH:MM » et une Date', () => {
  for (const h of ['00:00', '07:05', '12:00', '18:30', '23:59']) assert.equal(heureDepuisDate(dateDepuisHeure(h)), h);
  assert.equal(heureDepuisDate(dateDepuisHeure('pas une heure')), '12:00'); // illisible : midi
  assert.equal(heureDepuisDate(dateDepuisHeure('25:00')), '12:00');
  assert.equal(heureDepuisDate(new Date(2026, 9, 26, 7, 5)), '07:05');
});

test('jour : aller-retour entre « AAAA-MM-JJ » et une Date, sans décalage', () => {
  for (const j of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31', '2028-02-29']) assert.equal(jourDepuisDate(dateDepuisJour(j)), j);
  assert.equal(jourDepuisDate(dateDepuisJour('2026-10-26T08:00:00')), '2026-10-26'); // l'heure est ignorée
});

test('heureValide : seulement HH:MM de 00:00 à 23:59', () => {
  assert.equal(heureValide('18:30'), true);
  assert.equal(heureValide('7:30'), false);
  assert.equal(heureValide('24:00'), false);
  assert.equal(heureValide('12:60'), false);
  assert.equal(heureValide(''), false);
});
