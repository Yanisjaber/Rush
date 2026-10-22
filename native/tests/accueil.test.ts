import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donneesDemoAccueil, famillesDe, type DonneesAccueil } from '../src/data/accueil.ts';
import { appliquer, appliquerTout, cleRetouche, estManuelle } from '../src/data/retouches.ts';
import { fusionnerFamilles, nettoyerSports, onboardingNecessaire, sportsCoches } from '../src/data/sports-choisis.ts';
import { clair, sombre } from '../src/theme/couleurs.ts';
import type { Seance } from '../src/data/types.ts';

const date = new Date(2026, 9, 19);

// --- l'enveloppe de l'Accueil ---------------------------------------------

test('donneesDemoAccueil : toutes les parties de l\'enveloppe sont présentes', () => {
  const d = donneesDemoAccueil(date);
  assert.equal(d.seances.length, 162);
  assert.equal(d.dernieres.length, 162);
  assert.equal(d.metriques.length, 90);
  assert.equal(d.puissance.length, 8);
  assert.equal(d.force.programmes.length, 3);
  assert.equal(d.force.series.length, 407);
  assert.equal(d.hyrox.tests.length, 3);
  assert.equal(d.hyrox.objectif?.total_s, 4200);
  assert.equal(d.sportsChoisis, null);
  assert.equal(d.erreur, '');
  assert.equal(d.erreurSport, '');
});

const vide = (): DonneesAccueil => ({
  profil: null, metriques: [], seances: [], dernieres: [], objectifs: [], puissance: [], planifiees: [],
  force: { series: [], programmes: [] }, hyrox: { tests: [], objectif: null }, sportsChoisis: null, erreur: '', erreurSport: '',
});

test('famillesDe : les sports se déduisent des séances, de la force et du Hyrox', () => {
  assert.deepEqual(famillesDe(vide()), []);
  const demo = donneesDemoAccueil(date);
  assert.deepEqual(new Set(famillesDe(demo)), new Set(['course', 'trail', 'velo', 'vtt', 'natation', 'triathlon', 'duathlon', 'muscu', 'hyrox', 'crossfit', 'ski']));
});

test('famillesDe : le trail et le VTT ont leur pastille, « autre » n\'a pas d\'onglet', () => {
  const d = { ...vide(), seances: [{ sport: 'TrailRun' }, { sport: 'MountainBikeRide' }, { sport: 'Run' }, { sport: 'Tennis' }] as Seance[] };
  assert.deepEqual(famillesDe(d), ['trail', 'vtt', 'course']);
});

test('famillesDe : un programme ou un objectif Hyrox révèle ses sports', () => {
  const d = vide();
  d.force.programmes = [{ id: 'p', name: 'PUSH', created_at: '', notes: null, exercises: [] }];
  d.objectifs = [{ id: 'o', name: 'Hyrox Open', date: '2026-12-01', sport: 'Hyrox', km: null, d_plus: null, priority: 'A', duration: 70, category: 'competition' }];
  assert.deepEqual(new Set(famillesDe(d)), new Set(['muscu', 'hyrox']));
});

test('famillesDe : les sports choisis passent en premier, dans l\'ordre de l\'utilisateur', () => {
  const d = { ...donneesDemoAccueil(date), sportsChoisis: ['hyrox', 'natation', 'course'] };
  const f = famillesDe(d);
  assert.deepEqual(f.slice(0, 3), ['hyrox', 'natation', 'course']);
  assert.ok(f.includes('velo') && f.includes('muscu'));
});

// --- sports choisis -------------------------------------------------------

test('nettoyerSports : clés connues, une fois chacune, dans l\'ordre ; null si ce n\'est pas un tableau', () => {
  assert.deepEqual(nettoyerSports(['velo', 'course', 'velo', 'inconnu', 3, 'constructor']), ['velo', 'course']);
  assert.equal(nettoyerSports(null), null);
  assert.equal(nettoyerSports('course'), null);
  assert.deepEqual(nettoyerSports([]), []);
});

test('fusionnerFamilles : trail et vtt à part, triathlon à part, « autre » retiré', () => {
  assert.deepEqual(fusionnerFamilles([], ['trail', 'vtt']), ['trail', 'vtt']);
  assert.deepEqual(fusionnerFamilles([], ['triathlon']), ['triathlon']);
  assert.deepEqual(fusionnerFamilles(['autre', 'muscu'], []), ['muscu']);
  assert.deepEqual(fusionnerFamilles(['course'], ['velo']), ['velo', 'course']);
});

test('sportsCoches : les sports révélés par les données apparaissent cochés', () => {
  assert.deepEqual(sportsCoches(['course'], ['course', 'muscu']), ['course', 'muscu']);
  assert.deepEqual(sportsCoches(null, ['hyrox']), ['hyrox']);
});

test('onboardingNecessaire : seulement pour un vrai compte neuf', () => {
  assert.equal(onboardingNecessaire({}), true);
  assert.equal(onboardingNecessaire({ demo: true }), false);
  assert.equal(onboardingNecessaire({ sportsEnregistres: [] }), false);
  assert.equal(onboardingNecessaire({ nbSeances: 3 }), false);
  assert.equal(onboardingNecessaire({ aHyrox: true }), false);
});

// --- retouches ------------------------------------------------------------

const seance = (extra: Partial<Seance>): Seance => ({
  id: 'a', name: 'Sortie', sport: 'Run', start_date_local: '2026-10-18T18:00:00+00:00', moving_time: 3600, distance_km: 10,
  total_elevation_gain: 50, avg_heartrate: 140, ftp_at_time: null, avg_watts: null, np: null, tss: 60, category: 'entrainement', ...extra,
});

test('cleRetouche : le strava_id d\'abord, sinon l\'identifiant', () => {
  assert.equal(cleRetouche({ strava_id: 123, id: 'a' }), '123');
  assert.equal(cleRetouche({ id: 'a' }), 'a');
  assert.equal(cleRetouche(null), null);
});

test('estManuelle : seulement les séances saisies à la main', () => {
  assert.equal(estManuelle({ source: 'manual' }), true);
  assert.equal(estManuelle({ source: 'strava' }), false);
  assert.equal(estManuelle(null), false);
});

test('appliquer : change les champs retouchés, garde l\'origine, ne touche pas à l\'original', () => {
  const s = seance({});
  const r = appliquer(s, { name: 'Footing', duration: 45, distance_km: 8, tss: 40, notes: 'ok' });
  assert.equal(r.name, 'Footing');
  assert.equal(r.moving_time, 2700);
  assert.equal(r.distance_km, 8);
  assert.equal(r.tss, 40);
  assert.equal(r.user_notes, 'ok');
  assert.equal(r.retouchee, true);
  assert.equal(r.origine?.name, 'Sortie');
  assert.equal(s.name, 'Sortie'); // l'original n'a pas bougé
  assert.equal(s.retouchee, undefined);
});

test('appliquer : une retouche absente ou invalide laisse la séance telle quelle', () => {
  const s = seance({});
  assert.equal(appliquer(s, null), s);
  assert.equal(appliquer(s, 'texte'), s);
  assert.equal(appliquer(s, { duration: 'beaucoup' }).moving_time, 3600);
});

test('appliquerTout : seules les séances de la table sont retouchées ; « constructor » n\'est jamais une retouche', () => {
  const liste = [seance({ id: 'a', strava_id: 1 }), seance({ id: 'constructor' }), seance({ id: 'c', strava_id: 3 })];
  const table = { '1': { name: 'Changé' } };
  const r = appliquerTout(liste, table);
  assert.equal(r[0].name, 'Changé');
  assert.equal(r[1].name, 'Sortie');
  assert.equal(r[2].name, 'Sortie');
  assert.deepEqual(appliquerTout(null, table), []);
  assert.equal(appliquerTout(liste, null), liste);
});

// --- contraste du contour des champs (charte §4 : au moins 3:1) -------------

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('contourChamp : au moins 3:1 sur le fond et la surface, en sombre comme en clair', () => {
  for (const [nom, p] of [['sombre', sombre], ['clair', clair]] as const) {
    assert.ok(contraste(p.contourChamp, p.fond) >= 3, `${nom} / fond : ${contraste(p.contourChamp, p.fond).toFixed(2)}`);
    assert.ok(contraste(p.contourChamp, p.surface) >= 3, `${nom} / surface : ${contraste(p.contourChamp, p.surface).toFixed(2)}`);
  }
});
