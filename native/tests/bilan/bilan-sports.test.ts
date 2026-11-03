import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avecForce, mesureDef, mesureParSemaine, mesureValide, mesuresDuSport, moyennesParJourSemaine, sommer, valeursParMois, type ActiviteBilan,
} from '../../src/data/bilan/bilan.ts';
import type { SerieForce } from '../../src/data/types.ts';

// Les mesures propres à la course (allure, FC) et à la musculation (séries, répétitions, tonnage) du Bilan.
const maintenant = new Date(2026, 6, 1, 12);
const act = (iso: string, sport: ActiviteBilan['sport'], min: number, km: number, extra: Partial<ActiviteBilan> = {}): ActiviteBilan => ({
  id: iso + sport + (extra.id ?? ''), name: iso, iso, sport, famille: sport === 'musculation' ? 'muscu' : sport, duree_min: min, distance_km: km, d_plus: 0, tss: 0, ...extra,
});
const serie = (activity_id: string | null, date: string, reps: number, weight_kg: number, exercise_key = 'squat'): SerieForce => ({
  id: `${activity_id}-${date}-${reps}-${weight_kg}`, activity_id, date, exercise_key, exercise_name: exercise_key, muscle_group: 'jambes', position: 0, set_no: 0, reps, weight_kg,
});

test('mesuresDuSport : la course lit l\'allure et la FC, la musculation les séries et le tonnage, les autres sports les cinq mesures communes', () => {
  assert.deepEqual(mesuresDuSport('course').map((m) => m.cle), ['distance_km', 'allure', 'fc', 'd_plus', 'seances', 'heures', 'tss']);
  assert.deepEqual(mesuresDuSport('muscu').map((m) => m.cle), ['seances', 'heures', 'series', 'reps', 'tonnage', 'tss']);
  assert.deepEqual(mesuresDuSport('velo').map((m) => m.cle), ['distance_km', 'd_plus', 'seances', 'tss', 'heures']);
  assert.deepEqual(mesuresDuSport('tout').map((m) => m.cle), ['distance_km', 'd_plus', 'seances', 'tss', 'heures']);
  assert.equal(mesureDef('allure').moyenne, true);
  assert.equal(mesureDef('tonnage').unite, 't');
  assert.equal(mesureDef('distance_km').moyenne, undefined);
});

test('mesureValide : une mesure choisie sur un sport ne fausse pas un autre sport', () => {
  const muscu = mesuresDuSport('muscu');
  assert.equal(mesureValide('tonnage', muscu, 'heures'), 'tonnage');
  assert.equal(mesureValide('distance_km', muscu, 'heures'), 'heures'); // pas de distance en musculation : le défaut
  assert.equal(mesureValide('distance_km', muscu, 'distance_km'), 'seances'); // ni défaut : la première mesure du sport
  assert.equal(mesureValide('allure', mesuresDuSport('velo'), 'distance_km'), 'distance_km');
});

test('avecForce : les séries du carnet rejoignent leur séance (par identifiant, ou la 1re séance de muscu du jour sans identifiant) ; séries à 0 répétition ignorées', () => {
  const acts = [act('2026-03-02', 'musculation', 60, 0, { id: 'a' }), act('2026-03-02', 'course', 40, 8, { id: 'b' }), act('2026-03-05', 'musculation', 50, 0, { id: 'c' })];
  const series = [
    serie(acts[0].id, '2026-03-02', 10, 80),
    serie(acts[0].id, '2026-03-02', 8, 90),
    serie(null, '2026-03-05', 5, 100), // sans identifiant : la séance de muscu du 5 mars
    serie(acts[0].id, '2026-03-02', 0, 50), // 0 répétition : ignorée
  ];
  const r = avecForce(acts, series);
  assert.equal(r[0].series, 2);
  assert.equal(r[0].reps, 18);
  assert.equal(r[0].tonnage, 10 * 80 + 8 * 90);
  assert.equal(r[1].series, undefined); // la course n'a rien
  assert.equal(r[2].series, 1);
  assert.equal(r[2].tonnage, 500);
  assert.equal(avecForce(acts, []), acts); // sans carnet : rien ne change
});

test('sommer : séries, répétitions, tonnage ; allure moyenne = minutes ÷ km, FC moyenne pondérée par la durée', () => {
  const t = sommer([
    act('2026-01-02', 'course', 30, 6, { fc: 150 }), // 5'00"/km
    act('2026-01-05', 'course', 60, 10, { fc: 140 }), // 6'00"/km
    act('2026-01-07', 'course', 20, 0), // sans distance ni FC : ne compte ni dans l'allure ni dans la FC
    act('2026-01-09', 'musculation', 50, 0, { series: 20, reps: 160, tonnage: 9000 }),
  ]);
  assert.ok(Math.abs(t.allure - (30 + 60) / 16) < 1e-9); // 5,625 min/km = 5'37"/km
  assert.ok(Math.abs(t.fc - (150 * 30 + 140 * 60) / 90) < 1e-9);
  assert.equal(t.series, 20);
  assert.equal(t.reps, 160);
  assert.equal(t.tonnage, 9000);
  assert.equal(sommer([act('2026-01-07', 'course', 20, 0)]).allure, 0);
  assert.equal(sommer([]).fc, 0);
});

test('valeursParMois, mesureParSemaine, moyennesParJourSemaine : une mesure moyenne (allure, FC) est une moyenne pondérée, pas une somme ; le tonnage est en tonnes', () => {
  const acts = [
    act('2026-01-05', 'course', 30, 6, { fc: 150 }), // lundi, janvier
    act('2026-01-12', 'course', 60, 10, { fc: 140 }), // lundi, janvier
    act('2026-02-03', 'course', 45, 9, { fc: 160 }),
    act('2026-01-06', 'musculation', 60, 0, { series: 10, reps: 100, tonnage: 4000 }),
    act('2026-01-20', 'musculation', 60, 0, { series: 12, reps: 120, tonnage: 6000 }),
  ];
  const course = acts.slice(0, 3);
  const allures = valeursParMois(course, 2026, 'allure');
  assert.ok(Math.abs(allures[0] - 90 / 16) < 1e-9, `${allures[0]}`);
  assert.ok(Math.abs(allures[1] - 45 / 9) < 1e-9);
  assert.equal(allures[2], 0); // un mois sans course : 0
  const fc = valeursParMois(course, 2026, 'fc');
  assert.ok(Math.abs(fc[0] - (150 * 30 + 140 * 60) / 90) < 1e-9);
  const muscu = acts.slice(3);
  assert.equal(valeursParMois(muscu, 2026, 'tonnage')[0], 10); // 4 t + 6 t
  assert.equal(valeursParMois(muscu, 2026, 'series')[0], 22);
  const semaines = mesureParSemaine(course, 2026, 'allure');
  assert.ok(Math.abs(semaines[1] - 30 / 6) < 1e-9); // la semaine du 5 janvier (la 1re est celle du 29 décembre)
  const jours = moyennesParJourSemaine(course, 2026, maintenant, 'allure');
  assert.ok(Math.abs(jours[0] - 90 / 16) < 1e-9); // les lundis : 5,625 min/km (pas divisé par le nombre de lundis)
  assert.equal(jours[1], 45 / 9); // le mardi 3 février
  assert.equal(jours[6], 0);
  // Une somme reste une somme
  assert.equal(valeursParMois(course, 2026, 'distance_km')[0], 16);
});
