import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formeForceParSemaine, pointsDeForce } from '../../src/data/bilan/forme-force.ts';
import type { SerieForce } from '../../src/data/types.ts';

let n = 0;
const serie = (date: string, exercise_key: string, reps: number, weight_kg: number): SerieForce => ({
  id: `s${n++}`, activity_id: `a-${date}`, date, exercise_key, exercise_name: exercise_key, muscle_group: 'jambes', position: 0, set_no: n, reps, weight_kg,
});
const iso = (jour: number): string => new Date(jour * 86400000).toISOString().slice(0, 10);
const jourDe = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;

/** Une séance tous les 3 jours entre deux dates : 3 séries du squat, avec la charge donnée par `kg(jour)`. */
function seances(du: string, au: string, kg: (jour: number) => number, pas = 3): SerieForce[] {
  const out: SerieForce[] = [];
  for (let j = jourDe(du); j <= jourDe(au); j += pas) for (let k = 0; k < 3; k++) out.push(serie(iso(j), 'squat', 5, kg(j)));
  return out;
}

const AUJ = new Date(2026, 5, 1, 12);

test('pointsDeForce : un point par exercice principal et par jour, le meilleur 1RM du jour contre le record de toujours', () => {
  const p = pointsDeForce([...seances('2025-01-01', '2025-01-31', () => 80), ...seances('2025-02-01', '2025-02-28', () => 100)]);
  const max = Math.max(...p.map((x) => x.ratio));
  assert.equal(max, 1);
  assert.ok(Math.abs(Math.min(...p.map((x) => x.ratio)) - 0.8) < 1e-9);
  assert.equal(p.length, new Set(p.map((x) => x.jour)).size); // un point par jour pour l'exercice
  assert.deepEqual(pointsDeForce([serie('2025-01-01', 'squat', 5, 80)]), []); // un exercice à moins de 6 séries ne compte pas
});

test('formeForceParSemaine : la force suit la charge soulevée (100 = ta meilleure semaine) ; le tonnage est en tonnes', () => {
  const MI = jourDe('2025-07-01');
  const carnet = seances('2025-01-01', '2025-12-31', (j) => (j < MI ? 80 : 100));
  const f = formeForceParSemaine(carnet, 2025, AUJ)!;
  assert.equal(f.unite, 't');
  assert.equal(f.semaines.length, 52);
  const mars = f.semaines[10], dec = f.semaines[50];
  assert.ok(dec.score! > mars.score! + 20, `décembre ${dec.score}, mars ${mars.score}`);
  assert.ok(dec.score! > 90, `${dec.score}`);
  assert.ok(f.semaines[f.meilleure].score! >= dec.score! - 1e-9);
  for (const s of [mars, dec]) assert.ok(s.bas! <= s.score! && s.haut! >= s.score!);
  // Tonnage de la 1re semaine (1er au 7 janvier) : séances du 1er, 4 et 7 : 3 séances × 3 séries × 5 reps × 80 kg = 3 600 kg = 3,6 t
  assert.ok(Math.abs(f.semaines[0].heures - 3.6) < 1e-9, `${f.semaines[0].heures}`);
});

test('formeForceParSemaine : après plus de 2 semaines sans séance, la force est estimée (elle baisse, en pointillé) ; la meilleure semaine n\'est jamais une estimation', () => {
  const carnet = [...seances('2025-01-01', '2025-03-31', () => 100), ...seances('2025-07-01', '2025-12-31', () => 100)];
  const f = formeForceParSemaine(carnet, 2025, AUJ)!;
  const avant = f.semaines[12]; // fin mars : séances toute la période
  const pause = f.semaines[20]; // mi-mai : pause depuis 6 semaines
  assert.equal(avant.estimee, false);
  assert.equal(pause.estimee, true);
  assert.ok(pause.score! < avant.score!, `${pause.score} contre ${avant.score}`);
  assert.ok(pause.haut! - pause.bas! > avant.haut! - avant.bas!); // la marge s'élargit
  assert.equal(f.semaines[27].estimee, false); // la reprise remet la mesure
  assert.equal(f.semaines[f.meilleure].estimee, false);
});

test('formeForceParSemaine : trop peu de séries, ou une année sans séance après le début : rien', () => {
  assert.equal(formeForceParSemaine([], 2025, AUJ), null);
  assert.equal(formeForceParSemaine([serie('2025-01-01', 'squat', 5, 80)], 2025, AUJ), null);
  const f = formeForceParSemaine(seances('2025-01-01', '2025-02-28', () => 100), 2026, AUJ);
  // Une année plus tard : toutes les semaines sont des estimations, aucune n'est mesurée
  assert.equal(f, null);
});
