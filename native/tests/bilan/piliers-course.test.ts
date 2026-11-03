import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_ZERO, mesuresCourse, niveauGlobalCourse, PILIERS_COURSE, type LignePiliersCourse, type MesuresCourseAnnee } from '../../src/data/bilan/piliers-course.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import type { SerieNiveau } from '../../src/data/bilan/niveau-annees.ts';

const maintenant = new Date(2026, 5, 15, 12);
const mesure = (an: number, o: Partial<MesuresCourseAnnee> = {}): MesuresCourseAnnee => ({
  an, t1000: null, t5000: null, t10000: null, d300: null, d3600: null, nCourbes: 0, km: 0, heures: 0, joursActifs: 0, joursCouverts: 365, efficacite: null, ...o,
});

test('niveauGlobalCourse : 4 piliers, 100 pour ton meilleur de toujours, 0 à 25 % plus lent', () => {
  const g = niveauGlobalCourse([
    mesure(2024, { t1000: 240, t5000: 1300, t10000: 2700, d300: 1300, d3600: 12000, nCourbes: 10, km: 1000, heures: 100, joursActifs: 150, efficacite: 100 }),
    mesure(2025, { t1000: 300, t5000: 1300, t10000: 2700, d300: 1300, d3600: 12000, nCourbes: 10, km: 1000, heures: 100, joursActifs: 150, efficacite: 80 }),
  ])!;
  assert.deepEqual(g.piliers.map((p) => p.cle), PILIERS_COURSE.map((p) => p.cle));
  const a24 = g.annees[0], a25 = g.annees[1];
  // 2024 : 1 km au record (100) et 5 min au record (100)
  assert.equal(a24.piliers.vitesse, 100);
  assert.equal(a24.piliers.endurance, 100);
  // 2025 : 1 km en 300 s contre 240 : rapport 0,8 → (0,8 − 0,75) ÷ 0,25 = 20 ; 5 min au record (100) : moyenne 60
  assert.ok(Math.abs(a25.piliers.vitesse - 60) < 1e-9, `${a25.piliers.vitesse}`);
  assert.equal(a25.piliers.endurance, 100);
  assert.equal(a24.piliers.efficacite, 100);
  assert.equal(a25.piliers.efficacite, 80);
  // Volume identique : 100 (ta référence)
  assert.equal(a24.piliers.volume, 100);
  assert.equal(COURSE_ZERO, 0.75);
});

test('niveauGlobalCourse : la preuve réduit la note (2 courses avec courbes sur 3 demandées = 2/3)', () => {
  const g = niveauGlobalCourse([
    mesure(2024, { t1000: 240, d300: 1300, nCourbes: 9 }),
    mesure(2025, { t1000: 240, d300: 1300, nCourbes: 2 }),
  ])!;
  assert.equal(g.annees[0].piliers.vitesse, 100);
  assert.ok(Math.abs(g.annees[1].piliers.vitesse - 100 * (2 / 3)) < 1e-9);
  assert.ok(Math.abs(g.annees[1].preuves.vitesse - 2 / 3) < 1e-9);
  // Sans aucune courbe, rien n'est prouvé : note 0
  const sans = niveauGlobalCourse([mesure(2024, { t1000: 240, d300: 1300, nCourbes: 9 }), mesure(2025, { nCourbes: 0 })])!;
  assert.equal(sans.annees[1].piliers.vitesse, 0);
  assert.equal(sans.annees[1].preuves.vitesse, 0);
});

test('niveauGlobalCourse : le score global demande 3 piliers sur 4 prouvés, sinon « — » ; la meilleure année se cherche parmi celles qui ont un score', () => {
  const complete = { t1000: 240, t5000: 1300, t10000: 2700, d300: 1300, d3600: 12000, nCourbes: 5, km: 800, heures: 80, joursActifs: 120, efficacite: 90 };
  const g = niveauGlobalCourse([
    mesure(2020, { km: 500, heures: 50, joursActifs: 90 }), // pas de courbe ni de niveau : seul le volume est prouvé
    mesure(2025, complete),
  ])!;
  assert.equal(g.annees[0].global, null);
  assert.equal(g.annees[0].nbPiliers, 1);
  assert.equal(g.annees[1].nbPiliers, 4);
  assert.ok(g.annees[1].global !== null && g.annees[1].global > 80);
  assert.equal(g.meilleur.an, 2025);
  assert.equal(g.actuel.an, 2025);
  // Exactement 3 piliers prouvés : le score existe (sans efficacité)
  const trois = niveauGlobalCourse([mesure(2025, { ...complete, efficacite: null })])!;
  assert.equal(trois.actuel.nbPiliers, 3);
  assert.ok(trois.actuel.global !== null);
  assert.equal(niveauGlobalCourse([]), null);
});

test('niveauGlobalCourse : le volume est ramené à une année complète et jugé contre tes 3 meilleures années', () => {
  const g = niveauGlobalCourse([
    mesure(2023, { km: 1000, heures: 100, joursActifs: 150 }),
    mesure(2024, { km: 800, heures: 80, joursActifs: 120 }),
    mesure(2025, { km: 600, heures: 60, joursActifs: 90 }),
    // L'année en cours : 150 jours couverts, 400 km → 974 km sur une année : au-dessus de la référence
    mesure(2026, { km: 400, heures: 40, joursActifs: 60, joursCouverts: 150 }),
  ])!;
  const ref = (1000 + 800 + 600) / 3; // la moyenne des 3 meilleures : 2026 annualisé (974) entre dans les 3 meilleures à la place de 600
  const refReelle = (1000 + 800 + (400 * 365) / 150) / 3;
  assert.ok(refReelle > ref);
  assert.ok(g.annees[3].piliers.volume > 90, `${g.annees[3].piliers.volume}`);
  assert.ok(g.annees[2].piliers.volume < g.annees[0].piliers.volume);
  // Moins de 30 jours couverts : pas de volume mesuré
  const court = niveauGlobalCourse([mesure(2025, { km: 5, heures: 1, joursActifs: 2, joursCouverts: 10 })])!;
  assert.equal(court.actuel.piliers.volume, 0);
  assert.equal(court.actuel.preuves.volume, 0);
});

test('mesuresCourse : réunit les courbes du serveur, le volume des séances de course et la note d\'efficacité', () => {
  const act = (iso: string, km: number, min: number, sport: ActiviteBilan['sport'] = 'course'): ActiviteBilan => ({ id: iso + sport, name: iso, iso, sport, famille: sport, duree_min: min, distance_km: km, d_plus: 0, tss: 0 });
  const lignes: LignePiliersCourse[] = [{ an: 2025, t1000: 250, t5000: 1400, t10000: null, d300: 1200, d3600: null, nCourbes: 4 }];
  const serie = { annuel: [{ an: 2025, score: 77 }, { an: 2026, score: 88 }] } as unknown as SerieNiveau;
  const acts = [act('2025-03-01', 10, 55), act('2025-03-01', 5, 28), act('2025-04-10', 8, 45), act('2025-04-11', 40, 90, 'cyclisme'), act('2026-02-01', 12, 60)];
  const m = mesuresCourse(lignes, acts, serie, maintenant);
  assert.deepEqual(m.map((x) => x.an), [2025, 2026]);
  const a25 = m[0];
  assert.equal(a25.km, 23);
  assert.ok(Math.abs(a25.heures - (55 + 28 + 45) / 60) < 1e-9);
  assert.equal(a25.joursActifs, 2); // deux jours distincts
  assert.equal(a25.t1000, 250);
  assert.equal(a25.nCourbes, 4);
  assert.equal(a25.efficacite, 77);
  assert.equal(a25.joursCouverts, 306); // du 1er mars 2025 (première course) au 31 décembre 2025
  const a26 = m[1];
  assert.equal(a26.t1000, null);
  assert.equal(a26.nCourbes, 0);
  assert.equal(a26.efficacite, 88);
  assert.equal(a26.joursCouverts, 166); // du 1er janvier au 15 juin 2026
  assert.deepEqual(mesuresCourse([], [], null, maintenant), []);
});
