import test from 'node:test';
import assert from 'node:assert/strict';
import { plageSemaine, semainesDuPlan } from '../../src/data/coach/semaines-plan.ts';
import type { LignePlan } from '../../src/data/coach/types.ts';

// 2026-11-09 est un lundi
const ajout = (vers: string, minutes: number, sport = 'course'): LignePlan => ({ op: 'ajouter', texte: `Ajouter ${vers}`, sport, minutes, vers });
const retrait = (de: string): LignePlan => ({ op: 'supprimer', texte: `Supprimer ${de}`, sport: 'course', minutes: 30, de });

test('les séances sont rangées par semaine, les retirées n\'apparaissent pas, le volume et le nombre de séances sont justes', () => {
  const s = semainesDuPlan([retrait('2026-11-09'), ajout('2026-11-10', 32), ajout('2026-11-12', 41), ajout('2026-11-17', 40), retrait('2026-11-18')]);
  assert.equal(s.length, 2);
  assert.deepEqual(s.map((x) => [x.numero, x.debut, x.fin, x.seances, x.minutes]), [[1, '2026-11-09', '2026-11-15', 2, 73], [2, '2026-11-16', '2026-11-22', 1, 40]]);
  assert.ok(s.every((x) => x.lignes.every((l) => l.op !== 'supprimer')));
});
test('chaque semaine a ses 7 jours (lundi → dimanche) avec le sport des séances du jour', () => {
  const [s] = semainesDuPlan([ajout('2026-11-10', 30), ajout('2026-11-12', 30, 'velo')]);
  assert.deepEqual(s.jours.map((j) => j.iso), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(s.jours.map((j) => j.sports), [[], ['course'], [], ['velo'], [], [], []]);
});
test('une semaine sans changement garde sa place dans la numérotation', () => {
  const s = semainesDuPlan([ajout('2026-11-10', 30), ajout('2026-11-24', 30)]);
  assert.deepEqual(s.map((x) => x.numero), [1, 3]);
});
test('une période déclarée marque ses jours sur toutes les semaines qu\'elle couvre, le repos aussi', () => {
  const s = semainesDuPlan([
    { op: 'indisponibilite', texte: 'Déclarer : blessure', type: 'blessure', du: '2026-11-13', au: '2026-11-17' },
    { op: 'repos', texte: 'Poser un jour de repos', vers: '2026-11-19', poser: true },
  ]);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].jours.filter((j) => j.periode).map((j) => j.iso), ['2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(s[1].jours.filter((j) => j.periode).map((j) => j.iso), ['2026-11-16', '2026-11-17']);
  assert.equal(s[1].jours[3].repos, true);
  assert.equal(s[0].lignes.length, 1, 'la période est listée dans la semaine où elle commence');
});
test('aucune ligne n\'est perdue : une ligne sans date va dans la première semaine, un plan de retraits seuls donne rien', () => {
  const s = semainesDuPlan([{ op: 'ajouter', texte: 'Sans date', sport: 'course', minutes: 20 }, ajout('2026-11-10', 30)]);
  assert.equal(s[0].lignes.length, 2);
  assert.deepEqual(semainesDuPlan([retrait('2026-11-09')]), []);
});
test('un plan d\'un an (60 semaines) se découpe sans erreur', () => {
  const lignes: LignePlan[] = [];
  for (let w = 0; w < 60; w++) lignes.push(ajout(new Date(Date.UTC(2026, 10, 10) + w * 7 * 86_400_000).toISOString().slice(0, 10), 40));
  const s = semainesDuPlan(lignes);
  assert.equal(s.length, 60);
  assert.equal(s[59].numero, 60);
});
test('la plage d\'une semaine : un seul mois ou deux', () => {
  assert.equal(plageSemaine('2026-11-09', '2026-11-15'), '9–15 nov.');
  assert.equal(plageSemaine('2026-11-30', '2026-12-06'), '30 nov.–6 déc.');
});

test('le but de la semaine est celui de ses séances (le plus fréquent), absent quand le plan n\'en dit pas', () => {
  const avecPhase = (vers: string, phase?: string): LignePlan => ({ ...ajout(vers, 30), ...(phase ? { phase } : {}) });
  const s = semainesDuPlan([avecPhase('2026-11-10', 'Base'), avecPhase('2026-11-12', 'Base'), avecPhase('2026-11-14', 'Récupération'), avecPhase('2026-11-17'), avecPhase('2026-11-19')]);
  assert.equal(s[0].phase, 'Base');
  assert.equal(s[1].phase, undefined);
});
