import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dureeTotale, indiceZone, lireDuree, metriquesDuSport, normaliser, profilStructure, resume, sportAvecStructure, texteCible, texteDuree, type Bloc } from '../../src/data/calendrier/structure.ts';

const seuil = (): Bloc[] =>
  normaliser([
    { type: 'warmup', name: 'Échauffement', work: { min: 10, int: 50 } },
    { type: 'interval', reps: 5, metric: 'power', unit: 'zone', work: { min: 4, int: 91, intHi: 105 }, rec: { min: 2, int: 40, intHi: 55 } },
    { type: 'cooldown', work: { min: 10, int: 45 } },
  ]);

test('normaliser : types et nombres bornés, une valeur absurde revient à un défaut, jamais de plantage', () => {
  const b = normaliser([{ type: 'piratage', work: { min: 'abc', int: -5 } }, null, 3, { type: 'interval', reps: 5000, work: { min: 9999, int: 9999 }, rec: 'x' }]);
  assert.equal(b.length, 2);
  assert.equal(b[0].type, 'steady');
  assert.ok(b[0].work.min >= 0.1 && b[0].work.min <= 600);
  assert.ok(b[0].work.int >= 1 && b[0].work.int <= 400);
  assert.equal(b[1].reps, 99);
  assert.ok(b[1].rec && b[1].rec.min > 0);
  assert.deepEqual(normaliser('pas un tableau'), []);
  assert.equal(normaliser(new Array(100).fill({ type: 'steady' })).length, 40); // 40 blocs au plus
});

test('zones : indiceZone selon la métrique', () => {
  assert.equal(indiceZone(50, 'power'), 0);
  assert.equal(indiceZone(95, 'power'), 3); // Z4
  assert.equal(indiceZone(130, 'power'), 5);
  assert.equal(indiceZone(65, 'hr'), 1);
  assert.equal(indiceZone(10, 'hr'), 0);
});

test('résumé : durée, charge et profil d\'une séance de seuil', () => {
  const blocs = seuil();
  assert.equal(dureeTotale(blocs), 10 + 5 * 6 + 10);
  const r = resume(blocs, { ftp: 250 }, 'Ride');
  assert.equal(r.dureeMin, 50);
  assert.ok(r.tss > 30 && r.tss < 100);
  assert.ok(r.watts && r.watts > 100);
  assert.ok(r.kj && r.kj > 0);
  const profil = profilStructure(blocs);
  assert.equal(profil.length, 1 + 10 + 1); // échauffement, 5 × (travail + récup), retour au calme
  assert.equal(profil[1].zone, 3); // le travail est en Z4
  assert.equal(profil[2].zone, 0); // la récup en Z1
});

test('résumé : en course, l\'allure donne une distance ; sans référence, des valeurs par défaut', () => {
  const blocs = normaliser([{ type: 'steady', metric: 'pace', unit: 'pct', work: { min: 30, int: 100 } }], 'pace');
  const r = resume(blocs, {}, 'Run');
  assert.equal(r.km, 7.5); // 30 min à 4:00/km
  assert.equal(r.watts, null);
});

test('texteCible : watts, battements ou allure avec la zone', () => {
  const seg = { min: 4, int: 91, intHi: 105 };
  assert.equal(texteCible(seg, 'power', { ftp: 250 }), '228–263 W · Z4');
  assert.equal(texteCible({ min: 10, int: 60, intHi: null }, 'hr', { hrMax: 200 }), '120 bpm · Z2');
  assert.match(texteCible({ min: 10, int: 100, intHi: null }, 'pace', { allureBase: 240 }, 'Run'), /^4:00\/km · Z4$/);
});

test('durées : lecture libre et affichage court', () => {
  assert.equal(lireDuree('15'), 15);
  assert.equal(lireDuree('15min'), 15);
  assert.equal(lireDuree('45s'), 0.75);
  assert.equal(lireDuree('1h30'), 90);
  assert.equal(lireDuree('4:30'), 4.5);
  assert.equal(lireDuree('1,5'), 1.5);
  assert.equal(lireDuree('abc'), null);
  assert.equal(lireDuree(''), null);
  assert.equal(texteDuree(4), '4 min');
  assert.equal(texteDuree(0.75), '45 s');
  assert.equal(texteDuree(65), '1h05');
  assert.equal(texteDuree(4.5), '4:30');
});

test('sports : quelles métriques, lesquels ont une structure', () => {
  assert.deepEqual(metriquesDuSport('Ride'), ['power', 'hr']);
  assert.deepEqual(metriquesDuSport('Run'), ['pace', 'hr']);
  assert.deepEqual(metriquesDuSport('Swim'), ['pace', 'hr']);
  assert.equal(sportAvecStructure('Ride'), true);
  assert.equal(sportAvecStructure('WeightTraining'), false);
  assert.equal(sportAvecStructure('Hyrox'), false);
});
