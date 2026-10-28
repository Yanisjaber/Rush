import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carresDuJour, chargeSeance, formeActuelle, prochainesPrevues, repartition7Jours, semaineCourante } from '../src/data/bilan/synthese.ts';
import type { Metrique, Prevue, Seance } from '../src/data/types.ts';

test('chargeSeance : le TSS enregistré est utilisé tel quel', () => {
  assert.equal(chargeSeance({ tss: 72, moving_time: 3600, avg_heartrate: 150 }), 72);
});

test('chargeSeance : sans TSS, estimation à partir de la durée (45 pts/h avec cardio, 35 sans)', () => {
  assert.equal(chargeSeance({ tss: null, moving_time: 3600, avg_heartrate: 150 }), 45);
  assert.equal(chargeSeance({ tss: null, moving_time: 3600, avg_heartrate: null }), 35);
  assert.equal(chargeSeance({ tss: 0, moving_time: 7200, avg_heartrate: null }), 70);
  assert.equal(chargeSeance({ tss: null, moving_time: 0, avg_heartrate: null }), 0);
});

const prevue = (id: string, date: string, category = 'entrainement'): Prevue => ({
  id, name: id, date, sport: 'Run', duration: 50, tss: null, category, km: null,
});
const aujourdhui = new Date(2026, 9, 19);

test('prochainesPrevues : aujourd\'hui compris, passé exclu, tri par date', () => {
  const liste = [prevue('c', '2026-10-25'), prevue('hier', '2026-10-18'), prevue('a', '2026-10-19'), prevue('b', '2026-10-21')];
  assert.deepEqual(prochainesPrevues(liste, aujourdhui, 10).map((p) => p.id), ['a', 'b', 'c']);
});

test('prochainesPrevues : les compétitions sont exclues (elles ont leur dossard)', () => {
  const liste = [prevue('course', '2026-12-13', 'competition'), prevue('seance', '2026-10-20')];
  assert.deepEqual(prochainesPrevues(liste, aujourdhui).map((p) => p.id), ['seance']);
});

test('prochainesPrevues : respecte la limite, tolère une liste absente', () => {
  const liste = [prevue('a', '2026-10-20'), prevue('b', '2026-10-21'), prevue('c', '2026-10-22')];
  assert.equal(prochainesPrevues(liste, aujourdhui, 2).length, 2);
  assert.deepEqual(prochainesPrevues(null, aujourdhui), []);
  assert.deepEqual(prochainesPrevues(undefined, aujourdhui), []);
});

test('prochainesPrevues : ne modifie pas la liste reçue', () => {
  const liste = [prevue('b', '2026-10-21'), prevue('a', '2026-10-20')];
  prochainesPrevues(liste, aujourdhui);
  assert.deepEqual(liste.map((p) => p.id), ['b', 'a']);
});

const metrique = (tsb: number | null, ctl = 50, atl = 60): Metrique =>
  ({ iso_date: '2026-10-19', tss: 0, ctl, atl, tsb: tsb as number, duration_min: 0, activity_count: 0 });

test('formeActuelle : sans données, null', () => {
  assert.equal(formeActuelle([]), null);
});

test('formeActuelle : prend le dernier jour et arrondit', () => {
  const f = formeActuelle([metrique(-40, 10, 20), metrique(3.6, 50.4, 46.5)]);
  assert.deepEqual(f, { ctl: 50, atl: 47, tsb: 4, libelle: 'Équilibré' });
});

test('formeActuelle : libellés aux seuils (≥15 très frais, ≥5 frais, ≤-10 fatigué, ≤-30 très fatigué)', () => {
  const libelle = (tsb: number) => formeActuelle([metrique(tsb)])?.libelle;
  assert.equal(libelle(40), 'Très frais');
  assert.equal(libelle(15), 'Très frais');
  assert.equal(libelle(14.9), 'Frais');
  assert.equal(libelle(5), 'Frais');
  assert.equal(libelle(4.9), 'Équilibré');
  assert.equal(libelle(0), 'Équilibré');
  assert.equal(libelle(-9.9), 'Équilibré');
  assert.equal(libelle(-10), 'Fatigué');
  assert.equal(libelle(-29.9), 'Fatigué');
  assert.equal(libelle(-30), 'Très fatigué');
});

test('formeActuelle : une valeur illisible vaut 0', () => {
  assert.equal(formeActuelle([metrique(null)])?.tsb, 0);
});

const seance = (id: string, date: string, sport: string, minutes: number): Seance => ({
  id, name: id, sport, start_date_local: `${date}T18:00:00+00:00`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'entrainement',
});

test('repartition7Jours : additionne par sport sur 7 jours glissants, du plus long au plus court', () => {
  const r = repartition7Jours(
    [
      seance('a', '2026-10-18', 'Run', 60),
      seance('b', '2026-10-17', 'Ride', 120),
      seance('c', '2026-10-16', 'TrailRun', 30), // le trail compte comme de la course
      seance('d', '2026-10-12', 'Run', 45), // 7 jours pile avant : hors de la fenêtre
      seance('e', '2026-10-13', 'Swim', 40), // 6 jours avant : dedans
    ],
    aujourdhui,
  );
  assert.deepEqual(r.segments, [
    { famille: 'velo', secondes: 7200 },
    { famille: 'course', secondes: 5400 },
    { famille: 'natation', secondes: 2400 },
  ]);
  assert.equal(r.totalSecondes, 15000);
});

test('repartition7Jours : aucune séance, total nul', () => {
  assert.deepEqual(repartition7Jours([], aujourdhui), { segments: [], totalSecondes: 0 });
});

test('semaineCourante : sept jours du lundi au dimanche, aujourd\'hui marqué', () => {
  const jours = semaineCourante([], new Date(2026, 9, 21)); // mercredi 21 octobre
  assert.deepEqual(jours.map((j) => j.jour), ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
  assert.deepEqual(jours.map((j) => j.num), [19, 20, 21, 22, 23, 24, 25]);
  assert.deepEqual(jours.map((j) => j.aujourdhui), [false, false, true, false, false, false, false]);
  assert.deepEqual(jours.map((j) => j.futur), [false, false, false, true, true, true, true]);
});

test('semaineCourante : un dimanche appartient à la semaine qui finit ce jour-là', () => {
  const jours = semaineCourante([], new Date(2026, 9, 25)); // dimanche 25 octobre
  assert.equal(jours[0].iso, '2026-10-19');
  assert.equal(jours[6].aujourdhui, true);
});

test('semaineCourante : range les séances faites par jour, et les prévues seulement à partir d\'aujourd\'hui', () => {
  const jours = semaineCourante(
    [seance('lundi', '2026-10-19', 'Run', 50), seance('hier', '2026-10-20', 'Ride', 90)],
    new Date(2026, 9, 21),
    [prevue('passee', '2026-10-20'), prevue('aujourdhui', '2026-10-21'), prevue('demain', '2026-10-22')],
  );
  assert.deepEqual(jours[0].seances.map((s) => s.id), ['lundi']);
  assert.deepEqual(jours[1].seances.map((s) => s.id), ['hier']);
  assert.deepEqual(jours[1].prevues, []); // prévue dans le passé : plus « à venir »
  assert.deepEqual(jours[2].prevues.map((p) => p.id), ['aujourdhui']);
  assert.deepEqual(jours[3].prevues.map((p) => p.id), ['demain']);
});

test('carresDuJour : jusqu\'à 3 séances un carré chacune (faites d\'abord), au-delà 2 carrés et le nombre des autres', () => {
  const s = (id: string, sport: string) => ({ id, sport });
  const jour = (faites: number, prevues: number) => ({
    seances: Array.from({ length: faites }, (_, i) => s(`f${i}`, 'Run')),
    prevues: Array.from({ length: prevues }, (_, i) => s(`p${i}`, 'Ride')),
  });
  assert.deepEqual(carresDuJour(jour(0, 0)), { visibles: [], cachees: 0 });
  assert.deepEqual(carresDuJour(jour(1, 2)).visibles.map((c) => c.fait), [true, false, false]);
  assert.equal(carresDuJour(jour(1, 2)).cachees, 0);
  // 1 faite + 3 prévues : la faite et la première prévue, et « +2 »
  const quatre = carresDuJour(jour(1, 3));
  assert.deepEqual(quatre.visibles.map((c) => c.cle), ['sf0', 'pp0']);
  assert.equal(quatre.cachees, 2);
  assert.equal(carresDuJour(jour(1, 5)).cachees, 4);
  // la couleur vient de la famille du sport (vélo virtuel = vélo, trail = course)
  assert.deepEqual(carresDuJour({ seances: [s('a', 'TrailRun')], prevues: [s('b', 'VirtualRide')] }, (f) => `#${f}`).visibles.map((c) => c.couleur), ['#course', '#velo']);
});
