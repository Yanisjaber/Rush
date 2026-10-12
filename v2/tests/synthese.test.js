import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chargeSeance,
  chargeParSemaine,
  conditionHebdo,
  formeActuelle,
  repartition7Jours,
  casesRegularite,
  joursActifs,
  semaineCourante,
} from '../src/lib/data/synthese.js';
import { familleSport, familleAffichage } from '../src/lib/data/familles.js';

// Lundi 12 octobre 2026
const AUJ = new Date(2026, 9, 12, 14, 0);
const seance = (date, sport, minutes, extra = {}) => ({
  id: `${date}-${sport}`,
  name: 'Séance',
  sport,
  start_date_local: `${date}T18:00:00+00:00`,
  moving_time: minutes * 60,
  ...extra,
});

test('familleSport : rapproche les types Strava, inconnu → autre', () => {
  assert.equal(familleSport('Ride'), 'velo');
  assert.equal(familleSport('VirtualRide'), 'velo');
  assert.equal(familleSport('Run'), 'course');
  assert.equal(familleSport('TrailRun'), 'trail');
  assert.equal(familleAffichage('TrailRun'), 'course'); // le trail compte comme de la course dans les graphiques
  assert.equal(familleSport('WeightTraining'), 'muscu');
  assert.equal(familleSport('Soccer'), 'autre');
  assert.equal(familleSport(undefined), 'autre');
  assert.equal(familleSport('constructor'), 'autre'); // pas de piège de prototype
});

test('chargeSeance : le TSS enregistré, sinon une estimation selon la durée', () => {
  assert.equal(chargeSeance({ tss: 51, moving_time: 3600 }), 51);
  assert.equal(chargeSeance({ tss: null, moving_time: 3600, avg_heartrate: 150 }), 45);
  assert.equal(chargeSeance({ tss: 0, moving_time: 3600 }), 35);
  assert.equal(chargeSeance({ moving_time: 0 }), 0);
});

test('chargeParSemaine : range par semaine glissante et par sport, la dernière colonne = 7 derniers jours', () => {
  const seances = [
    seance('2026-10-12', 'Run', 60, { tss: 70 }), // aujourd'hui → dernière colonne
    seance('2026-10-06', 'Ride', 60, { tss: 50 }), // il y a 6 jours → encore dans la dernière
    seance('2026-10-04', 'Ride', 60, { tss: 40 }), // il y a 8 jours → avant-dernière
    seance('2025-01-01', 'Run', 60, { tss: 999 }), // hors fenêtre
  ];
  const r = chargeParSemaine(seances, 12, AUJ);
  assert.equal(r.etiquettes.length, 12);
  assert.equal(r.etiquettes[11], 'Auj.');
  const velo = r.series.find((s) => s.nom === 'velo');
  const course = r.series.find((s) => s.nom === 'course');
  assert.equal(velo.valeurs[11], 50);
  assert.equal(velo.valeurs[10], 40);
  assert.equal(course.valeurs[11], 70);
  assert.equal(course.valeurs.reduce((a, b) => a + b, 0), 70); // la séance de 2025 est ignorée
  assert.equal(r.series[0].nom, 'velo'); // trié par charge totale décroissante (90 contre 70)
});

test('conditionHebdo : CTL à la fin de chaque semaine, valeur précédente si trou', () => {
  const m = [
    { iso_date: '2026-09-01', ctl: 10 },
    { iso_date: '2026-10-12', ctl: 20 },
  ];
  const c = conditionHebdo(m, 4, AUJ);
  assert.equal(c.length, 4);
  assert.equal(c[3], 20);
  assert.equal(c[0], 10);
  assert.deepEqual(conditionHebdo([], 4, AUJ), []);
});

test('formeActuelle : libellés selon le TSB', () => {
  const f = (tsb) => formeActuelle([{ ctl: 12, atl: 6, tsb }]);
  assert.equal(f(20).libelle, 'Très frais');
  assert.equal(f(5).libelle, 'Frais');
  assert.equal(f(0).libelle, 'Équilibré');
  assert.equal(f(-12).libelle, 'Fatigué');
  assert.equal(f(-35).libelle, 'Très fatigué');
  assert.equal(formeActuelle([]), null);
});

test('repartition7Jours : additionne le temps par sport sur 7 jours seulement', () => {
  const r = repartition7Jours(
    [seance('2026-10-12', 'Run', 60), seance('2026-10-10', 'Run', 30), seance('2026-10-09', 'Ride', 120), seance('2026-09-01', 'Run', 600)],
    AUJ,
  );
  assert.equal(r.totalSecondes, (60 + 30 + 120) * 60);
  assert.equal(r.segments[0].nom, 'velo');
  assert.equal(r.segments[1].valeur, 90 * 60);
});

test('casesRegularite : 7 rangées × 12 colonnes, séance du jour à la bonne place, futur marqué vide', () => {
  const cases = casesRegularite([seance('2026-10-12', 'Run', 60, { tss: 70 })], 12, AUJ);
  assert.equal(cases.length, 84);
  // Lundi 12 octobre = rangée 0 (lundi), dernière colonne (11)
  const aujourdhui = cases[0 * 12 + 11];
  assert.equal(aujourdhui.vide, false);
  assert.equal(aujourdhui.intensite, 2);
  assert.notEqual(aujourdhui.couleur, 'transparent');
  // Mardi 13 octobre = demain : vide
  assert.equal(cases[1 * 12 + 11].vide, true);
  // Une semaine avant, même jour sans séance : pas vide mais intensité 0
  assert.equal(cases[0 * 12 + 10].vide, false);
  assert.equal(cases[0 * 12 + 10].intensite, 0);
});

test('joursActifs : jours distincts avec séance sur la période', () => {
  const s = [seance('2026-10-12', 'Run', 60), seance('2026-10-12', 'Ride', 30), seance('2026-10-10', 'Run', 40), seance('2025-01-01', 'Run', 40)];
  assert.equal(joursActifs(s, 12, AUJ), 2);
});

test('semaineCourante : lundi → dimanche, aujourd\'hui marqué, séances rangées par jour', () => {
  const j = semaineCourante([seance('2026-10-12', 'Run', 60), seance('2026-10-14', 'Ride', 90)], AUJ);
  assert.equal(j.length, 7);
  assert.equal(j[0].jour, 'Lun');
  assert.equal(j[0].num, 12);
  assert.equal(j[0].aujourdhui, true);
  assert.equal(j[0].seances.length, 1);
  assert.equal(j[2].futur, true);
  assert.equal(j[2].seances.length, 1);
  assert.equal(j[6].num, 18);
});

test('couleurSport : sport inconnu ou piégé → couleur neutre', async () => {
  const { couleurSport } = await import('../src/lib/sports.js');
  assert.equal(couleurSport('course'), 'var(--sport-course)');
  assert.equal(couleurSport('constructor'), 'var(--sport-neutre)');
  assert.equal(couleurSport(undefined), 'var(--sport-neutre)');
});
