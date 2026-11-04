import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donneesDemo, recordsVeloDemo, seriesForceDemo } from '../../src/data/demo/demo.ts';
import { dateIsoLocale } from '../../src/data/outils/format.ts';
import { recordsParSeance } from '../../src/data/sports/force.ts';

const date = new Date(2026, 9, 19); // lundi 19 octobre 2026

test('donneesDemo : déterministe (deux appels, mêmes données)', () => {
  assert.deepEqual(donneesDemo(date), donneesDemo(date));
});

test('donneesDemo : 127 séances sur 84 jours (dont un footing fait ce matin, Hyrox, ski, natation, enchaînements et deux courses), de la plus récente à la plus ancienne', () => {
  const { seances } = donneesDemo(date);
  assert.equal(seances.length, 127);
  assert.ok(seances.some((s) => s.id === `demo-matin-${dateIsoLocale(date)}`));
  for (let i = 1; i < seances.length; i++) assert.ok(seances[i - 1].start_date_local >= seances[i].start_date_local);
});

test('donneesDemo : 90 jours de charge, CTL/ATL/TSB cohérents', () => {
  const { metriques } = donneesDemo(date);
  assert.equal(metriques.length, 90);
  assert.equal(metriques.at(-1)?.iso_date, dateIsoLocale(date));
  // TSB = CTL − ATL, à l'arrondi près : les trois valeurs sont arrondies à 0,1 séparément (0,05 d'erreur chacune, donc 0,15 au plus)
  for (const m of metriques) assert.ok(Math.abs(m.tsb - (m.ctl - m.atl)) <= 0.15, m.iso_date);
});

test('donneesDemo : la séance prévue du jour est une séance de muscu reliée à un programme', () => {
  const { planifiees } = donneesDemo(date);
  const aujourdhui = planifiees.find((p) => p.date === dateIsoLocale(date));
  assert.equal(aujourdhui?.sport, 'WeightTraining');
  assert.equal(aujourdhui?.programme_id, 'demo-prog-legs');
});

test('donneesDemo : toujours trois séances prévues aujourd\'hui, de trois sports différents', () => {
  for (const jour of [date, new Date(2026, 11, 3), new Date(2027, 1, 14)]) {
    const iso = dateIsoLocale(jour);
    const prevues = donneesDemo(jour).planifiees.filter((p) => p.date === iso);
    assert.deepEqual(prevues.map((p) => p.sport), ['WeightTraining', 'Swim', 'Ride'], iso);
  }
});

test('donneesDemo : le réglage garde de 0 à 5 séances prévues aujourd\'hui (trois par défaut, valeurs absurdes bornées)', () => {
  const iso = dateIsoLocale(date);
  const aujourdhui = (n?: number) => donneesDemo(date, 84, n === undefined ? {} : { prevuesAujourdhui: n }).planifiees.filter((p) => p.date === iso).map((p) => p.sport);
  assert.deepEqual(aujourdhui(), ['WeightTraining', 'Swim', 'Ride']);
  assert.deepEqual(aujourdhui(0), []);
  assert.deepEqual(aujourdhui(1), ['WeightTraining']);
  assert.deepEqual(aujourdhui(2), ['WeightTraining', 'Swim']);
  assert.deepEqual(aujourdhui(5), ['WeightTraining', 'Swim', 'Ride', 'Hyrox', 'Rowing']);
  assert.deepEqual(aujourdhui(4), ['WeightTraining', 'Swim', 'Ride', 'Hyrox']);
  assert.deepEqual(aujourdhui(99), ['WeightTraining', 'Swim', 'Ride', 'Hyrox', 'Rowing']);
  assert.deepEqual(aujourdhui(2.7), ['WeightTraining', 'Swim']);
  assert.deepEqual(aujourdhui(-5), []);
  // les séances des autres jours ne bougent pas
  assert.equal(donneesDemo(date, 84, { prevuesAujourdhui: 0 }).planifiees.filter((p) => p.date !== iso).length, donneesDemo(date).planifiees.filter((p) => p.date !== iso).length);
});

test('seriesForceDemo : séries triées de la plus récente à la plus ancienne, avec des records à afficher', () => {
  const series = seriesForceDemo(date);
  assert.equal(series.length, 407);
  for (let i = 1; i < series.length; i++) assert.ok(series[i - 1].date >= series[i].date);
  assert.equal(recordsParSeance(series).size, 17);
});

test('seriesForceDemo : le RIR n\'existe que sur les 5 dernières semaines', () => {
  const series = seriesForceDemo(date);
  const limite = dateIsoLocale(new Date(2026, 9, 19 - 35));
  for (const s of series) assert.equal('rir' in s, s.date > limite, `${s.date} ${s.id}`);
});

test('recordsVeloDemo : des sorties, et une courbe de puissance qui baisse avec la durée', () => {
  const d = recordsVeloDemo(date);
  assert.ok(d.sorties.length > 50);
  assert.ok(d.sorties.every((s) => s.sport === 'Ride' && s.id && s.iso));
  const c = d.courbe();
  assert.ok(c.length > 20);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].duree > c[i - 1].duree && c[i].top[0].valeur <= c[i - 1].top[0].valeur * 1.05); // la vraie courbe peut remonter un peu entre deux durées proches (un pic isolé), comme sur le serveur
  assert.ok(c.every((p) => p.top.length <= 3 && p.top.every((t, k) => k === 0 || t.valeur <= p.top[k - 1].valeur)));
});

test('recordsVeloDemo : la courbe d\'une année ne contient que des sorties de cette année', () => {
  const c = recordsVeloDemo(date).courbe(2026);
  assert.ok(c.length > 0);
  assert.ok(c.every((p) => p.top.every((t) => t.iso.startsWith('2026-'))));
});
