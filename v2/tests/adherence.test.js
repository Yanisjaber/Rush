import test from 'node:test';
import assert from 'node:assert/strict';
import { aplatir, calculerAdherence, tonAdherence, estLien, candidates } from '../src/lib/data/adherence.js';
import { normaliser } from '../src/lib/data/structure.js';

const FTP = 250;
const quatreFoisQuatre = normaliser([
  { type: 'warmup', name: 'Échauffement', metric: 'power', work: { min: 10, int: 50, intHi: null } },
  { type: 'interval', reps: 2, metric: 'power', work: { min: 4, int: 100, intHi: null }, rec: { min: 3, int: 50, intHi: null } },
  { type: 'cooldown', metric: 'power', work: { min: 5, int: 50, intHi: null } },
]);
// Courbe parfaite : 125 W pendant 10 min, 250 W x 4 min, 125 W x 3 min, 250 W x 4 min, 125 W x 5 min
const courbe = (efforts = 250) => [...Array(600).fill(125), ...Array(240).fill(efforts), ...Array(180).fill(125), ...Array(240).fill(efforts), ...Array(300).fill(125)];

test('aplatir : effort / récupération alternés, numérotation des répétitions', () => {
  const s = aplatir(quatreFoisQuatre);
  assert.deepEqual(s.map((x) => x.libelle), ['Échauffement', 'Intervalles 1', 'Récupération', 'Intervalles 2', 'Récupération', 'Retour au calme']);
  assert.deepEqual(s.map((x) => x.effort), [false, true, false, true, false, false]);
  assert.deepEqual(aplatir(null), []);
});

test('tonAdherence : seuils', () => {
  assert.equal(tonAdherence(1), 'bon');
  assert.equal(tonAdherence(0.95), 'bon');
  assert.equal(tonAdherence(1.1), 'bon');
  assert.equal(tonAdherence(0.9), 'attention');
  assert.equal(tonAdherence(1.2), 'attention');
  assert.equal(tonAdherence(0.7), 'mauvais');
  assert.equal(tonAdherence(1.5), 'mauvais');
});

test('adhérence parfaite : 100 %, deux efforts trouvés à la cible', () => {
  const r = calculerAdherence(quatreFoisQuatre, courbe(250), FTP);
  assert.equal(r.global, 100);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].moyenne, 250);
  assert.equal(r.items[0].cibleBas, 250);
  assert.equal(r.items[0].pct, 100);
  assert.equal(r.items[0].ton, 'bon');
});

test('trop faible ou trop fort : l\'adhérence baisse des deux côtés', () => {
  const faible = calculerAdherence(quatreFoisQuatre, courbe(200), FTP); // 80 % de la cible
  assert.equal(faible.items[0].pct, 80);
  assert.equal(faible.items[0].ton, 'mauvais');
  assert.equal(faible.global, 80);
  const fort = calculerAdherence(quatreFoisQuatre, courbe(300), FTP); // 120 % de la cible
  assert.equal(fort.items[0].pct, 120);
  assert.equal(fort.items[0].ton, 'attention');
  assert.equal(fort.global, 80); // dépasser n'est pas plus « adhérent »
});

test('la meilleure fenêtre est retrouvée même si la récupération dure plus longtemps que prévu', () => {
  const decalee = [...Array(600).fill(125), ...Array(240).fill(250), ...Array(400).fill(125), ...Array(240).fill(250), ...Array(300).fill(125)];
  const r = calculerAdherence(quatreFoisQuatre, decalee, FTP);
  assert.equal(r.items[1].moyenne, 250);
});

test('cas non évaluables : pas de structure, de courbe, de FTP, ou structure sans effort en puissance', () => {
  assert.equal(calculerAdherence([], courbe(), FTP), null);
  assert.equal(calculerAdherence(quatreFoisQuatre, [], FTP), null);
  assert.equal(calculerAdherence(quatreFoisQuatre, courbe(), 0), null);
  assert.equal(calculerAdherence(quatreFoisQuatre, null, FTP), null);
  const cardio = normaliser([{ type: 'steady', metric: 'hr', work: { min: 20, int: 80 } }], 'hr');
  assert.equal(calculerAdherence(cardio, courbe(), FTP), null);
});

test('courbe plus courte que le plan : on note ce qu\'on peut, effort tronqué signalé', () => {
  const courte = courbe(250).slice(0, 700); // fin au milieu du premier effort
  const r = calculerAdherence(quatreFoisQuatre, courte, FTP);
  assert.ok(r.items.length >= 1);
  assert.ok(r.items.every((i) => Number.isFinite(i.moyenne)));
});

test('lien prévu-réalisé et candidates', () => {
  assert.equal(estLien('3f2b8a52-5c1e-4b3f-9a6d-123456789abc'), true);
  assert.equal(estLien('none'), false);
  assert.equal(estLien(null), false);
  const famille = (s) => (['Ride', 'VirtualRide'].includes(s) ? 'velo' : s === 'Run' ? 'course' : 'autre');
  const prevues = [
    { id: 1, date: '2026-10-07', sport: 'Ride', category: 'entrainement' },
    { id: 2, date: '2026-10-07', sport: 'Run', category: 'entrainement' },
    { id: 3, date: '2026-10-07', sport: 'Ride', category: 'competition' },
    { id: 4, date: '2026-10-08', sport: 'Ride', category: 'entrainement' },
  ];
  assert.deepEqual(candidates(prevues, { start_date_local: '2026-10-07T18:00:00', sport: 'VirtualRide' }, famille).map((p) => p.id), [1]);
  assert.deepEqual(candidates(null, { start_date_local: '2026-10-07', sport: 'Ride' }, famille), []);
});
