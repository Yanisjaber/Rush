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

import { profilCourseDepuisResume, estDebutant, planifierCourse } from '../../functions/_shared/plan-course.ts';

const vieBrute = {
  premiere_sortie: '2021-03-01', derniere_sortie: '2025-05-04', jours_depuis_derniere: 556, sorties: 120, km_total: 1100, heures_total: 95,
  annees: [{ annee: 2021, sorties: 80, km: 700, heures: 60, semaines_actives: 30 }, { annee: 2025, sorties: 40, km: 400, heures: 35, semaines_actives: 15 }],
  plus_grosse_semaine: { du: '2021-10-04', sorties: 5, km: 55, minutes: 320 },
  plus_longue_sortie: { date: '2021-11-07', km: 21, minutes: 120 },
  arrets: [{ du: '2021-12-20', au: '2025-02-01', jours: 1200 }],
  meilleur_effort_vie: { date: '2021-10-10', km: 10, secondes: 2700, equiv_10km_secondes: 2700 },
  meilleur_effort_par_annee: [{ annee: 2021, date: '2021-10-10', km: 10, secondes: 2700, equiv_10km_secondes: 2700 }, { annee: 2025, date: '2025-04-01', km: 10, secondes: 3000, equiv_10km_secondes: 3000 }],
  ctl_max: { date: '2021-10-12', ctl: 62 }, vo2max_course_profil: 55,
  poids_par_annee: [{ annee: 2021, mesures: 10, moyenne_kg: 70 }], sommeil_par_annee: null,
};
const resumeSansSortieRecente = (vie: unknown) => ({
  profil_course: { meilleur_effort: null, meilleur_effort_recent: null, sorties_90_jours: 0, recent: { sorties: 0, km: 0, minutes: 0 }, semaines: [], jours: {} },
  vie_course: vie,
});

test('toute la vie : un coureur de 2021 sans sortie depuis 556 jours n\'est PAS un débutant, c\'est une reprise', () => {
  const p = profilCourseDepuisResume(resumeSansSortieRecente(vieBrute))!;
  assert.equal(p.vie?.sorties, 120);
  assert.equal(estDebutant(p, null), false);
  assert.equal(estDebutant(profilCourseDepuisResume(resumeSansSortieRecente(null)), null), true);
  const a = analyserCoureur(p, null, AUJ);
  assert.equal(a.etat, 'reprise');
  const texte = a.phrases.join(' ');
  assert.match(texte, /depuis 2021/);
  assert.match(texte, /320 min/);
  assert.match(texte, /45:00/);
  assert.match(texte, /plus lent/);
  assert.match(texte, /VO2max/);
  assert.match(texte, /70 kg/);
  assert.ok(a.inconnues.some((i) => /arrêté/.test(i.sujet)), 'demande pourquoi il a arrêté');
  assert.doesNotMatch(texte, /sommeil/, 'pas de sommeil sans accord');
});
test('toute la vie : le plan de reprise part de 35 % de la plus grosse semaine de sa vie (320 min → 112 min)', () => {
  const p = profilCourseDepuisResume(resumeSansSortieRecente(vieBrute))!;
  const course = '2027-01-20';
  const base = { aujourdhui: AUJ, ctl: 0, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [{ date: course }], gardeFou: { niveau: 'normal', raisons: [] } } as never;
  const r = planifierCourse({ date: course, km: 10, tempsCibleMinutes: 60, seancesParSemaine: 3, sansTest: true }, [], base, p);
  assert.equal(r.bilan.volumeDepart, 112, String(r.bilan.volumeDepart));
  assert.doesNotMatch(r.bilan.debutant ? 'debutant' : '', /debutant/);
});
