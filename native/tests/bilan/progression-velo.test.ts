import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimerVelo, sortiesVelo, statutVelo, type SeanceVelo, type SortieVelo } from '../../src/data/bilan/progression-velo.ts';
import { courbeProgression, progressionSport } from '../../src/data/bilan/progression.ts';
import type { Seance } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 28);
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Un bruit fixe (pas de hasard : le test doit toujours donner le même résultat), en watts
const BRUIT = [-6, 3, -2, 5, 0, -4, 2, 4, -3, 1];
const sortie = (avant: number, watts: number, fc: number, interieur = false): SortieVelo => ({ date: `${jour(avant)}T08:00:00`, watts, fc, interieur });
const periodeActuelle = (d: string): boolean => d >= jour(28) && d <= `${jour(0)}T23:59:59`;
const periodeAvant = (d: string): boolean => d >= jour(56) && d < jour(28);
const seance = (avant: number, extra: Partial<SeanceVelo> = {}): SeanceVelo => ({
  sport: 'Ride', start_date_local: `${jour(avant)}T08:00:00`, moving_time: 5400, avg_heartrate: 140, avg_watts: 150, np: 160, ...extra,
});
const enSeance = (s: SeanceVelo, i: number): Seance => ({
  id: String(i), name: null, distance_km: 40, total_elevation_gain: null, ftp_at_time: null, tss: null, category: 'workout', ...s,
});

test('hausse nette : mêmes conditions, +10 % de watts à cardio égal', () => {
  const avant = [50, 46, 42, 38, 35, 32].map((j, i) => sortie(j, 150 + BRUIT[i], 140));
  const actuel = [25, 21, 17, 13, 9, 4].map((j, i) => sortie(j, 165 + BRUIT[i + 3], 140));
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct - 10) < 1.5, `variation ${e.variationPct}`);
  assert.ok(e.bas > 0, 'la fourchette exclut zéro');
  assert.equal(statutVelo(e), 'hausse');
  assert.equal(e.nbActuel, 6);
  assert.equal(e.nbAvant, 6);
});

test('le cardio plus haut ne passe pas pour un progrès : écart ramené au même cardio', () => {
  // Avant : cardio autour de 130 ; maintenant : autour de 150. Les watts suivent le cardio (0,85 W par bpm), la forme n'a pas bougé.
  const fcAvant = [128, 133, 138, 130, 135, 132];
  const fcActuel = [148, 153, 158, 150, 155, 152];
  const joursAvant = [50, 46, 42, 38, 35, 32];
  const joursActuel = [25, 21, 17, 13, 9, 4];
  const avant = joursAvant.map((j, i) => sortie(j, 150 + 0.85 * (fcAvant[i] - 135) + BRUIT[i], fcAvant[i]));
  const actuel = joursActuel.map((j, i) => sortie(j, 150 + 0.85 * (fcActuel[i] - 135) + BRUIT[i + 2], fcActuel[i]));
  // La moyenne brute des watts bondit de ~17 W (+11 %) : une comparaison naïve crierait au progrès
  const brut = actuel.reduce((s, x) => s + x.watts, 0) / 6 / (avant.reduce((s, x) => s + x.watts, 0) / 6) - 1;
  assert.ok(brut > 0.08);
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct) < 3, `variation ${e.variationPct}`);
  assert.notEqual(statutVelo(e), 'hausse');
});

test('le home-trainer est compté à part : plus de sorties en salle ne passe pas pour un recul', () => {
  // À cardio égal, une sortie en salle donne 14 W de moins. Avant : surtout dehors ; maintenant : surtout en salle. Aucun vrai changement.
  const avant = [
    ...[50, 47, 44, 41].map((j, i) => sortie(j, 150 + BRUIT[i], 140)),
    ...[38, 35].map((j, i) => sortie(j, 136 + BRUIT[i + 4], 140, true)),
  ];
  const actuel = [
    ...[24, 20].map((j, i) => sortie(j, 150 + BRUIT[i + 6], 140)),
    ...[16, 12, 8, 4].map((j, i) => sortie(j, 136 + BRUIT[i + 1], 140, true)),
  ];
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct) < 4, `variation ${e.variationPct}`);
  assert.notEqual(statutVelo(e), 'baisse');
});

test("dehors d'un côté, en salle de l'autre : pas comparable, on ne devine pas", () => {
  const avant = [50, 46, 42, 38].map((j, i) => sortie(j, 150 + BRUIT[i], 140));
  const actuel = [24, 20, 16, 12].map((j, i) => sortie(j, 136 + BRUIT[i], 140, true));
  assert.equal(estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant), 'pas-comparable');
});

test('moins de 3 sorties dans une période : pas assez', () => {
  const avant = [50, 46, 42].map((j, i) => sortie(j, 150 + BRUIT[i], 140));
  const actuel = [20, 10].map((j, i) => sortie(j, 165 + BRUIT[i], 140));
  assert.equal(estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant), 'pas-assez');
});

test("des sorties qui varient trop : incertain plutôt qu'un faux verdict", () => {
  const avant = [50, 46, 42, 38].map((j, i) => sortie(j, [120, 175, 140, 165][i], 140));
  const actuel = [24, 20, 16, 12].map((j, i) => sortie(j, [170, 125, 160, 135][i], 140));
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.equal(statutVelo(e), 'incertain');
  assert.ok(e.bas < 0 && e.haut > 0);
});

test("statutVelo : zéro dans la fourchette = stable si elle est étroite, incertain si elle est large ; hausse/baisse seulement si elle l'exclut", () => {
  assert.equal(statutVelo({ variationPct: 2.1, bas: 0.4, haut: 3.8 }), 'hausse');
  assert.equal(statutVelo({ variationPct: -3, bas: -5.5, haut: -0.5 }), 'baisse');
  assert.equal(statutVelo({ variationPct: 0.6, bas: -2, haut: 3.2 }), 'stable');
  assert.equal(statutVelo({ variationPct: 3, bas: -6, haut: 12 }), 'incertain');
  assert.equal(statutVelo({ variationPct: 0.4, bas: 0.1, haut: 0.7 }), 'stable'); // exclut zéro mais trop petit pour compter
});

test('sortiesVelo : puissance estimée, vélo électrique, données exclues, trop court, cardio hors plage = écartés ; la NP prime sur la moyenne', () => {
  const liste: SeanceVelo[] = [
    seance(1), // retenue : NP 160
    seance(2, { device_watts: false }), // puissance estimée par Strava
    seance(3, { sport: 'EBikeRide' }), // vélo électrique
    seance(4, { excl_power: true }),
    seance(5, { excl_hr: true }),
    seance(6, { moving_time: 600 }), // 10 min
    seance(8, { avg_heartrate: 90 }), // sous 50 % de 190 (95 bpm)
    seance(9, { avg_heartrate: 185 }), // au-dessus de 92 % de 190 (175 bpm)
    seance(10, { np: null, avg_watts: 140 }), // sans NP : puissance moyenne
    seance(11, { sport: 'VirtualRide', device_watts: true }), // retenue, comptée en salle
    seance(12, { avg_watts: 20, np: 25 }), // trop faible
  ];
  const r = sortiesVelo(liste, 190);
  assert.equal(r.length, 3);
  assert.equal(r[0].watts, 160);
  assert.equal(r.find((s) => s.date.startsWith(jour(10)))!.watts, 140);
  assert.equal(r.find((s) => s.date.startsWith(jour(11)))!.interieur, true);
});

test('sortiesVelo : sans FC max connue, plage de 95 à 175 bpm', () => {
  const r = sortiesVelo([seance(1, { avg_heartrate: 94 }), seance(2, { avg_heartrate: 120 }), seance(3, { avg_heartrate: 176 })], null);
  assert.equal(r.length, 1);
});

test('progressionSport vélo : la fourchette et le nombre de sorties sont renvoyés', () => {
  const seances = [
    ...[50, 46, 42, 38, 35].map((j, i) => enSeance(seance(j, { np: 150 + BRUIT[i] }), i)),
    ...[25, 21, 17, 13, 6].map((j, i) => enSeance(seance(j, { np: 165 + BRUIT[i + 2] }), i + 10)),
  ];
  const p = progressionSport('velo', { seances, series: [], hrMax: 190 }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'hausse');
  assert.ok(p.intervalle && p.intervalle.bas > 0);
  assert.equal(p.nbActuel, 5);
  assert.equal(p.nbAvant, 5);
  assert.equal(p.fcReference, 140);
  assert.equal(p.unite, 'watts');
});

test('progressionSport vélo : pas assez de sorties = insuffisant avec la raison', () => {
  const p = progressionSport('velo', { seances: [enSeance(seance(10), 1), enSeance(seance(40), 2)], series: [], hrMax: 190 }, 28, AUJOURDHUI)!;
  assert.equal(p.statut, 'insuffisant');
  assert.match(p.manque, /3 sorties/);
});

test('courbeProgression vélo : monte quand les watts à cardio égal montent', () => {
  const seances = [
    ...[56, 53, 50, 47, 44, 41, 38, 35].map((j, i) => enSeance(seance(j, { np: 150 + BRUIT[i] }), i)),
    ...[26, 24, 19, 17, 12, 10, 5, 3].map((j, i) => enSeance(seance(j, { np: 150 + 3 * (i + 1) + BRUIT[i] }), i + 20)),
  ];
  const c = courbeProgression('velo', { seances, series: [], hrMax: 190 }, 28, AUJOURDHUI);
  assert.ok(c.length >= 2);
  assert.ok(c[c.length - 1] > c[0]);
  assert.ok(c[c.length - 1] > 100);
});
