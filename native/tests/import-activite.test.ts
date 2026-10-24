import { test } from 'node:test';
import assert from 'node:assert/strict';
import { champsValides, lireActivite, versChamps } from '../src/data/import-activite.ts';

const MAINTENANT = Date.UTC(2026, 9, 23, 12, 0, 0);
const octets = (t: string) => new TextEncoder().encode(t);

// Un petit FIT : un message « session » avec les champs utiles (début, temps, distance, montée, FC, sport)
function fit(session: { debut: number; tempsMs: number; cm: number; montee: number; fc: number; sport: number; sous?: number }, petit = true): Uint8Array {
  const champs: [number, number][] = [[2, 4], [8, 4], [9, 4], [22, 2], [16, 1], [5, 1], [6, 1]];
  const corps: number[] = [];
  const u = (v: number, n: number) => {
    const o: number[] = [];
    for (let i = 0; i < n; i++) o.push((v >>> (8 * i)) & 0xff);
    return petit ? o : o.reverse();
  };
  corps.push(0x40, 0, petit ? 0 : 1, ...u(18, 2), champs.length);
  for (const [num, taille] of champs) corps.push(num, taille, 0x86);
  corps.push(0x00, ...u(session.debut, 4), ...u(session.tempsMs, 4), ...u(session.cm, 4), ...u(session.montee, 2), session.fc, session.sport, session.sous ?? 0);
  const entete = [14, 0x20, 0, 0, ...u(corps.length, 4), 0x2e, 0x46, 0x49, 0x54, 0, 0];
  return Uint8Array.from([...entete, ...corps, 0, 0]);
}

test('FIT : course à pied, résumé de la session', () => {
  // 2026-10-23 07:30:00 UTC en secondes FIT (depuis 1989-12-31)
  const debut = Math.floor(Date.UTC(2026, 9, 23, 7, 30) / 1000) - 631065600;
  const r = lireActivite(fit({ debut, tempsMs: 3_000_000, cm: 1_050_000, montee: 85, fc: 152, sport: 1 }), MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.activite.type, 'Run');
    assert.equal(r.activite.dureeS, 3000);
    assert.equal(r.activite.distanceKm, 10.5);
    assert.equal(r.activite.denivele, 85);
    assert.equal(r.activite.fc, 152);
    assert.equal(r.activite.debut?.toISOString(), '2026-10-23T07:30:00.000Z');
  }
});

test('FIT : gros-boutiste, vélo et valeurs absentes ignorées', () => {
  const debut = Math.floor(Date.UTC(2026, 9, 20, 6, 0) / 1000) - 631065600;
  const r = lireActivite(fit({ debut, tempsMs: 7_200_000, cm: 0xffffffff, montee: 0xffff, fc: 0xff, sport: 2 }, false), MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.activite.type, 'Ride');
    assert.equal(r.activite.dureeS, 7200);
    assert.equal(r.activite.distanceKm, null);
    assert.equal(r.activite.denivele, null);
    assert.equal(r.activite.fc, null);
  }
});

test('FIT : musculation (training + strength) et sport inconnu', () => {
  const debut = Math.floor(Date.UTC(2026, 9, 20, 6, 0) / 1000) - 631065600;
  const m = lireActivite(fit({ debut, tempsMs: 3_600_000, cm: 0, montee: 0, fc: 120, sport: 10, sous: 20 }), MAINTENANT);
  assert.ok(m.ok && m.activite.type === 'WeightTraining');
  const x = lireActivite(fit({ debut, tempsMs: 3_600_000, cm: 0, montee: 0, fc: 120, sport: 11 }), MAINTENANT);
  assert.ok(x.ok && x.activite.type === null); // marche : le formulaire garde son sport
});

test('FIT : fichier tronqué ou sans session → erreur claire, sans planter', () => {
  const entier = fit({ debut: 1, tempsMs: 1, cm: 1, montee: 1, fc: 100, sport: 1 });
  for (const coupe of [entier.slice(0, 10), entier.slice(0, 20), entier.slice(0, entier.length - 8)]) {
    const r = lireActivite(coupe, MAINTENANT);
    assert.equal(r.ok, false);
  }
  const sansSession = Uint8Array.from([14, 0x20, 0, 0, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0, 0, 0]);
  assert.equal(lireActivite(sansSession, MAINTENANT).ok, false);
});

const gpx = (pts: string, extra = '') => `<?xml version="1.0"?><gpx version="1.1"><trk><name>Footing du soir</name>${extra}<trkseg>${pts}</trkseg></trk></gpx>`;
const pt = (lat: number, ele: number, t: string, hr?: number) =>
  `<trkpt lat="${lat}" lon="1.44"><ele>${ele}</ele><time>${t}</time>${hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''}</trkpt>`;

test('GPX : distance, dénivelé, durée, FC, sport et nom', () => {
  const r = lireActivite(
    octets(gpx(pt(43.6, 150, '2026-10-22T17:00:00Z', 140) + pt(43.61, 170, '2026-10-22T17:05:00Z', 150) + pt(43.62, 190, '2026-10-22T17:10:00Z', 160), '<type>running</type>')),
    MAINTENANT,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(Math.abs((r.activite.distanceKm ?? 0) - 2.22) < 0.05);
    assert.equal(r.activite.denivele, 40);
    assert.equal(r.activite.dureeS, 600);
    assert.equal(r.activite.fc, 150);
    assert.equal(r.activite.type, 'Run');
    assert.equal(r.activite.nom, 'Footing du soir');
    assert.equal(r.activite.debut?.toISOString(), '2026-10-22T17:00:00.000Z');
  }
});

test('GPX : sans heure ni altitude, on ne devine rien', () => {
  const r = lireActivite(octets(gpx('<trkpt lat="43.6" lon="1.44"></trkpt><trkpt lat="43.61" lon="1.44"></trkpt>')), MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.activite.debut, null);
    assert.equal(r.activite.dureeS, null);
    assert.equal(r.activite.denivele, null);
    assert.equal(r.activite.fc, null);
  }
});

const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Lap StartTime="2026-10-21T08:00:00Z">
<TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>12000</DistanceMeters><Track>
<Trackpoint><Time>2026-10-21T08:00:00Z</Time><AltitudeMeters>100</AltitudeMeters><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
<Trackpoint><Time>2026-10-21T08:30:00Z</Time><AltitudeMeters>130</AltitudeMeters><DistanceMeters>12000</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

test('TCX : tours, altitude et FC', () => {
  const r = lireActivite(octets(tcx), MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.activite.type, 'Ride');
    assert.equal(r.activite.dureeS, 1800);
    assert.equal(r.activite.distanceKm, 12);
    assert.equal(r.activite.denivele, 30);
    assert.equal(r.activite.fc, 140);
    assert.equal(r.activite.debut?.toISOString(), '2026-10-21T08:00:00.000Z');
  }
});

test('refus : vide, trop gros, format inconnu, date absurde ignorée', () => {
  assert.equal(lireActivite(new Uint8Array(0), MAINTENANT).ok, false);
  assert.equal(lireActivite(new Uint8Array(5 * 1024 * 1024 + 1), MAINTENANT).ok, false);
  assert.equal(lireActivite(octets('juste du texte'), MAINTENANT).ok, false);
  assert.equal(lireActivite(octets('<html><body>pas un gpx</body></html>'), MAINTENANT).ok, false);
  const futur = lireActivite(octets(gpx(pt(43.6, 1, '2099-01-01T00:00:00Z') + pt(43.61, 1, '2099-01-01T00:10:00Z'))), MAINTENANT);
  assert.ok(futur.ok && futur.activite.debut === null);
});

test('versChamps : heures, minutes, virgule, natation en mètres, rien d\'inventé', () => {
  const d = new Date(2026, 9, 22, 7, 5); // heure locale de l'appareil
  const { date, champs } = versChamps({ type: 'Run', debut: d, dureeS: 4500, distanceKm: 10.5, denivele: 85, fc: 152, nom: 'Footing', });
  assert.equal(date, '2026-10-22');
  assert.deepEqual(champs, { type: 'Run', heure: '07:05', heures: '1', minutes: '15', distance: '10,5', dplus: '85', fc: '152', nom: 'Footing' });
  const nage = versChamps({ type: 'Swim', debut: null, dureeS: 2400, distanceKm: 1.5, denivele: null, fc: null, nom: '' });
  assert.equal(nage.date, null);
  assert.deepEqual(nage.champs, { type: 'Swim', heures: '0', minutes: '40', distance: '1500' });
  assert.deepEqual(versChamps({ type: null, debut: null, dureeS: 20, distanceKm: 0, denivele: null, fc: null, nom: '' }).champs, {});
});

test('champsValides : les paramètres de route mal formés sont écartés', () => {
  const types = ['Run', 'Ride'];
  assert.deepEqual(champsValides({ type: 'Ride', heure: '07:05', heures: '1', minutes: '15', distance: '10,5', dplus: '85', fc: '152', nom: 'Sortie' }, types), {
    type: 'Ride', heure: '07:05', heures: '1', minutes: '15', distance: '10,5', dplus: '85', fc: '152', nom: 'Sortie',
  });
  assert.deepEqual(champsValides({ type: 'Hack', heure: '25:00', heures: '123', minutes: 'ab', distance: '1e9', dplus: '-3', fc: '9', nom: 12 }, types), {});
  assert.equal(champsValides({ nom: '<img src=x onerror=alert(1)>' }, types).nom, 'img src=x onerror=alert(1)'); // les chevrons sont retirés
});

// FIT avec points (record), un tour (lap) et une session : de quoi vérifier les flux, les tours et les chiffres de résumé
function fitComplet(): Uint8Array {
  const u = (v: number, n: number) => Array.from({ length: n }, (_, i) => (v >>> (8 * i)) & 0xff);
  const def = (local: number, global: number, champs: [number, number][]) => [0x40 | local, 0, 0, ...u(global, 2), champs.length, ...champs.flatMap(([n, t]) => [n, t, 0x86])];
  const semi = (deg: number) => Math.round((deg * 2 ** 31) / 180);
  const corps: number[] = [];
  // record : temps, lat, lon, FC, puissance, altitude « enhanced » (0,2 m, décalée de 500 m), vitesse « enhanced » (mm/s), distance (cm)
  corps.push(...def(0, 20, [[253, 4], [0, 4], [1, 4], [3, 1], [7, 2], [78, 4], [73, 4], [5, 4]]));
  const point = (t: number, lat: number, lon: number, fc: number, w: number, alt: number, vit: number, dist: number) =>
    corps.push(0x00, ...u(t, 4), ...u(semi(lat) >>> 0, 4), ...u(semi(lon) >>> 0, 4), fc, ...u(w, 2), ...u(Math.round((alt + 500) * 5), 4), ...u(Math.round(vit * 1000), 4), ...u(Math.round(dist * 100), 4));
  const t0 = Math.floor(Date.UTC(2026, 9, 20, 6, 0) / 1000) - 631065600;
  point(t0, 41.0, 0.8, 120, 150, 100, 7, 0);
  point(t0 + 1, 41.001, 0.801, 125, 0xffff, 101, 7.5, 7.4); // puissance absente
  point(t0 + 2, 41.002, 0.802, 0xff, 210, 102, 8, 15); // FC absente
  corps.push(...def(1, 19, [[7, 4], [8, 4], [9, 4]]), 0x01, ...u(3000, 4), ...u(2500, 4), ...u(1500, 4)); // tour : 3 s écoulées, 2,5 s en mouvement, 15 m
  corps.push(...def(2, 18, [[2, 4], [8, 4], [9, 4], [5, 1], [17, 1], [20, 2], [21, 2], [34, 2], [11, 2], [48, 4], [14, 2]]));
  corps.push(0x02, ...u(t0, 4), ...u(3000, 4), ...u(1500, 4), 2, 180, ...u(160, 2), ...u(900, 2), ...u(190, 2), ...u(75, 2), ...u(120000, 4), ...u(8000, 2));
  return Uint8Array.from([14, 0x20, 0, 0, ...u(corps.length, 4), 0x2e, 0x46, 0x49, 0x54, 0, 0, ...corps, 0, 0]);
}

test('FIT complet : flux au format Strava, tours et chiffres de résumé', () => {
  const r = lireActivite(fitComplet(), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const flux = (type: string) => r.activite.flux.find((f) => f.type === type)?.data;
  assert.deepEqual(flux('time'), [0, 1, 2]);
  assert.deepEqual(flux('heartrate'), [120, 125, null]); // une valeur absente reste null
  assert.deepEqual(flux('watts'), [150, null, 210]);
  assert.deepEqual(flux('altitude'), [100, 101, 102]);
  assert.deepEqual(flux('velocity_smooth'), [7, 7.5, 8]);
  assert.deepEqual(flux('distance'), [0, 7.4, 15]);
  assert.deepEqual(flux('latlng')?.[1], [41.001, 0.801]);
  assert.equal(flux('cadence'), undefined); // pas de cadence dans le fichier : pas de flux inventé
  assert.deepEqual(r.activite.tours, [{ index: 1, name: 'Tour 1', elapsed_time: 3, moving_time: 3, distance: 15 }]);
  assert.deepEqual(r.activite.extras, { avg_watts: 160, max_watts: 900, np: 190, max_heartrate: 180, avg_cadence: null, calories: 75, kj: 120, avg_speed_kmh: 28.8 });
});

test('un FIT sans point ne donne aucun flux ; le TCX donne les siens', () => {
  const debut = Math.floor(Date.UTC(2026, 9, 20, 6, 0) / 1000) - 631065600;
  const r = lireActivite(fit({ debut, tempsMs: 60000, cm: 1000, montee: 1, fc: 100, sport: 1 }), MAINTENANT);
  assert.ok(r.ok && r.activite.flux.length === 0 && r.activite.tours.length === 0 && r.activite.extras === null);
  const t = lireActivite(octets(tcx), MAINTENANT);
  assert.ok(t.ok && t.activite.flux.map((f) => f.type).join() === 'time,distance,heartrate,altitude'); // TCX sans position : pas de trace
  assert.deepEqual(t.ok && t.activite.flux.find((f) => f.type === 'heartrate')?.data, [130, 150]);
});

// --- ce qui s'écrit avec l'activité ---------------------------------------------------------------------------------------
import { gunzipSync } from 'fflate';
import { compresserFlux, donneesAEcrire, enBase64, FORMAT_FLUX, gpxDepuisFlux, verifierDonneesImport } from '../src/data/import-activite.ts';
import { formulaireSortieVide, validerSortie } from '../src/data/ajouts.ts';
import { resumerGpx } from '../src/data/gpx.ts';

test('enBase64 : mêmes résultats que Buffer, sur toutes les longueurs', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100, 1001]) {
    const o = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
    assert.equal(enBase64(o), Buffer.from(o).toString('base64'));
  }
});

test('compresserFlux : gzip + base64, on retrouve exactement les flux', () => {
  const r = lireActivite(fitComplet(), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const gz = compresserFlux(r.activite.flux);
  assert.ok(gz);
  const relu = JSON.parse(new TextDecoder().decode(gunzipSync(Buffer.from(gz as string, 'base64'))));
  assert.deepEqual(relu, r.activite.flux);
  assert.equal(compresserFlux([]), null);
});

test('gpxDepuisFlux : un GPX que l\'app sait relire, avec heure, altitude, FC et nom échappé', () => {
  const r = lireActivite(fitComplet(), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const gpx = gpxDepuisFlux(r.activite.flux, r.activite.debut, 'Sortie <b>"test"</b> & co');
  assert.ok(gpx);
  assert.ok(gpx?.includes('Sortie &lt;b&gt;&quot;test&quot;&lt;/b&gt; &amp; co'));
  const lu = resumerGpx(gpx);
  assert.ok(lu.ok);
  if (lu.ok) {
    assert.equal(lu.resume.points, 3);
    assert.equal(lu.resume.denivele, 0); // 100 → 102 m : sous le seuil de bruit
  }
  const dates = lireActivite(octets(gpx as string), MAINTENANT);
  assert.ok(dates.ok && dates.activite.debut?.toISOString() === '2026-10-20T06:00:00.000Z' && dates.activite.dureeS === 2);
  assert.equal(gpxDepuisFlux([], null, 'x'), null);
});

test('un long parcours est allégé pour rester sous les 5 Mo', () => {
  const n = 60000;
  const flux = [
    { type: 'time' as const, data: Array.from({ length: n }, (_, i) => i) },
    { type: 'latlng' as const, data: Array.from({ length: n }, (_, i) => [41 + i * 1e-5, 0.8 + i * 1e-5] as [number, number]) },
    { type: 'altitude' as const, data: Array.from({ length: n }, () => 100.5) },
    { type: 'heartrate' as const, data: Array.from({ length: n }, () => 140) },
  ];
  const gpx = gpxDepuisFlux(flux, new Date(MAINTENANT), 'long');
  assert.ok(gpx && gpx.length < 5 * 1024 * 1024);
});

test('donneesAEcrire + validerSortie : tout part avec l\'activité, une saisie à la main n\'écrit rien de plus', () => {
  const r = lireActivite(fitComplet(), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const plus = donneesAEcrire(r.activite, 'ride.fit', new Date(MAINTENANT));
  assert.equal(plus.streams_format, FORMAT_FLUX);
  assert.equal(plus.gpx_name, 'ride.fit');
  assert.equal(plus.lap_details?.length, 1);
  assert.equal(plus.avg_watts, 160);
  const f = { ...formulaireSortieVide(), type: 'Ride', heures: '0', minutes: '1' };
  const avec = validerSortie(f, '2026-10-20', '2026-10-23', 'Cyclisme', plus);
  assert.ok(avec.ok);
  if (avec.ok) {
    assert.ok(avec.ligne.streams_gz && avec.ligne.gpx_content && avec.ligne.lap_details && avec.ligne.kj === 120);
    assert.equal(avec.ligne.source, 'manual');
  }
  const sans = validerSortie(f, '2026-10-20', '2026-10-23', 'Cyclisme');
  assert.ok(sans.ok);
  if (sans.ok) assert.deepEqual(Object.keys(sans.ligne).filter((k) => /streams|gpx|lap_|watts|^np$|kj/.test(k)), []);
});

test('verifierDonneesImport : colonnes inconnues écartées, valeurs hors bornes refusées', () => {
  const ok = verifierDonneesImport({ avg_watts: 150, user_id: 'pirate', source: 'strava', tss: 9999 });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.donnees, { avg_watts: 150 }); // user_id, source et tss ne passent jamais
  for (const mauvais of [
    { avg_watts: 99999 }, { avg_watts: 1.5 }, { max_heartrate: 10 }, { avg_speed_kmh: -3 }, { kj: '5' },
    { streams_gz: '<script>', streams_format: FORMAT_FLUX, streams_synced_at: new Date().toISOString() },
    { streams_gz: 'QUJD', streams_format: 'autre', streams_synced_at: new Date().toISOString() },
    { streams_gz: 'QUJD', streams_format: FORMAT_FLUX, streams_synced_at: 'hier' },
    { gpx_content: 'pas un gpx', gpx_name: 'x' },
    { gpx_content: '<gpx></gpx>', gpx_name: 'x'.repeat(200) },
    { lap_details: [{ index: 1, name: 'T', elapsed_time: -1, moving_time: 1, distance: 1 }] },
    { lap_details: Array.from({ length: 5001 }, (_, i) => ({ index: 1 + (i % 5000), name: 'T', elapsed_time: 1, moving_time: 1, distance: 1 })) },
    null, 'texte',
  ]) assert.equal(verifierDonneesImport(mauvais).ok, false, JSON.stringify(mauvais).slice(0, 60));
  const tours = verifierDonneesImport({ lap_details: [{ index: 1, name: 'Tour <1>', elapsed_time: 10, moving_time: 9, distance: 100, extra: 'x' }] });
  assert.ok(tours.ok);
  if (tours.ok) assert.deepEqual(tours.donnees.lap_details, [{ index: 1, name: 'Tour 1', elapsed_time: 10, moving_time: 9, distance: 100 }]);
});

test('GPX : les flux (position, altitude, distance, FC, temps) servent à la carte et au profil', () => {
  const r = lireActivite(octets(gpx(pt(43.6, 150, '2026-10-22T17:00:00Z', 140) + pt(43.61, 170, '2026-10-22T17:05:00Z', 150) + pt(43.62, 190, '2026-10-22T17:10:00Z', 160))), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const f = (type: string) => r.activite.flux.find((x) => x.type === type)?.data;
  assert.deepEqual(f('time'), [0, 300, 600]);
  assert.deepEqual(f('altitude'), [150, 170, 190]);
  assert.deepEqual(f('heartrate'), [140, 150, 160]);
  assert.deepEqual(f('latlng')?.[0], [43.6, 1.44]);
  const d = f('distance') as number[];
  assert.equal(d[0], 0);
  assert.ok(Math.abs(d[2] - 2220) < 40);
});

test('GPX sans heures : la trace est gardée, mais aucun temps n\'est inventé', () => {
  const r = lireActivite(octets(gpx('<trkpt lat="43.6" lon="1.44"><ele>100</ele></trkpt><trkpt lat="43.61" lon="1.44"><ele>110</ele></trkpt>')), MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.activite.flux.map((f) => f.type).sort(), ['altitude', 'distance', 'latlng']);
});

test('une position ou une altitude absente reste absente (jamais 0)', () => {
  const sansPos = tcx.replace(/<AltitudeMeters>130<\/AltitudeMeters>/, '');
  const r = lireActivite(octets(sansPos), MAINTENANT);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.activite.denivele, 0); // une seule altitude connue : pas de dénivelé inventé
  assert.deepEqual(r.activite.flux.find((f) => f.type === 'altitude')?.data, [100, null]);
  assert.equal(r.activite.flux.find((f) => f.type === 'latlng'), undefined);
});
