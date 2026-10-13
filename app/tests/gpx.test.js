import test from 'node:test';
import assert from 'node:assert/strict';
import { lireGpx, distanceKm, profil, denivele, statistiques, reduire, detecterMontees, textePente, TAILLE_MAX_GPX } from '../src/lib/data/gpx.js';

// Parcours de test : 0,1° de latitude ≈ 11,1 km ; on monte puis on descend
const gpx = (points, extra = '') => `<?xml version="1.0"?><gpx version="1.1" creator="test"><metadata><name>Mon parcours</name></metadata><trk>${extra}<trkseg>${points.map(([lat, lon, ele]) => `<trkpt lat="${lat}" lon="${lon}">${ele != null ? `<ele>${ele}</ele>` : ''}</trkpt>`).join('')}</trkseg></trk></gpx>`;
const montee = () => {
  // 1 km tous les 0,009° de latitude ; altitude : plat 2 km, montée 4 km à 6 %, descente 2 km
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const km = i * 0.1;
    const ele = km <= 2 ? 100 : km <= 6 ? 100 + (km - 2) * 60 : 340 - (km - 6) * 100;
    pts.push([43 + (km / 111.19), 1.4, ele.toFixed(1)]);
  }
  return pts;
};

test('lecture : trace valide, nom nettoyé, altitudes absentes = null', () => {
  const r = lireGpx(gpx([[43.0, 1.4, 100], [43.001, 1.4, null], [43.002, 1.4, 105]], '<name>Trace <b>x</b></name>'));
  assert.equal(r.erreur, '');
  assert.equal(r.points.length, 3);
  assert.equal(r.points[1].ele, null);
  assert.equal(r.nom, 'Mon parcours');
});

test('lecture : refus du vide, du non-GPX, du trop gros, des coordonnées impossibles', () => {
  assert.match(lireGpx('').erreur, /vide/);
  assert.match(lireGpx('<html><body>pas un gpx</body></html>').erreur, /pas un GPX/);
  assert.match(lireGpx('<gpx>' + 'x'.repeat(TAILLE_MAX_GPX + 10)).erreur, /trop gros/);
  assert.match(lireGpx(gpx([[95, 1, 0], [10, 200, 0]])).erreur, /Aucun parcours/);
  assert.match(lireGpx(gpx([[43, 1, 0]])).erreur, /Aucun parcours/);
  assert.match(lireGpx(null).erreur, /vide/);
});

test('lecture : un GPX piégé (balises, entités) ne produit que des nombres et du texte inerte', () => {
  const piege = '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx><metadata><name>&x;&lt;img src=x onerror=alert(1)&gt;</name></metadata><trk><trkseg><trkpt lat="43" lon="1"><ele>10</ele></trkpt><trkpt lat="43.01" lon="1"><ele>12</ele></trkpt></trkseg></trk></gpx>';
  const r = lireGpx(piege);
  assert.equal(r.points.length, 2);
  assert.ok(!/[<>]/.test(r.nom));
  assert.ok(r.points.every((p) => typeof p.lat === 'number' && typeof p.lon === 'number'));
});

test('lecture : retombe sur les points de route (rtept) puis de repère (wpt)', () => {
  const route = '<gpx><rte><rtept lat="43" lon="1"/><rtept lat="43.01" lon="1"/></rte></gpx>';
  assert.equal(lireGpx(route).points.length, 2);
  const reperes = '<gpx><wpt lat="43" lon="1"><ele>5</ele></wpt><wpt lat="43.02" lon="1"/></gpx>';
  assert.equal(lireGpx(reperes).points.length, 2);
});

test('distance : 0,1° de latitude ≈ 11,1 km, symétrique, nulle sur place', () => {
  const d = distanceKm({ lat: 43, lon: 1 }, { lat: 43.1, lon: 1 });
  assert.ok(Math.abs(d - 11.12) < 0.05);
  assert.equal(distanceKm({ lat: 43, lon: 1 }, { lat: 43, lon: 1 }), 0);
  assert.ok(Math.abs(distanceKm({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }) - distanceKm({ lat: 2, lon: 2 }, { lat: 1, lon: 1 })) < 1e-9);
});

test('profil et dénivelé : le bruit sous 3 m est ignoré', () => {
  const s = profil(lireGpx(gpx(montee())).points);
  assert.ok(Math.abs(s[s.length - 1].km - 8) < 0.1);
  const d = denivele(s);
  assert.ok(Math.abs(d.gain - 240) < 5, `gain ${d.gain}`);
  assert.ok(Math.abs(d.perte - 200) < 5, `perte ${d.perte}`);
  const bruit = [100, 101, 100, 102, 101, 100, 102].map((ele, i) => ({ km: i, ele }));
  assert.deepEqual(denivele(bruit), { gain: 0, perte: 0 });
  assert.deepEqual(denivele([{ km: 0, ele: null }]), { gain: 0, perte: 0 });
});

test('statistiques : parcours entier, portion, circuit répété, trop peu de points', () => {
  const s = profil(lireGpx(gpx(montee())).points);
  const tout = statistiques(s);
  assert.ok(Math.abs(tout.distanceKm - 8) < 0.1);
  assert.equal(tout.altMax, 340);
  assert.ok(tout.penteMax > 5);
  const portion = statistiques(s, 2, 6);
  assert.ok(Math.abs(portion.penteMoy - 6) < 0.3);
  const deuxTours = statistiques(s, 0, Infinity, 2);
  assert.ok(Math.abs(deuxTours.distanceKm - 2 * tout.distanceKm) < 1e-9);
  assert.equal(statistiques(s, 100, 200), null);
});

test('réduction : garde premier et dernier points', () => {
  const s = Array.from({ length: 1000 }, (_, i) => ({ km: i, ele: i }));
  const r = reduire(s, 100);
  assert.equal(r.length, 100);
  assert.equal(r[0].km, 0);
  assert.equal(r[99].km, 999);
  assert.equal(reduire(s.slice(0, 50), 100).length, 50);
});

test('montées : la montée de 4 km à 6 % est trouvée, pas le plat ni la descente', () => {
  const m = detecterMontees(profil(lireGpx(gpx(montee())).points));
  assert.equal(m.length, 1);
  assert.ok(Math.abs(m[0].debutKm - 2) < 0.3);
  assert.ok(Math.abs(m[0].distanceKm - 4) < 0.3);
  assert.ok(Math.abs(m[0].gain - 240) < 10);
  assert.ok(Math.abs(m[0].pente - 6) < 0.5);
  assert.deepEqual(detecterMontees(profil(lireGpx(gpx(Array.from({ length: 30 }, (_, i) => [43 + i * 0.001, 1.4, 100]))).points)), []);
  assert.deepEqual(detecterMontees([]), []);
});

test('texte de pente', () => {
  assert.equal(textePente(5.24), '+5,2 %');
  assert.equal(textePente(-3), '-3,0 %');
});
