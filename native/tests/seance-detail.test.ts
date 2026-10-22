import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chiffresSeance, formatDureeTour, lignesTours, messageTours, toursValides } from '../src/data/seance-detail.ts';
import { toursDemo } from '../src/data/demo.ts';
import type { Seance } from '../src/data/types.ts';

const seance = (extra: Partial<Seance>): Seance => ({
  id: 'x', name: 'Test', sport: 'Run', start_date_local: '2026-10-20T08:00:00', moving_time: 3000, distance_km: 10,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout', ...extra,
});
const cles = (s: Seance) => chiffresSeance(s).map((c) => c.cle);

test('chiffresSeance : une course montre durée, distance, allure, dénivelé, cardio et charge', () => {
  const c = chiffresSeance(seance({ total_elevation_gain: 120, avg_heartrate: 152.4, max_heartrate: 178, tss: 62.4, rpe: 6 }));
  assert.deepEqual(c.map((x) => x.cle), ['duree', 'distance', 'allure', 'denivele', 'fc', 'charge', 'rpe']);
  assert.equal(c.find((x) => x.cle === 'allure')?.valeur, `5'00"`); // 3000 s pour 10 km
  assert.equal(c.find((x) => x.cle === 'fc')?.valeur, '152');
  assert.equal(c.find((x) => x.cle === 'fc')?.note, 'max 178');
});

test('chiffresSeance : le vélo montre une vitesse et ses watts, pas d\'allure', () => {
  const k = cles(seance({ sport: 'Ride', distance_km: 30, moving_time: 3600, avg_watts: 180, np: 195 }));
  assert.ok(k.includes('vitesse') && k.includes('watts') && !k.includes('allure'));
});

test('chiffresSeance : la natation donne une allure au 100 m', () => {
  const a = chiffresSeance(seance({ sport: 'Swim', distance_km: 2, moving_time: 2400 })).find((x) => x.cle === 'allure');
  assert.equal(a?.unite, '/100 m');
  assert.equal(a?.valeur, '2:00'); // 2400 s pour 2 km
});

test('chiffresSeance : un chiffre absent ou nul n\'est pas listé, une séance sans distance non plus', () => {
  assert.deepEqual(cles(seance({ sport: 'WeightTraining', distance_km: null, moving_time: 3600 })), ['duree']);
  assert.deepEqual(cles(seance({ avg_heartrate: 0, tss: null, rpe: null })), ['duree', 'distance', 'allure']);
});

test('chiffresSeance : le temps total n\'apparaît que s\'il dépasse nettement le temps en mouvement', () => {
  assert.equal(chiffresSeance(seance({ elapsed_time: 3060 }))[0].note, undefined);
  assert.equal(chiffresSeance(seance({ elapsed_time: 3600 }))[0].note, '1h00 au total');
});

test('formatDureeTour : minutes et secondes sous l\'heure', () => {
  assert.equal(formatDureeTour(272), `4'32"`);
  assert.equal(formatDureeTour(45), `0'45"`);
  assert.equal(formatDureeTour(3720), '1h02');
});

test('lignesTours : temps, distance et allure de chaque tour ; un nom par défaut est masqué', () => {
  const l = lignesTours([
    { index: 1, name: 'Lap 1', elapsed_time: 300, moving_time: 300, distance: 1000 },
    { index: 2, name: 'Sled push', elapsed_time: 62, moving_time: 60, distance: 50 },
    { index: 3, name: '', elapsed_time: 90, moving_time: 90, distance: 0 },
  ], 'Hyrox');
  assert.deepEqual(l.map((x) => [x.numero, x.nom, x.duree, x.distance, x.rythme]), [
    [1, '', `5'00"`, '1,00 km', `5'00"/km`],
    [2, 'Sled push', `1'00"`, '50 m', `20'00"/km`],
    [3, '', `1'30"`, '', ''],
  ]);
});

test('lignesTours : vélo en km/h', () => {
  assert.equal(lignesTours([{ index: 1, name: '', elapsed_time: 600, moving_time: 600, distance: 5000 }], 'Ride')[0].rythme, '30,0 km/h');
});

test('toursValides : types, bornes et 100 tours au plus ; les tours sans temps sont écartés', () => {
  assert.deepEqual(toursValides('nimporte quoi'), []);
  const t = toursValides([{ index: 2, name: 'x'.repeat(100), elapsed_time: 100, moving_time: '90', distance: 'abc' }, { elapsed_time: 0, moving_time: 0 }, null]);
  assert.equal(t.length, 1);
  assert.deepEqual([t[0].index, t[0].name.length, t[0].moving_time, t[0].distance], [2, 60, 90, 0]);
  assert.equal(toursValides(Array.from({ length: 150 }, () => ({ elapsed_time: 10 }))).length, 100);
});

test('messageTours : un message clair par cas', () => {
  assert.match(messageTours(400, 'no_strava_connection'), /Connecte Strava/);
  assert.match(messageTours(404, undefined), /strava-laps/);
  assert.match(messageTours(500, 'internal_error'), /Impossible/);
  assert.match(messageTours(429, undefined), /patienter/);
});

test('toursDemo : un tour par kilomètre dont la somme redonne la séance ; rien pour la muscu ; 16 segments pour Hyrox', () => {
  const t = toursDemo(seance({ distance_km: 10.5, moving_time: 3150 }));
  assert.equal(t.length, 11);
  assert.ok(Math.abs(t.reduce((a, x) => a + x.moving_time, 0) - 3150) <= 11);
  assert.equal(t.reduce((a, x) => a + x.distance, 0), 10500);
  assert.deepEqual(toursDemo(seance({ sport: 'WeightTraining', distance_km: null })), []);
  const h = toursDemo(seance({ sport: 'Hyrox', distance_km: null }));
  assert.equal(h.length, 16);
  assert.deepEqual(h.map((x) => x.distance).slice(0, 4), [1000, 0, 1000, 0]);
});

test('chiffresSeance : en natation la distance est en mètres', () => {
  const d = chiffresSeance(seance({ sport: 'Swim', distance_km: 2.4, moving_time: 3000 })).find((x) => x.cle === 'distance');
  assert.equal(d?.unite, 'm');
  assert.equal(d?.valeur, '2\u00a0400');
});
