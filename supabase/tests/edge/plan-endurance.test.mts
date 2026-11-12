// Préparer une course de vélo ou de natation : phases, blocs chiffrés, calibrage (FTP, allure critique), test en première séance.
// Lancer : node --experimental-strip-types --test supabase/tests/edge/plan-endurance.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrerEndurance, phaseDeLaSemaine, planifierEndurance, dureeRepVelo } from '../../functions/_shared/plan-endurance.ts';
import type { DemandeEndurance } from '../../functions/_shared/plan-endurance.ts';
import { evaluerPlan } from '../../functions/_shared/planning.ts';
import type { Operation } from '../../functions/_shared/planning.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { VieSport } from '../../functions/_shared/analyse-sport.ts';

const AUJ = '2026-11-12';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' } as ContexteValidation['gardeFou'];
const ctx = (): ContexteValidation => ({ aujourdhui: AUJ, ctl: 45, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE });
const HAB = { velo: { moyenneMinutes: 90, plusLongueMinutes: 180 }, course: { moyenneMinutes: 50, plusLongueMinutes: 90 }, natation: { moyenneMinutes: 40, plusLongueMinutes: 60 } };
const ajouts = (ops: Operation[]) => ops.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter');
const vieVelo = (w1200: number | null, courbes: number): VieSport => ({ sport: 'velo', premiereSortie: null, derniereSortie: null, joursDepuisDerniere: 1, sorties: 100, heuresTotal: 300, annees: [], plusGrosseSemaine: null, plusLongueSortie: null, arrets: [], recent90: { sorties: 20, minutes: 1800, plusLongueMinutes: 180 }, velo: { parAnnee: [], recent24: { w5: 900, w300: 330, w1200, w3600: 250, courbes } }, natation: null });
const base = (sport: 'velo' | 'natation', sur: Partial<DemandeEndurance> = {}): DemandeEndurance => ({ sport, date: '2027-02-10', seancesParSemaine: 4, ...sur });

test('phases : les deux dernières semaines sont l\'affûtage, la base vient en premier, le spécifique juste avant', () => {
  const p = Array.from({ length: 13 }, (_, w) => phaseDeLaSemaine(w, 13));
  assert.deepEqual(p.slice(-2), ['affutage', 'affutage']);
  assert.equal(p[0], 'base');
  assert.equal(p[10], 'specifique');
  assert.ok(p.indexOf('developpement') > p.indexOf('base') && p.indexOf('specifique') > p.indexOf('developpement'));
  // un plan court n'a pas de base
  assert.deepEqual(Array.from({ length: 4 }, (_, w) => phaseDeLaSemaine(w, 4)), ['developpement', 'developpement', 'affutage', 'affutage']);
});

test('calibrage vélo : la FTP vaut 95 % de la meilleure puissance sur 20 min (5 courbes au moins), ou celle qu\'on donne', () => {
  assert.equal(calibrerEndurance(base('velo'), vieVelo(300, 8)).ftp, 285);
  assert.equal(calibrerEndurance(base('velo'), vieVelo(300, 3)).mesure, false);
  assert.equal(calibrerEndurance(base('velo'), null).mesure, false);
  const donnee = calibrerEndurance(base('velo', { ftp: 250 }), vieVelo(300, 8));
  assert.equal(donnee.ftp, 250);
  assert.equal(donnee.ftpSource, 'donnee');
});
test('calibrage natation : allure critique = (t400 − t200) / 2 par 100 m', () => {
  const c = calibrerEndurance(base('natation', { test: { t400: 400, t200: 188 } }), null);
  assert.equal(c.css, 106);
  assert.equal(c.cssSource, 'test');
  assert.equal(calibrerEndurance(base('natation', { test: { t400: 300, t200: 200 } }), null).mesure, false);
});

for (const sport of ['velo', 'natation'] as const) {
  test(`${sport} : un plan complet est validé, chaque séance a un nom, des blocs dont la somme fait sa durée, et une phase`, () => {
    const r = planifierEndurance(base(sport, { distanceKm: sport === 'velo' ? 100 : 1.9 }), [], ctx(), HAB, null, null);
    const a = ajouts(r.operations);
    assert.ok(a.length >= 40);
    const ev = evaluerPlan(r.operations, [], ctx());
    assert.equal(ev.ok, true, ev.erreurs.join('|'));
    for (const o of a) {
      assert.ok(o.detail?.nom && o.phase && o.justification.length > 20);
      const somme = o.detail!.structure.reduce((t, b) => t + b.reps * b.work.min + (b.type === 'interval' && b.rec ? b.reps * b.rec.min : 0), 0);
      assert.ok(Math.abs(somme - o.proposition.minutes) < 0.6, `${o.detail!.nom} : ${somme} vs ${o.proposition.minutes}`);
      assert.ok(o.proposition.date < '2027-02-10');
    }
    assert.ok(new Set(a.map((o) => o.phase)).size >= 3);
    // la dernière semaine est de l'affûtage
    assert.equal(a.at(-1)!.phase, 'Affûtage');
  });
  test(`${sport} : sans rien de mesuré, la première séance est un test et le message l'explique`, () => {
    const r = planifierEndurance(base(sport), [], ctx(), HAB, null, null);
    const premiere = ajouts(r.operations).sort((x, y) => x.proposition.date.localeCompare(y.proposition.date))[0];
    assert.match(premiere.detail!.nom, /Test/);
    assert.match(r.message, /test/i);
    assert.equal(ajouts(r.operations).filter((o) => /Test/.test(o.detail!.nom)).length, 1);
  });
  test(`${sport} : sans_test supprime le test`, () => {
    const r = planifierEndurance(base(sport, { sansTest: true }), [], ctx(), HAB, null, null);
    assert.equal(ajouts(r.operations).filter((o) => /Test/.test(o.detail!.nom)).length, 0);
  });
}

test('vélo avec FTP : les blocs sont en watts calculés sur la FTP, pas de test', () => {
  const r = planifierEndurance(base('velo', { ftp: 250 }), [], ctx(), HAB, null, null);
  const a = ajouts(r.operations);
  assert.equal(a.filter((o) => /Test/.test(o.detail!.nom)).length, 0);
  const seuil = a.find((o) => o.proposition.type === 'seuil')!;
  assert.match(seuil.detail!.nom, /\d × \d+ min à 238–263 W, récup \d+ min/);
  assert.match(r.message, /250 W/);
});
test('vélo : les blocs de seuil s\'allongent d\'une semaine à l\'autre dans la phase, et le spécifique dépend de l\'épreuve', () => {
  assert.ok(dureeRepVelo('seuil', { phase: 'developpement', rang: 2, epreuveCourte: false }) > dureeRepVelo('seuil', { phase: 'developpement', rang: 0, epreuveCourte: false }));
  assert.ok(dureeRepVelo('seuil', { phase: 'specifique', rang: 0, epreuveCourte: false }) > dureeRepVelo('seuil', { phase: 'specifique', rang: 0, epreuveCourte: true }));
  assert.equal(dureeRepVelo('seuil', { phase: 'affutage', rang: 0, epreuveCourte: false }), 5);
});
test('natation avec test : les séries sont à l\'allure critique chiffrée, en distances', () => {
  const r = planifierEndurance(base('natation', { test: { t400: 400, t200: 188 }, distanceKm: 1.9 }), [], ctx(), HAB, null, null);
  const serie = ajouts(r.operations).find((o) => o.proposition.type === 'seuil')!;
  assert.match(serie.detail!.nom, /\d+ × \d+ m à \d:\d\d\/100 m, repos \d+ s/);
  assert.match(r.message, /1:46\/100 m/);
});
test('reprise après un arrêt : pas de test et rien de dur au début', () => {
  const hab = { ...HAB, velo: { moyenneMinutes: 90, plusLongueMinutes: 180, analyse: { sport: 'velo', etat: 'reprise', picSemaineMinutes: 600, plusLongueVieMinutes: 240, moyenne90Minutes: null, plusLongue90Minutes: null, ratio5sur20: null, limite: null, passe: [], inconnues: [], phrases: [], picSemaineSeances: 5 } } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = planifierEndurance(base('velo'), [], ctx(), hab as any, null, null);
  const a = ajouts(r.operations);
  assert.equal(a.filter((o) => /Test/.test(o.detail!.nom)).length, 0);
  assert.ok(a.slice(0, 3).every((o) => !['seuil', 'vo2max', 'sortie_longue'].includes(o.proposition.type)));
  assert.match(r.message, /reprends/);
});
test('date de course passée ou trop proche : aucun plan, une raison', () => {
  const r = planifierEndurance(base('velo', { date: AUJ }), [], ctx(), HAB, null, null);
  assert.equal(r.operations.length, 0);
  assert.ok(r.message.length > 5);
});
