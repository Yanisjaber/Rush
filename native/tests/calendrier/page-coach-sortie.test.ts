import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparerSortie, sortiesSimilaires, texteAllure } from '../../src/data/calendrier/comparaison-sortie.ts';
import { motDuCoach, sortieExigeante } from '../../src/data/calendrier/mot-coach-sortie.ts';
import type { Seance } from '../../src/data/types.ts';

const seance = (id: string, jour: string, km: number, minutes: number, fc: number | null, sport = 'Run'): Seance => ({
  id, name: null, sport, start_date_local: `${jour}T08:00:00`, moving_time: minutes * 60, distance_km: km,
  total_elevation_gain: null, avg_heartrate: fc, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});

// Cette sortie : 6 km en 35 min 36 s (5'56"/km), FC 174
const moi = seance('moi', '2026-11-10', 6, 35.6, 174);
const autres = [
  seance('a', '2026-11-03', 6.2, 38, 171), // 6'08"
  seance('b', '2026-10-27', 5.8, 36, 168), // 6'12"
  seance('c', '2026-10-20', 6.5, 41, 173), // 6'18"
  seance('d', '2026-10-13', 5.5, 34, 176), // 6'11"
  seance('e', '2026-10-06', 6.1, 38.5, 170), // 6'19"
  seance('f', '2026-09-29', 6.0, 38, 169), // la 6e : écartée (seulement 5 gardées)
];

test('sortiesSimilaires : même sport, distance voisine, avant la sortie, 5 plus récentes', () => {
  const r = sortiesSimilaires(moi, [...autres, seance('trop-long', '2026-11-05', 15, 90, 150), seance('velo', '2026-11-04', 6, 15, 140, 'Ride'), seance('apres', '2026-11-12', 6, 36, 170), moi]);
  assert.deepEqual(r.map((s) => s.id), ['a', 'b', 'c', 'd', 'e']);
});

test('sortiesSimilaires : plus de 180 jours, c\'est trop vieux', () => {
  assert.deepEqual(sortiesSimilaires(moi, [seance('vieux', '2026-03-01', 6, 36, 170)]), []);
});

test('sortiesSimilaires : un sport autre que course et vélo ne se compare pas', () => {
  assert.deepEqual(sortiesSimilaires(seance('n', '2026-11-10', 1, 30, 140, 'Swim'), [seance('n2', '2026-11-03', 1, 30, 140, 'Swim')]), []);
});

test('comparerSortie : moins de 3 sorties proches, pas de comparaison', () => {
  assert.equal(comparerSortie(moi, autres.slice(0, 2)), null);
});

test('comparerSortie : course, plus rapide que la médiane', () => {
  const c = comparerSortie(moi, autres)!;
  assert.equal(c.n, 5);
  const allure = c.lignes.find((l) => l.cle === 'allure')!;
  assert.equal(allure.texte, `5'56"/km`);
  assert.equal(allure.verdict, 'mieux');
  assert.equal(allure.mot, 'plus vite');
  assert.ok(c.rythme!.valeur < c.rythme!.mediane);
  // La médiane des 5 allures (368, 372, 378, 371, 379) est 372 s : 16 s plus lent que la sortie (356 s)
  assert.equal(c.hero!.valeur, '−16"');
  assert.equal(c.hero!.unite, '/km');
  assert.match(c.hero!.detail, /plus rapide/);
  // Le cœur n'a pas de verdict ; les positions sont dans la bande
  assert.equal(c.lignes.find((l) => l.cle === 'fc')!.verdict, null);
  for (const l of c.lignes) {
    assert.ok(l.position >= 0.1 - 1e-9 && l.position <= 0.9 + 1e-9);
    assert.equal(l.autres.length, 5);
  }
});

test('comparerSortie : à allure égale (à 2 % près), on dit « pareil »', () => {
  const c = comparerSortie(seance('x', '2026-11-10', 6, 37.2, 170), autres)!; // 6'12" : la médiane
  assert.equal(c.lignes.find((l) => l.cle === 'allure')!.verdict, 'pareil');
  assert.match(c.hero!.detail, /habituel/);
});

test('texteAllure : minutes et secondes sur deux chiffres', () => {
  assert.equal(texteAllure(356), `5'56"`);
  assert.equal(texteAllure(369), `6'09"`);
});

const base = { comparaison: comparerSortie(moi, autres), derivePct: 3, partHaute: 0.2, famille: 'course' as const, dureeS: 2136, iso: '2026-11-10', aujourdhui: new Date(2026, 10, 10, 21, 0), joursOccupes: [] as string[] };

test('motDuCoach : sortie facile, pas de proposition', () => {
  const m = motDuCoach(base);
  assert.equal(m.titre, 'Une belle sortie, sans surcoût.');
  assert.equal(m.proposition, null);
  assert.match(m.paragraphes[0], /5'56" au km/);
  assert.match(m.paragraphes[1], /dérive est faible/);
});

test('motDuCoach : dérive forte → sortie qui a coûté, proposition pour demain', () => {
  const m = motDuCoach({ ...base, derivePct: 12 });
  assert.equal(m.titre, 'Une sortie qui a coûté.');
  assert.match(m.paragraphes[1], /\+12 %/);
  assert.equal(m.proposition!.date, '2026-11-11');
  assert.equal(m.proposition!.type, 'Run');
  assert.equal(m.proposition!.dureeMin, 20); // la moitié de 35 min, bornée à 20 min au moins
  assert.equal(m.proposition!.rpe, 3);
});

test('motDuCoach : une moitié du temps en zone 4 ou plus compte comme exigeant, et se dit', () => {
  const m = motDuCoach({ ...base, partHaute: 0.61 });
  assert.ok(m.paragraphes.some((p) => /61 % du temps en zone 4/.test(p)));
  assert.ok(m.proposition);
  assert.equal(sortieExigeante({ derivePct: null, partHaute: 0.5 }), true);
  assert.equal(sortieExigeante({ derivePct: 10, partHaute: 0.4 }), false);
});

test('motDuCoach : pas de proposition si demain est déjà pris, ou si la sortie est ancienne', () => {
  assert.equal(motDuCoach({ ...base, derivePct: 12, joursOccupes: ['2026-11-11'] }).proposition, null);
  assert.equal(motDuCoach({ ...base, derivePct: 12, aujourdhui: new Date(2026, 10, 14, 9, 0) }).proposition, null);
});

test('motDuCoach : sortie d\'hier, la proposition tombe aujourd\'hui plutôt que dans le passé', () => {
  const m = motDuCoach({ ...base, derivePct: 12, aujourdhui: new Date(2026, 10, 11, 9, 0) });
  assert.equal(m.proposition!.date, '2026-11-11');
});

test('motDuCoach : sans comparaison ni dérive, il le dit au lieu d\'inventer', () => {
  const m = motDuCoach({ ...base, comparaison: null, derivePct: null, partHaute: null });
  assert.match(m.paragraphes[0], /Pas assez de données/);
  assert.equal(m.proposition, null);
});

test('motDuCoach : vélo, la proposition est une sortie facile de 45 à 90 min', () => {
  const m = motDuCoach({ ...base, famille: 'velo', comparaison: null, derivePct: 14, dureeS: 3 * 3600 });
  assert.equal(m.proposition!.type, 'Ride');
  assert.equal(m.proposition!.dureeMin, 90);
});
