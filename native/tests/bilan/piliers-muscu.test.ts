import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entropieNormalisee, niveauGlobalMuscu, PILIERS_MUSCU } from '../../src/data/bilan/piliers-muscu.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import type { SerieForce } from '../../src/data/types.ts';

const maintenant = new Date(2026, 5, 15, 12);
let n = 0;
const GROUPES: Record<string, string> = { squat: 'jambes', bench: 'pectoraux', row: 'dos', ohp: 'epaules', curl: 'bras', plank: 'tronc' };
const serie = (activity_id: string | null, date: string, exercise_key: string, reps: number, weight_kg: number): SerieForce => ({
  id: `s${n++}`, activity_id, date, exercise_key, exercise_name: exercise_key, muscle_group: GROUPES[exercise_key] ?? 'autre', position: 0, set_no: n, reps, weight_kg,
});
const seance = (iso: string, o: Partial<ActiviteBilan> = {}): ActiviteBilan => ({ id: `m-${iso}`, name: iso, iso, sport: 'musculation', famille: 'muscu', duree_min: 60, distance_km: 0, d_plus: 0, tss: 0, ...o });

test('entropieNormalisee : 1 quand les 6 groupes sont à égalité, 0 quand tout est dans un seul', () => {
  assert.ok(Math.abs(entropieNormalisee([10, 10, 10, 10, 10, 10]) - 1) < 1e-12);
  assert.equal(entropieNormalisee([30, 0, 0, 0, 0, 0]), 0);
  assert.equal(entropieNormalisee([]), 0);
  assert.ok(entropieNormalisee([20, 10, 10, 10, 5, 5]) > 0.85);
  assert.ok(entropieNormalisee([50, 5, 5, 0, 0, 0]) < 0.5);
});

/** Un carnet d'un an : une séance par semaine à jours fixes, 6 exercices à 5 séries chacun, la force qui monte. */
function carnet(an: number, kg: (ex: string) => number, du = '01-04', semaines = 40): { acts: ActiviteBilan[]; series: SerieForce[] } {
  const acts: ActiviteBilan[] = [];
  const series: SerieForce[] = [];
  const debut = Date.UTC(an, Number(du.slice(0, 2)) - 1, Number(du.slice(3)));
  for (let i = 0; i < semaines; i++) {
    const iso = new Date(debut + i * 7 * 86400000).toISOString().slice(0, 10);
    const a = seance(iso, { series: 30, reps: 240, tonnage: 20000 });
    acts.push(a);
    for (const ex of Object.keys(GROUPES)) for (let k = 0; k < 5; k++) series.push(serie(a.id, iso, ex, 8, kg(ex)));
  }
  return { acts, series };
}

test('niveauGlobalMuscu : 4 piliers ; la force est jugée contre ton record de toujours sur tes exercices principaux', () => {
  const a = carnet(2025, () => 80);
  const b = carnet(2026, () => 100);
  const g = niveauGlobalMuscu([...a.series, ...b.series], [...a.acts, ...b.acts], maintenant)!;
  assert.deepEqual(g.piliers.map((p) => p.cle), PILIERS_MUSCU.map((p) => p.cle));
  assert.deepEqual(g.annees.map((x) => x.an), [2025, 2026]);
  const a25 = g.annees[0], a26 = g.annees[1];
  // 2026 : record partout (100) ; 2025 : 80 kg contre 100 → rapport 0,8 → (0,8 − 0,7) ÷ 0,3 = 33,3
  assert.equal(a26.piliers.force, 100);
  assert.ok(Math.abs(a25.piliers.force - 100 / 3) < 1e-9, `${a25.piliers.force}`);
  // Équilibre : 5 séries par groupe, parfaitement réparti : 100
  assert.ok(Math.abs(a26.piliers.equilibre - 100) < 1e-9);
  // Toutes les preuves : le score global existe
  assert.equal(a26.nbPiliers, 4);
  assert.ok(a26.global !== null && a26.global > 85, `${a26.global}`);
  assert.ok(a25.global !== null && a25.global < a26.global);
  assert.equal(g.meilleur.an, 2026);
});

test('niveauGlobalMuscu : sans carnet de force (années anciennes), force et équilibre n\'ont pas de preuve : pas de score global', () => {
  const vieux = carnet(2022, () => 90).acts.map((a) => ({ ...a, series: undefined, reps: undefined, tonnage: undefined })); // des séances, sans carnet
  const recent = carnet(2026, () => 100);
  const g = niveauGlobalMuscu(recent.series, [...vieux, ...recent.acts], maintenant)!;
  const a22 = g.annees.find((x) => x.an === 2022)!;
  assert.equal(a22.preuves.force, 0);
  assert.equal(a22.piliers.force, 0);
  assert.equal(a22.preuves.equilibre, 0);
  assert.equal(a22.nbPiliers, 2); // volume (par les heures) et régularité
  assert.equal(a22.global, null);
  assert.ok(a22.piliers.regularite > 50);
  assert.ok(a22.piliers.volume > 0);
});

test('niveauGlobalMuscu : un déséquilibre (tout sur les jambes) fait baisser l\'équilibre ; une année à une seule séance n\'est pas régulière', () => {
  const lourd = carnet(2025, () => 80);
  const series = lourd.series.map((s) => ({ ...s, muscle_group: 'jambes' }));
  const g = niveauGlobalMuscu(series, lourd.acts, maintenant)!;
  assert.equal(g.actuel.piliers.equilibre, 0);
  const rare = niveauGlobalMuscu([], [seance('2026-03-02')], maintenant)!;
  assert.ok(rare.actuel.piliers.regularite < 40, `${rare.actuel.piliers.regularite}`);
});

test('niveauGlobalMuscu : le volume de l\'année en cours est ramené à une année complète, et la preuve est réduite avant 30 jours de données', () => {
  const a = carnet(2025, () => 90, '01-01', 40);
  const b = carnet(2026, () => 90, '01-05', 20);
  const g = niveauGlobalMuscu([...a.series, ...b.series], [...a.acts, ...b.acts], maintenant)!;
  // 2026 : 20 séances sur 166 jours couverts → annualisé 44 séances, plus que 2025 (40) : le volume ne s'effondre pas parce que l'année n'est pas finie
  assert.ok(g.annees[1].piliers.volume > 90, `${g.annees[1].piliers.volume}`);
  // Une année démarrée il y a 10 jours : la régularité est réduite d'autant (preuve 10 / 30)
  const debutAnnee = niveauGlobalMuscu([], [seance('2026-06-08'), seance('2026-06-10'), seance('2026-06-12')], new Date(2026, 5, 15, 12))!;
  assert.ok(Math.abs(debutAnnee.actuel.preuves.regularite - 8 / 30) < 1e-9, `${debutAnnee.actuel.preuves.regularite}`);
  assert.equal(niveauGlobalMuscu([], [], maintenant), null);
});
