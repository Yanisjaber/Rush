import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliser, resume, indiceZone, lireDuree, texteDuree, lireCible, lireCommande, modeles, nouveauBloc, texteCible, segmentsDuBloc, metriquesDuSport, sportAvecStructure } from '../src/lib/data/structure.js';

const REF = { ftp: 250, hrMax: 190 };

test('normaliser : rejette ce qui n\'est pas un tableau, borne les valeurs, ignore les types inconnus', () => {
  assert.deepEqual(normaliser(null), []);
  assert.deepEqual(normaliser({ type: 'warmup' }), []);
  const [b] = normaliser([{ type: 'hack', name: 'x'.repeat(200), reps: 9999, metric: 'zzz', work: { min: -5, int: 'abc', intHi: 0 } }], 'hr');
  assert.equal(b.type, 'steady');
  assert.equal(b.name.length, 60);
  assert.equal(b.reps, 1); // seuls les blocs d'intervalles répètent
  assert.equal(b.metric, 'hr');
  assert.ok(b.work.min >= 0.1 && Number.isFinite(b.work.int));
  assert.equal(b.work.intHi, null);
});

test('normaliser : plafonne à 40 blocs, borne les répétitions des intervalles, crée la récup', () => {
  assert.equal(normaliser(Array.from({ length: 100 }, () => ({ type: 'steady' }))).length, 40);
  const [i] = normaliser([{ type: 'interval', reps: 500, work: { min: 1, int: 100 } }]);
  assert.equal(i.reps, 99);
  assert.ok(i.rec);
});

test('normaliser : une propriété héritée (__proto__) ne passe pas', () => {
  const [b] = normaliser(JSON.parse('[{"type":"steady","__proto__":{"polluee":true},"work":{"min":5,"int":70}}]'));
  assert.equal(({}).polluee, undefined);
  assert.equal(b.polluee, undefined);
});

test('indiceZone : par bornes basses, pas par proximité', () => {
  assert.equal(indiceZone(50, 'power'), 0);
  assert.equal(indiceZone(65, 'power'), 1);
  assert.equal(indiceZone(91, 'power'), 3);
  assert.equal(indiceZone(300, 'power'), 6);
  assert.equal(indiceZone(75, 'hr'), 2);
  assert.equal(indiceZone(65, 'hr'), 1);
});

test('segmentsDuBloc : travail / récup alternés', () => {
  const [b] = normaliser([{ type: 'interval', reps: 3, work: { min: 4, int: 110 }, rec: { min: 2, int: 45 } }]);
  assert.deepEqual(segmentsDuBloc(b).map((s) => s.role), ['travail', 'recup', 'travail', 'recup', 'travail', 'recup']);
});

test('resume : 1 h à 100 % de la FTP = 100 TSS, IF 1, 900 kJ', () => {
  const blocs = normaliser([{ type: 'steady', metric: 'power', work: { min: 60, int: 100 } }]);
  const r = resume(blocs, REF);
  assert.equal(r.dureeMin, 60);
  assert.equal(r.tss, 100);
  assert.equal(r.facteurIntensite, 1);
  assert.equal(r.kj, 900);
  assert.equal(r.watts, 250);
});

test('resume : structure vide, course (distance depuis l\'allure)', () => {
  assert.equal(resume([], REF).dureeMin, 0);
  const course = normaliser([{ type: 'steady', metric: 'pace', work: { min: 60, int: 100 } }], 'pace');
  const r = resume(course, { allureBase: 240 }, 'Run');
  assert.equal(r.km, 15); // 4:00 /km pendant 1 h
  assert.equal(r.kj, null);
});

test('lireDuree : formats libres', () => {
  assert.equal(lireDuree('15'), 15);
  assert.equal(lireDuree("15'"), 15);
  assert.equal(lireDuree('45s'), 0.75);
  assert.equal(lireDuree('1h30'), 90);
  assert.equal(lireDuree('4:30'), 4.5);
  assert.equal(lireDuree('1,5'), 1.5);
  assert.equal(lireDuree('abc'), null);
  assert.equal(lireDuree(''), null);
});

test('texteDuree', () => {
  assert.equal(texteDuree(4), '4 min');
  assert.equal(texteDuree(0.75), '45 s');
  assert.equal(texteDuree(65), '1h05');
  assert.equal(texteDuree(4.5), '4:30');
});

test('lireCible : zone, pourcentage, watts, bpm', () => {
  assert.deepEqual(lireCible('Z4', 'power'), { metric: 'power', int: 91, intHi: 105, unit: 'zone' });
  assert.equal(lireCible('z9', 'power'), null);
  assert.equal(lireCible('90%', 'power').int, 90);
  assert.equal(lireCible('250W', 'power', REF).int, 100);
  assert.equal(lireCible('95bpm', 'power', REF).metric, 'hr');
  assert.equal(lireCible('n\'importe quoi'), null);
});

test('lireCommande : intervalles avec récup, bloc simple, entrées invalides', () => {
  const b = lireCommande("4x4' Z5 récup 3'", 'power', REF);
  assert.equal(b.type, 'interval');
  assert.equal(b.reps, 4);
  assert.equal(b.work.min, 4);
  assert.equal(b.rec.min, 3);
  assert.equal(b.work.int, 106);

  const s = lireCommande("20' à 250w", 'power', REF);
  assert.equal(s.type, 'steady');
  assert.equal(s.work.int, 100);

  const secondes = lireCommande('45" Z6', 'power', REF);
  assert.equal(secondes.work.min, 0.75);

  assert.equal(lireCommande('blabla', 'power', REF), null);
  assert.equal(lireCommande("0' Z2", 'power', REF), null);
  assert.equal(lireCommande("500x1' Z2", 'power', REF), null);
  assert.equal(lireCommande('', 'power', REF), null);
});

test('modeles et nouveauBloc : produisent des structures valides', () => {
  for (const m of modeles('power')) assert.ok(m.blocs.length >= 2 && resume(m.blocs, REF).tss > 0, m.nom);
  assert.equal(nouveauBloc('interval').reps, 4);
  assert.ok(nouveauBloc('warmup').work.min > 0);
});

test('texteCible : watts, cardio, allure', () => {
  assert.equal(texteCible({ min: 5, int: 100, intHi: null }, 'power', REF), '250 W · Z4');
  assert.equal(texteCible({ min: 5, int: 100, intHi: null }, 'pace', { allureBase: 240 }, 'Run'), '4:00/km · Z4');
  assert.match(texteCible({ min: 5, int: 90, intHi: 100 }, 'hr', REF), /bpm/);
});

test('sports : métriques et éligibilité', () => {
  assert.deepEqual(metriquesDuSport('Run'), ['pace', 'hr']);
  assert.deepEqual(metriquesDuSport('Ride'), ['power', 'hr']);
  assert.equal(sportAvecStructure('WeightTraining'), false);
  assert.equal(sportAvecStructure('Swim'), true);
});
