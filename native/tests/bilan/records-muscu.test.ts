import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeParRepetitions, classementRepetitions, courbeForce, epley, exercicesDuCarnet, recordsExercice, recordsSeanceMuscu, rmParTrimestre, seriesDeLAnnee } from '../../src/data/bilan/records-muscu.ts';
import { texteRecordSimple } from '../../src/data/bilan/records-texte.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import type { SerieForce } from '../../src/data/types.ts';

let n = 0;
const serie = (activity_id: string | null, date: string, exercise_key: string, reps: number, weight_kg: number): SerieForce => ({
  id: `s${n++}`, activity_id, date, exercise_key, exercise_name: exercise_key === 'squat' ? 'Squat' : 'Développé couché', muscle_group: 'jambes', position: 0, set_no: n, reps, weight_kg,
});

const CARNET = [
  serie('a', '2026-01-10', 'squat', 5, 100),
  serie('a', '2026-01-10', 'squat', 5, 100),
  serie('a', '2026-01-10', 'squat', 8, 80),
  serie('b', '2026-02-14', 'squat', 3, 110),
  serie('b', '2026-02-14', 'squat', 12, 70),
  serie('c', '2026-03-20', 'squat', 5, 105),
  serie('a', '2026-01-10', 'bench', 8, 60),
  serie('c', '2026-03-20', 'bench', 6, 65),
  serie('c', '2026-03-20', 'bench', 20, 0), // sans charge : ignoré
];

test('epley : 1RM estimé = poids × (1 + répétitions ÷ 30)', () => {
  assert.equal(epley(100, 5), 100 * (1 + 5 / 30));
  assert.equal(epley(80, 0), 80);
});

test('exercicesDuCarnet : le plus pratiqué d\'abord, les séries sans charge ne comptent pas', () => {
  const ex = exercicesDuCarnet(CARNET);
  assert.deepEqual(ex.map((e) => [e.cle, e.nSeries]), [['squat', 6], ['bench', 2]]);
  assert.equal(ex[0].nom, 'Squat');
});

test('recordsExercice : 1RM, charge max, répétitions max et volume, une entrée par séance (la meilleure série)', () => {
  const r = recordsExercice(CARNET, 'squat');
  // 1RM : 105 × 5 → 122,5 ; 110 × 3 → 121 ; 100 × 5 → 116,7 ; 70 × 12 → 98
  assert.deepEqual(r.rm.top.map((e) => e.id), ['c', 'b', 'a']);
  assert.ok(Math.abs(r.rm.top[0].valeur - 122.5) < 1e-9);
  assert.equal(r.rm.top[0].detail, '5 × 105 kg');
  // Charge max : 110 (b), 105 (c), 100 (a)
  assert.deepEqual(r.poids.top.map((e) => [e.id, e.valeur]), [['b', 110], ['c', 105], ['a', 100]]);
  // Volume de séance : a = 500 + 500 + 640 = 1640 ; b = 330 + 840 = 1170 ; c = 525
  assert.deepEqual(r.volume.top.map((e) => [e.id, e.valeur]), [['a', 1640], ['b', 1170], ['c', 525]]);
  // Répétitions max : seulement les séries d'au moins la moitié de la charge max (55 kg) : 70 × 12 compte, 12 reps
  assert.equal(r.reps.top[0].valeur, 12);
  assert.equal(r.reps.top[0].id, 'b');
  assert.equal(r.rm.libelle, '1RM estimé');
  assert.equal(texteRecordSimple(r.rm.top[0].valeur, r.rm.unite), '122,5 kg');
  assert.equal(texteRecordSimple(110, 'kg'), '110 kg');
});

test('recordsExercice : un exercice sans série donne des records vides', () => {
  const r = recordsExercice(CARNET, 'inconnu');
  assert.equal(r.rm.top.length, 0);
  assert.equal(r.volume.top.length, 0);
});

test('chargeParRepetitions : la charge la plus lourde tenue pour au moins n répétitions (8 répétitions valent aussi pour 5)', () => {
  const c = chargeParRepetitions(CARNET, 'squat');
  const poids = (reps: number): number | undefined => c.find((p) => p.reps === reps)?.poids;
  assert.equal(poids(1), 110); // la meilleure charge, quel que soit le nombre de répétitions
  assert.equal(poids(3), 110);
  assert.equal(poids(5), 105); // 110 × 3 ne compte pas pour 5
  assert.equal(poids(8), 80);
  assert.equal(poids(10), 70);
  assert.equal(poids(12), 70);
  assert.equal(c[0].id, 'b');
  assert.deepEqual(chargeParRepetitions(CARNET, 'inconnu'), []);
  // Une charge plus lourde ne peut pas être tenue pour plus de répétitions : la courbe descend
  for (let i = 1; i < c.length; i++) assert.ok(c[i].poids <= c[i - 1].poids);
});

test('seriesDeLAnnee : le carnet d\'une année', () => {
  assert.equal(seriesDeLAnnee([...CARNET, serie('z', '2025-12-31', 'squat', 5, 90)], 2026).length, CARNET.length);
});

test('recordsSeanceMuscu : tonnage, séries, répétitions, charge la plus lourde et durée, par séance', () => {
  const act = (id: string, iso: string, min: number, series: number, reps: number, tonnage: number): ActiviteBilan => ({
    id, name: `Séance ${id}`, iso, sport: 'musculation', famille: 'muscu', duree_min: min, distance_km: 0, d_plus: 0, tss: 0, series, reps, tonnage,
  });
  const acts = [act('a', '2026-01-10', 60, 14, 100, 14000), act('b', '2026-02-14', 80, 10, 120, 9000), act('c', '2026-03-20', 40, 20, 90, 20000)];
  const r = recordsSeanceMuscu(acts, CARNET);
  const par = (cle: string) => r.find((x) => x.cle === cle)!;
  assert.deepEqual(par('tonnage').top.map((e) => [e.id, e.valeur]), [['c', 20], ['a', 14], ['b', 9]]);
  assert.equal(par('series').top[0].id, 'c');
  assert.equal(par('reps').top[0].id, 'b');
  assert.equal(par('duree').top[0].id, 'b');
  assert.equal(par('poids').top[0].valeur, 110);
  assert.equal(par('poids').top[0].id, 'b');
  assert.equal(r.find((x) => x.cle === 'tss'), undefined); // aucune charge : pas de record vide
});

test('rmParTrimestre : le meilleur 1RM de l\'exercice, trimestre après trimestre', () => {
  const t = rmParTrimestre(CARNET, 'squat');
  // Janvier et février : 110 × 3 → 121 (la meilleure série), mars : 105 × 5 → 122,5
  assert.deepEqual(t.map((x) => x.cle), ['2026-T1']);
  assert.ok(Math.abs(t[0].rm - 122.5) < 1e-9);
  const deux = rmParTrimestre([...CARNET, serie('d', '2025-11-02', 'squat', 5, 90)], 'squat');
  assert.deepEqual(deux.map((x) => x.cle), ['2025-T4', '2026-T1']);
  assert.deepEqual(rmParTrimestre(CARNET, 'inconnu'), []);
});

test('classementRepetitions : une entrée par séance (sa charge la plus lourde tenue pour au moins n répétitions), la plus lourde d\'abord', () => {
  // Squat, 5 répétitions ou plus : a = 100 (5 × 100), c = 105 (5 × 105), b = 70 (la série de 12 × 70 ; 110 × 3 ne compte pas)
  const r = classementRepetitions(CARNET, 'squat', 5);
  assert.deepEqual(r.map((e) => [e.id, e.valeur]), [['c', 105], ['a', 100], ['b', 70]]);
  assert.equal(r[0].nom, 'Squat · 5 × 105 kg');
  // 1 répétition ou plus : toutes les séries comptent : la meilleure charge de chaque séance
  assert.deepEqual(classementRepetitions(CARNET, 'squat', 1).map((e) => [e.id, e.valeur]), [['b', 110], ['c', 105], ['a', 100]]);
  // 12 répétitions : seule la série de 12 × 70
  assert.deepEqual(classementRepetitions(CARNET, 'squat', 12).map((e) => [e.id, e.valeur]), [['b', 70]]);
  assert.deepEqual(classementRepetitions(CARNET, 'squat', 13), []);
  assert.equal(classementRepetitions(CARNET, 'squat', 1, 2).length, 2);
  // Sans identifiant de séance : une entrée par jour, avec un id vide
  const sans = classementRepetitions([serie(null, '2026-04-01', 'squat', 5, 90), serie(null, '2026-04-01', 'squat', 5, 95)], 'squat', 5);
  assert.deepEqual(sans.map((e) => [e.id, e.valeur]), [['', 95]]);
});

test('courbeForce : un point par nombre de répétitions (1 à 12), le podium de 3 séances, la charge qui baisse quand les répétitions montent', () => {
  const c = courbeForce(CARNET, 'squat');
  assert.deepEqual(c.map((p) => p.duree), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(c[0].top[0].valeur, 110); // 1 répétition : la charge max
  assert.equal(c[11].top[0].valeur, 70); // 12 répétitions
  assert.equal(c[4].top.length, 3); // 5 répétitions : trois séances (c, a, b)
  for (let i = 1; i < c.length; i++) assert.ok(c[i].top[0].valeur <= c[i - 1].top[0].valeur);
  assert.deepEqual(courbeForce(CARNET, 'inconnu'), []);
});
