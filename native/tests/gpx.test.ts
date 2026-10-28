import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denivelePositif, distanceKm, lireGpx, nomDeFichier, resumerGpx, TAILLE_MAX_GPX, verifierParcours } from '../src/data/outils/gpx.ts';

const pt = (lat: number, lon: number, ele?: number) => `<trkpt lat="${lat}" lon="${lon}">${ele == null ? '' : `<ele>${ele}</ele>`}</trkpt>`;
const gpx = (points: string, nom = 'Boucle du lac') => `<?xml version="1.0"?><gpx version="1.1"><trk><name>${nom}</name><trkseg>${points}</trkseg></trk></gpx>`;

test('lireGpx : des points de trace, avec ou sans altitude', () => {
  const r = lireGpx(gpx(pt(43.6, 1.44, 150) + pt(43.61, 1.44, 160) + pt(43.62, 1.45)));
  assert.equal(r.erreur, '');
  assert.equal(r.points.length, 3);
  assert.equal(r.points[0].ele, 150);
  assert.equal(r.points[2].ele, null);
  assert.equal(r.nom, 'Boucle du lac');
});

test('lireGpx : fichier vide, trop gros, pas un GPX, un seul point, coordonnées fausses', () => {
  assert.match(lireGpx('').erreur, /vide/);
  assert.match(lireGpx('x'.repeat(TAILLE_MAX_GPX + 1)).erreur, /trop gros/);
  assert.match(lireGpx('<html></html>').erreur, /pas un GPX/);
  assert.match(lireGpx(gpx(pt(43.6, 1.44))).erreur, /exploitable/);
  assert.match(lireGpx(gpx(pt(95, 1.44) + pt(43.6, 200))).erreur, /exploitable/); // latitude et longitude hors bornes : points ignorés
  assert.match(lireGpx(42 as unknown as string).erreur, /vide/);
});

test('lireGpx : le nom est nettoyé, jamais de balise ni d\'entité', () => {
  const r = lireGpx(gpx(pt(43.6, 1.44) + pt(43.7, 1.44), '<b>Sortie</b> &lt;script&gt; &amp; co'));
  assert.ok(!/[<>]/.test(r.nom));
});

test('distanceKm : un degré de latitude ≈ 111 km', () => {
  assert.ok(Math.abs(distanceKm({ lat: 43, lon: 1 }, { lat: 44, lon: 1 }) - 111.19) < 0.2);
  assert.equal(distanceKm({ lat: 43, lon: 1 }, { lat: 43, lon: 1 }), 0);
});

test('denivelePositif : le bruit de moins de 3 m ne compte pas', () => {
  assert.equal(denivelePositif([100, 101, 100, 102, 101]), 0);
  assert.equal(denivelePositif([100, 110, 105, 120]), 25); // +10, -5, +15
  assert.equal(denivelePositif([100, null, 90]), 0);
  assert.equal(denivelePositif([100]), 0);
  assert.equal(denivelePositif([]), 0);
});

test('resumerGpx : distance et dénivelé d\'un petit parcours', () => {
  const r = resumerGpx(gpx(pt(43.6, 1.44, 150) + pt(43.61, 1.44, 170) + pt(43.62, 1.44, 190)));
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(Math.abs(r.resume.distanceKm - 2.22) < 0.05);
    assert.equal(r.resume.denivele, 40);
    assert.equal(r.resume.points, 3);
    assert.equal(r.resume.nom, 'Boucle du lac');
  }
  const sans = resumerGpx(gpx(pt(43.6, 1.44) + pt(43.61, 1.44)));
  assert.ok(sans.ok);
  if (sans.ok) assert.equal(sans.resume.denivele, null); // pas d'altitude : pas de dénivelé inventé
  assert.equal(resumerGpx('rien').ok, false);
});

test('verifierParcours et nomDeFichier : taille, type et nom', () => {
  assert.equal(verifierParcours(null), null);
  assert.equal(verifierParcours({ nom: 'a.gpx', contenu: gpx(pt(43.6, 1.44) + pt(43.7, 1.44)) }), null);
  assert.match(verifierParcours({ nom: 'a.gpx', contenu: '' }) ?? '', /invalide/);
  assert.match(verifierParcours({ nom: 'a.gpx', contenu: '<html></html>' }) ?? '', /pas un GPX/);
  assert.match(verifierParcours({ nom: 'a.gpx', contenu: '<gpx>' + 'x'.repeat(TAILLE_MAX_GPX) }) ?? '', /trop gros/);
  assert.match(verifierParcours({ nom: 'x'.repeat(121), contenu: '<gpx>' }) ?? '', /nom/);
  assert.equal(nomDeFichier('/var/mobile/Containers/cache/sortie du dimanche.gpx'), 'sortie du dimanche.gpx');
  assert.equal(nomDeFichier('C:\\temp\\course.gpx'), 'course.gpx');
  assert.equal(nomDeFichier(''), 'parcours.gpx');
  assert.ok(!/[<>]/.test(nomDeFichier('<img src=x onerror=1>.gpx')));
});
