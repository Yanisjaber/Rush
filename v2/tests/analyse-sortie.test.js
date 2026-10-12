import test from 'node:test';
import assert from 'node:assert/strict';
import { meilleuresPuissances, texteDuree, statutRecord, detecterSequences, estimerCpWprime, wbal, DUREES_RECORDS } from '../src/lib/data/analyse-sortie.js';

const plateau = (w, s) => Array(s).fill(w);
const FTP = 250;

test('meilleures puissances : fenêtre la plus forte, durées trop longues omises, valeurs invalides = 0', () => {
  const courbe = [...plateau(100, 600), ...plateau(300, 120), ...plateau(100, 600)]; // 22 min, un effort de 2 min à 300 W
  const r = meilleuresPuissances(courbe);
  assert.deepEqual(r.map((x) => x.duree), [5, 30, 60, 300, 600, 1200]); // pas 60 min : la sortie est plus courte
  assert.equal(r.find((x) => x.duree === 60).watts, 300);
  assert.equal(r.find((x) => x.duree === 300).watts, 180); // (120 s à 300 W + 180 s à 100 W) / 300 s
  assert.deepEqual(meilleuresPuissances([]), []);
  assert.equal(meilleuresPuissances([null, 'x', NaN, 200], [2])[0].watts, 100); // (0 + 200) / 2 : invalides comptés 0
  assert.equal(DUREES_RECORDS.length, 7);
});

test('texte de durée et statut de record', () => {
  assert.equal(texteDuree(5), '5 s');
  assert.equal(texteDuree(60), '1 min');
  assert.equal(texteDuree(1200), '20 min');
  assert.equal(texteDuree(3600), '1 h');
  assert.equal(statutRecord(300, 300), 'record');
  assert.equal(statutRecord(290, 300), 'proche');
  assert.equal(statutRecord(200, 300), null);
  assert.equal(statutRecord(0, 300), null);
  assert.equal(statutRecord(300, 0), null);
});

test('séquences : échauffement, effort, récupération, retour au calme retrouvés', () => {
  const courbe = [...plateau(110, 600), ...plateau(270, 240), ...plateau(110, 180), ...plateau(270, 240), ...plateau(110, 300)];
  const b = detecterSequences(courbe, FTP);
  assert.ok(b.length >= 5, `blocs : ${b.length}`);
  assert.equal(b[0].name, 'Échauffement');
  assert.equal(b[b.length - 1].name, 'Retour au calme');
  const efforts = b.filter((x) => x.work.int >= 100);
  assert.equal(efforts.length, 2);
  assert.ok(Math.abs(efforts[0].work.min - 4) < 0.5);
  assert.ok(b.every((x) => x.type === 'steady' && x.metric === 'power'));
});

test('séquences : sortie trop courte ou sans FTP = rien ; bruit absorbé, pas de bloc minuscule', () => {
  assert.deepEqual(detecterSequences(plateau(200, 100), FTP), []);
  assert.deepEqual(detecterSequences(plateau(200, 1000), 0), []);
  const bruit = plateau(150, 900).map((v, i) => (i % 60 === 0 ? 400 : v)); // pics de 1 s
  const b = detecterSequences(bruit, FTP);
  assert.ok(b.length <= 2);
  assert.ok(b.every((x) => x.work.min >= 0.15));
});

test('CP et W\' : régression retrouvée sur une sortie construite, rien si aucun effort dur', () => {
  // Sortie « modèle » : 300 W sur 3 min puis 250 W sur 20 min (la régression doit donner une CP plausible)
  const dur = [...plateau(150, 300), ...plateau(330, 120), ...plateau(150, 300), ...plateau(260, 600), ...plateau(150, 300)];
  const e = estimerCpWprime(dur, FTP);
  assert.ok(e && e.cp > 200 && e.cp < 300 && e.wprime > 0);
  assert.equal(estimerCpWprime(plateau(120, 3000), FTP), null);
});

test('W\'bal : se vide au-dessus de la CP, se reconstitue en dessous, jamais au-delà de W\'', () => {
  const courbe = [...plateau(100, 60), ...plateau(400, 60), ...plateau(100, 300)];
  const r = wbal(courbe, 250, 20000);
  assert.equal(r.serie.length, courbe.length);
  assert.equal(r.serie[59], 20000); // rien consommé avant l'effort
  assert.equal(Math.round(r.serie[119]), 20000 - 60 * 150); // 60 s à 150 W au-dessus de la CP = 9000 J puisés
  assert.equal(Math.round(r.epuisement), 9000);
  assert.equal(r.pctEpuise, 45);
  assert.ok(r.serie[419] > r.serie[119]); // reconstitution
  assert.ok(r.serie.every((v) => v <= 20000));
  const brule = wbal(plateau(600, 200), 250, 20000);
  assert.equal(brule.epuisement, 20000); // plafonné à W'
  assert.equal(brule.pctEpuise, 100);
  assert.equal(wbal([], 250, 20000), null);
  assert.equal(wbal(courbe, 0, 20000), null);
  assert.equal(wbal(courbe, 250, 0), null);
});
