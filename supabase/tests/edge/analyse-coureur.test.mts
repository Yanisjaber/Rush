import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserCoureur } from '../../functions/_shared/analyse-coureur.ts';
import type { ProfilCourse } from '../../functions/_shared/plan-course.ts';

const AUJ = '2026-11-11';
const profil = (minutes: number[], sorties: number[], sur: Partial<ProfilCourse> = {}): ProfilCourse => ({
  meilleurEffort: null, effortRecent: null, sorties90: sorties.reduce((t, x) => t + x, 0),
  recent: { sorties: sorties.slice(-8).reduce((t, x) => t + x, 0), km: 0, minutes: 0, plusLongueMinutes: 0, allureMedianeSParKm: 330 },
  semaines: minutes.map((m, i) => ({ km: m / 6, minutes: m, sorties: sorties[i] })), jours: {}, ...sur,
});
const effort = (date: string) => ({ date, km: 10, secondes: 3000, equiv10Secondes: 3000 });

test('sans aucune donnée : débutant', () => {
  assert.equal(analyserCoureur(null, null, AUJ).etat, 'debutant');
});
test('régulier avec un effort rapide récent : rien à demander', () => {
  const a = analyserCoureur(profil([180, 190, 185, 200, 195, 190, 200, 190], [4, 4, 4, 4, 4, 4, 4, 4], { effortRecent: effort('2026-10-20') }), null, AUJ);
  assert.equal(a.etat, 'regulier');
  assert.equal(a.effortRapideRecent, true);
  assert.equal(a.inconnues.length, 0);
});
test('régulier mais sans effort rapide récent : le code dit ce qu\'il ne sait pas et pose la question', () => {
  const a = analyserCoureur(profil([180, 190, 185, 200, 195, 190, 200, 190], [4, 4, 4, 4, 4, 4, 4, 4], { effortRecent: effort('2026-08-01') }), null, AUJ);
  assert.equal(a.effortRapideRecent, false);
  assert.equal(a.inconnues.length, 1);
  assert.match(a.inconnues[0].question, /test chronométré/);
});
test('irrégulier, hausse, baisse, reprise', () => {
  assert.equal(analyserCoureur(profil([0, 120, 0, 0, 100, 0, 0, 90], [0, 2, 0, 0, 2, 0, 0, 2], { effortRecent: effort('2026-11-01') }), null, AUJ).etat, 'irregulier');
  assert.equal(analyserCoureur(profil([100, 100, 100, 100, 150, 150, 150, 150], [3, 3, 3, 3, 3, 3, 3, 3], { effortRecent: effort('2026-11-01') }), null, AUJ).etat, 'en_hausse');
  const baisse = analyserCoureur(profil([200, 200, 200, 200, 120, 120, 120, 120], [4, 4, 4, 4, 3, 3, 3, 3], { effortRecent: effort('2026-11-01') }), null, AUJ);
  assert.equal(baisse.etat, 'en_baisse');
  assert.equal(baisse.tendancePourcent, -40);
  assert.ok(baisse.inconnues.some((i) => /volume baisse/.test(i.sujet)));
  assert.equal(analyserCoureur(profil([0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], { meilleurEffort: { date: '2025-01-01', km: 10, secondes: 3000, equiv10Secondes: 3000 } }), null, AUJ).etat, 'reprise');
});
