import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerSignaux } from '../../../supabase/functions/_shared/signaux.ts';
import { calculerSignauxCourse } from '../../../supabase/functions/_shared/signaux-course.ts';
import { completerSeance, genererFlux } from '../../src/data/demo/flux-demo.ts';
import { courbesDuFluxCourse, courbesDuFluxVelo, DUREES_COURSE_DEMO } from '../../src/data/demo/courbes-demo.ts';
import type { Seance } from '../../src/data/types.ts';

const velo: Seance = completerSeance({
  id: 'demo-parite-velo', name: 'Sortie longue', sport: 'Ride', start_date_local: '2026-05-10T08:00:00', moving_time: 9000, distance_km: 68, total_elevation_gain: 800,
  avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'velo',
});
const course: Seance = completerSeance({
  id: 'demo-parite-course', name: 'Fractionné', sport: 'Run', start_date_local: '2026-05-12T08:00:00', moving_time: 3300, distance_km: 10, total_elevation_gain: 50,
  avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'course',
});

test('parité vélo : à 1 point par seconde, les courbes de la démo sont celles du serveur', () => {
  const flux = genererFlux(velo, 1);
  const demo = courbesDuFluxVelo(flux, 1);
  const serveur = calculerSignaux({ time: flux.time, watts: flux.watts!, heartrate: flux.heartrate, cadence: flux.cadence!, velocity_smooth: flux.velocity_smooth, altitude: flux.altitude });
  for (const cle of ['fc', 'cad', 'cou', 'vit', 'vam', 'des'] as const) {
    const s = serveur[cle]!;
    const d = demo[cle]!;
    for (const [duree, valeur] of Object.entries(d)) assert.equal(valeur, s[duree], `${cle} ${duree}`);
  }
});

test('parité course : mêmes meilleurs temps, distances et FC que le serveur', () => {
  const flux = genererFlux(course, 1);
  const demo = courbesDuFluxCourse(flux);
  const serveur = calculerSignauxCourse({ time: flux.time, distance: flux.distance, heartrate: flux.heartrate });
  assert.deepEqual(demo.pace, serveur.pace);
  assert.deepEqual(demo.dis, serveur.dis);
  assert.deepEqual(demo.fc, serveur.fc);
  assert.ok(demo.pace?.['5000'] > 0 && DUREES_COURSE_DEMO.length > 0);
});

test('vélo à 5 s : la courbe de puissance baisse avec la durée et reste proche de celle à 1 s', () => {
  const a = courbesDuFluxVelo(genererFlux(velo, 1), 1).puissance;
  const b = courbesDuFluxVelo(genererFlux(velo, 5), 5).puissance;
  const durees = Object.keys(b).map(Number).sort((x, y) => x - y);
  for (let i = 1; i < durees.length; i++) assert.ok(b[String(durees[i])] <= b[String(durees[i - 1])] + 0.5, String(durees[i]));
  for (const d of [300, 1200, 3600]) assert.ok(Math.abs(b[String(d)] - a[String(d)]) / a[String(d)] < 0.06, String(d));
});
