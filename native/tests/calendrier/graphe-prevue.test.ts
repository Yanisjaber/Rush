import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detailIntervalles, grapheDeBlocs, lignesIntervalles, texteAllure, texteValeur } from '../../src/data/calendrier/graphe-prevue.ts';
import { distanceSegment, valeurSegment, type Bloc } from '../../src/data/calendrier/structure.ts';

const seg = (min: number, int: number, intHi: number | null = null) => ({ min, int, intHi });
const course: Bloc[] = [
  { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'pct', work: seg(10, 75) },
  { type: 'interval', name: 'Intervalles', reps: 3, metric: 'pace', unit: 'pct', work: seg(4.6, 105), rec: seg(2, 70) },
  { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'pace', unit: 'pct', work: seg(10, 70) },
];
const ref = { allureBase: 300 }; // 5:00/km à 100 %

test('valeurSegment : l\'allure est plus rapide (secondes plus basses) quand l\'intensité monte', () => {
  assert.equal(valeurSegment(seg(5, 100), 'pace', ref, 'Run'), 300);
  assert.ok(valeurSegment(seg(5, 105), 'pace', ref, 'Run') < 300);
  assert.ok(valeurSegment(seg(5, 75), 'pace', ref, 'Run') > 300);
});

test('valeurSegment : des watts et des battements à partir de la FTP et de la FC max', () => {
  assert.equal(valeurSegment(seg(15, 90, 94), 'power', { ftp: 285 }, 'Ride'), Math.round((285 * 92) / 100));
  assert.equal(valeurSegment(seg(15, 80), 'hr', { hrMax: 190 }, 'Run'), 152);
});

test('distanceSegment : seulement à allure cible, en kilomètres (en mètres pour la natation)', () => {
  const km = distanceSegment(seg(5, 100), 'pace', ref, 'Run');
  assert.ok(Math.abs((km ?? 0) - 1) < 0.01); // 5 min à 5:00/km = 1 km
  assert.equal(distanceSegment(seg(5, 100), 'power', { ftp: 250 }, 'Ride'), null);
  const m = distanceSegment(seg(2, 100), 'pace', { allureBase: 100 }, 'Swim'); // 2 min à 1:40/100 m = 120 m
  assert.ok(Math.abs((m ?? 0) - 120) < 1);
});

test('grapheDeBlocs : un segment par bloc, par effort et par récupération, les efforts sont marqués', () => {
  const g = grapheDeBlocs(course, ref, 'Run');
  assert.ok(g);
  assert.equal(g?.segments.length, 1 + 3 * 2 + 1); // échauffement, 3 fois (effort + récupération), retour au calme
  assert.equal(g?.allure, true);
  assert.equal(g?.segments.filter((s) => s.effort).length, 3);
  assert.ok(Math.abs((g?.total ?? 0) - (10 + 3 * 4.6 + 3 * 2 + 10)) < 1e-9);
});

test('grapheDeBlocs : sans bloc, rien', () => {
  assert.equal(grapheDeBlocs([], ref, 'Run'), null);
});

test('textes : une allure s\'écrit minutes:secondes, des watts en nombre', () => {
  assert.equal(texteAllure(275), '4:35');
  assert.equal(texteValeur(275, 'pace'), '4:35');
  assert.equal(texteValeur(265.4, 'power'), '265');
});

test('lignesIntervalles : une ligne par bloc avec effort, distance, cible et récupération', () => {
  const l = lignesIntervalles(course, ref, 'Run');
  assert.equal(l.length, 3);
  assert.equal(l[1].repetitions, 3);
  assert.match(l[1].effort, /^\d+:\d{2} · (\d+ m|\d+,\d km)$/); // durée « 4:36 » puis distance « 960 m » ou « 1,0 km »
  assert.ok(l[1].cible.includes('/km'));
  assert.ok(l[1].recup.length > 0);
  assert.equal(l[0].recup, ''); // un échauffement n'a pas de récupération
});

test('lignesIntervalles : un nom long du Coach, avec des chiffres, laisse place au nom du genre de bloc', () => {
  const longs: Bloc[] = [{ type: 'interval', name: '3 × 1000 m à 5:00/km', reps: 3, metric: 'pace', unit: 'pct', work: seg(5, 100), rec: seg(2, 70) }];
  assert.equal(lignesIntervalles(longs, ref, 'Run')[0].nom, 'Intervalles');
  const court: Bloc[] = [{ type: 'steady', name: 'Tempo', reps: 1, metric: 'pace', unit: 'pct', work: seg(15, 90) }];
  assert.equal(lignesIntervalles(court, ref, 'Run')[0].nom, 'Tempo');
});

test('lignesIntervalles : 1 000 m s\'écrit « 1,0 km », pas « 1000 m »', () => {
  const b: Bloc[] = [{ type: 'interval', name: '', reps: 3, metric: 'pace', unit: 'pct', work: seg(5, 100), rec: seg(2, 70) }];
  assert.ok(lignesIntervalles(b, { allureBase: 300 }, 'Run')[0].effort.endsWith('1,0 km'));
});

test('detailIntervalles : un échauffement, un groupe « 3× » (effort puis récupération), un retour au calme', () => {
  const d = detailIntervalles(course, ref, 'Run');
  assert.equal(d.length, 3);
  assert.equal(d[0].genre, 'ligne');
  assert.equal(d[1].genre, 'groupe');
  assert.equal(d[2].genre, 'ligne');
  const g = d[1];
  if (g.genre === 'groupe') {
    assert.equal(g.repetitions, 3);
    assert.equal(g.lignes.length, 2);
    assert.match(g.lignes[0].libelle, /m$|km$/); // la distance de l'effort
    assert.equal(g.lignes[1].libelle, 'Récupération');
    assert.ok(!/Z\d/.test(g.lignes[0].cible)); // la zone est portée par la pastille, pas par la cible
    assert.match(g.lignes[0].cible, /\/km$/);
  }
  if (d[0].genre === 'ligne') assert.equal(d[0].ligne.libelle, 'Échauffement');
  if (d[2].genre === 'ligne') assert.equal(d[2].ligne.libelle, 'Retour au calme');
});

test('detailIntervalles : à vélo, des watts, et pas de distance dans le libellé de l\'effort', () => {
  const velo: Bloc[] = [{ type: 'interval', name: '', reps: 3, metric: 'power', unit: 'pct', work: seg(15, 90, 94), rec: seg(5, 45) }];
  const d = detailIntervalles(velo, { ftp: 285 }, 'Ride')[0];
  assert.equal(d.genre, 'groupe');
  if (d.genre === 'groupe') {
    assert.match(d.lignes[0].cible, /^\d+–\d+ W$/);
    assert.equal(d.lignes[0].libelle, '');
  }
});
