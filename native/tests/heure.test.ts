import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateDepuisHeure, dateDepuisJour, dureeDepuisHeure, heureDepuisDate, heureDepuisDuree, heureValide, heuresMinutesDepuis, minutesDepuisHeure, jourDepuisDate, texteDureeSaisie } from '../src/data/outils/heure.ts';

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

test('durée : aller-retour entre heures/minutes saisies et les roues « HH:MM »', () => {
  assert.equal(heureDepuisDuree('4', '37'), '04:37');
  assert.equal(heureDepuisDuree('0', '45'), '00:45');
  assert.equal(heureDepuisDuree('', ''), '00:00'); // illisible
  assert.equal(heureDepuisDuree('30', '75'), '23:59'); // au-delà : borné à ce que les roues savent montrer
  assert.deepEqual(dureeDepuisHeure('04:37'), { heures: '4', minutes: '37' });
  assert.deepEqual(dureeDepuisHeure('00:05'), { heures: '0', minutes: '5' });
  assert.deepEqual(dureeDepuisHeure('n'), { heures: '0', minutes: '0' });
});

test('texteDureeSaisie : « 4 h 37 min », « 2 h », « 37 min »', () => {
  assert.equal(texteDureeSaisie('4', '37'), '4 h 37 min');
  assert.equal(texteDureeSaisie('4', '5'), '4 h 05 min');
  assert.equal(texteDureeSaisie('2', '0'), '2 h');
  assert.equal(texteDureeSaisie('0', '37'), '37 min');
  assert.equal(texteDureeSaisie('', ''), '0 min');
});

test('durée en minutes ↔ roues : « 165 » ↔ 2 h 45 ↔ « 02:45 »', () => {
  assert.deepEqual(heuresMinutesDepuis('165'), { heures: '2', minutes: '45' });
  assert.deepEqual(heuresMinutesDepuis('60'), { heures: '1', minutes: '0' });
  assert.deepEqual(heuresMinutesDepuis('45'), { heures: '0', minutes: '45' });
  assert.deepEqual(heuresMinutesDepuis(''), { heures: '0', minutes: '0' });
  assert.deepEqual(heuresMinutesDepuis('-5'), { heures: '0', minutes: '0' });
  assert.equal(minutesDepuisHeure('02:45'), '165');
  assert.equal(minutesDepuisHeure('00:30'), '30');
  assert.equal(minutesDepuisHeure('23:59'), '1439');
  for (const m of ['1', '59', '60', '61', '165', '1439']) assert.equal(minutesDepuisHeure(heureDepuisDuree(heuresMinutesDepuis(m).heures, heuresMinutesDepuis(m).minutes)), m);
});
