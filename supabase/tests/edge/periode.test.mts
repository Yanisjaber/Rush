// Plans sur plusieurs semaines : volume qui monte puis récupère, affûtage avant la course, tout validé, un an sur une carte.
// Lancer : node --experimental-strip-types --test supabase/tests/edge/periode.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { coefficientSemaine, planifierPeriode, SEMAINES_MAX } from '../../functions/_shared/periode.ts';
import { evaluerPlan } from '../../functions/_shared/planning.ts';
import type { Operation } from '../../functions/_shared/planning.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { structureSeance, dureeStructure } from '../../functions/_shared/structure-seance.ts';
import { ajouterJours } from '../../functions/_shared/dates-iso.ts';

const AUJ = '2026-11-06';
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
const ctx = (sur: Partial<ContexteValidation> = {}): ContexteValidation => ({ aujourdhui: AUJ, ctl: 45, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE, ...sur });
const HAB = { velo: { moyenneMinutes: 90, plusLongueMinutes: 180 }, course: { moyenneMinutes: 50, plusLongueMinutes: 90 }, natation: { moyenneMinutes: null, plusLongueMinutes: null } };
const ajouts = (ops: Operation[]) => ops.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').map((o) => o.proposition);

test('coefficients : montée sur 3 semaines puis récupération, affûtage avant la course', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => coefficientSemaine(i, null).facteur), [1, 1.05, 1.1, 0.75, 1]);
  assert.equal(coefficientSemaine(5, 1).facteur, 0.7);
  assert.equal(coefficientSemaine(6, 0).facteur, 0.5);
});
test('un plan de 12 semaines : 4 séances par semaine, validé en entier, durées libres', () => {
  const r = planifierPeriode({ sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 2 }], semaines: 12 }, [], ctx(), HAB);
  assert.equal(r.semaines.length, 12);
  assert.equal(ajouts(r.operations).length, 48);
  const ev = evaluerPlan(r.operations, [], ctx());
  assert.equal(ev.ok, true, ev.erreurs.join('|'));
  // la semaine de récupération (4e) est plus légère que la 3e
  const minutes = (n: number) => ajouts(r.operations).filter((p) => p.date >= ajouterJours('2026-11-07', (n - 1) * 7) && p.date < ajouterJours('2026-11-07', n * 7)).reduce((t, p) => t + p.minutes, 0);
  assert.ok(minutes(4) < minutes(3), `${minutes(4)} < ${minutes(3)}`);
  assert.ok(minutes(3) > minutes(1));
  // chaque séance a une structure dont la somme fait sa durée
  for (const p of ajouts(r.operations)) assert.equal(dureeStructure(structureSeance(p.sport as 'velo', p.type, p.minutes)), p.minutes);
});
test('un plan d\'un an : 52 semaines de 4 séances sur UNE carte, validé', () => {
  const r = planifierPeriode({ sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 2 }], semaines: 52 }, [], ctx(), HAB);
  assert.equal(ajouts(r.operations).length, 208);
  const ev = evaluerPlan(r.operations, [], ctx());
  assert.equal(ev.ok, true, ev.erreurs.join('|'));
});
test('plus de 60 semaines : coupé à 60 avec une explication', () => {
  const r = planifierPeriode({ sports: [{ sport: 'course', seances: 1 }], semaines: 200 }, [], ctx(), HAB);
  assert.equal(r.semaines.length, SEMAINES_MAX);
  assert.match(r.abandons[0], /60 semaines/);
});
test('objectif : aucune séance le jour J ni après, affûtage (volume plus bas) à la fin', () => {
  const r = planifierPeriode({ sports: [{ sport: 'course', seances: 3 }], objectif: '2027-01-17' }, [], ctx(), HAB);
  const p = ajouts(r.operations);
  assert.ok(p.length > 10);
  assert.ok(p.every((x) => x.date < '2027-01-17'));
  const parSemaine = (a: string, b: string) => p.filter((x) => x.date >= a && x.date < b).reduce((t, x) => t + x.minutes, 0);
  assert.ok(parSemaine('2027-01-10', '2027-01-17') < parSemaine('2026-12-20', '2026-12-27'));
  assert.equal(evaluerPlan(r.operations, [], ctx({ competitions: [{ date: '2027-01-17' }] })).ok, true);
});
test('course avant le début, ou date absurde : rien, avec la raison', () => {
  assert.deepEqual(planifierPeriode({ sports: [{ sport: 'course', seances: 2 }], objectif: '2026-11-01' }, [], ctx(), HAB).operations, []);
  assert.deepEqual(planifierPeriode({ sports: [{ sport: 'course', seances: 2 }], debut: '2035-01-01', semaines: 4 }, [], ctx(), HAB).operations, []);
});
test('jours libres et repos respectés ; calendrier déjà chargé : les séances existantes ne bougent pas', () => {
  const r = planifierPeriode({ sports: [{ sport: 'course', seances: 3 }], semaines: 4, joursLibres: ['2026-11-10'] }, [], ctx({ joursDeRepos: ['2026-11-12'] }), HAB);
  assert.ok(ajouts(r.operations).every((p) => p.date !== '2026-11-10' && p.date !== '2026-11-12'));
  assert.ok(r.operations.every((o) => o.op === 'ajouter'));
});

test('un plan sur plusieurs semaines : chaque séance porte le but de sa semaine (Reprise, Montée, Récupération)', () => {
  const r = planifierPeriode({ sports: [{ sport: 'course', seances: 2 }], semaines: 8 }, [], ctx(), HAB);
  const phases = r.operations.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').map((o) => o.phase);
  assert.ok(phases.length >= 8 && phases.every(Boolean));
  for (const attendu of ['Reprise', 'Montée', 'Récupération']) assert.ok(phases.includes(attendu), `manque ${attendu} : ${[...new Set(phases)]}`);
});

// ---------- Le profil du coureur ----------
import { profilCoureurDepuisLigne } from '../../functions/_shared/profil-coureur.ts';
import { nomDuJour } from '../../functions/_shared/dates-iso.ts';
test('profil : un plan de plusieurs semaines respecte les jours pas disponibles et dit ce que le profil a changé', () => {
  const sans = planifierPeriode({ sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 2 }], semaines: 8 }, [], ctx(), HAB);
  const r = planifierPeriode({ sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 2 }], semaines: 8 }, [], ctx(), HAB, profilCoureurDepuisLigne({ disponibilites: { mardi: { libre: false }, jeudi: { libre: false } } }));
  const jours = r.operations.filter((o) => o.op === 'ajouter').map((o) => nomDuJour((o as { proposition: { date: string } }).proposition.date));
  assert.ok(jours.length >= 24);
  assert.ok(!jours.includes('mardi') && !jours.includes('jeudi'), jours.join(','));
  assert.deepEqual(r.profilUtilise, ['aucune séance mardi, jeudi']);
  assert.deepEqual(sans.profilUtilise, []);
});
test('profil : sans profil, le plan de période est le même qu\'avant', () => {
  const d = { sports: [{ sport: 'course' as const, seances: 3 }], semaines: 6 };
  assert.deepEqual(planifierPeriode(d, [], ctx(), HAB, profilCoureurDepuisLigne({})).operations, planifierPeriode(d, [], ctx(), HAB).operations);
});
