// Plan de course à pied : niveau, objectif réaliste, allures, phases, séances avec contenu précis. Cas de référence : le profil réel de Yanis.
// Lancer : node --experimental-strip-types --test supabase/tests/edge/plan-course.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { alluresDepuisCourse, equivalent, formaterAllure, formaterTemps, niveauActuel, objectifRealiste, phases, planifierCourse, profilCourseDepuisResume } from '../../functions/_shared/plan-course.ts';
import type { ProfilCourse } from '../../functions/_shared/plan-course.ts';
import { evaluerPlan } from '../../functions/_shared/planning.ts';
import type { Operation } from '../../functions/_shared/planning.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours, ecartJours } from '../../functions/_shared/dates-iso.ts';

const AUJ = '2026-11-09';
const COURSE = '2026-12-13';
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
const ctx = (sur: Partial<ContexteValidation> = {}): ContexteValidation => ({ aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [{ date: COURSE }], gardeFou: LIBRE, ...sur });

/** Le profil réel de Yanis (nov. 2026) : 5 km en 21:48 en déc. 2024, ~6 km à 5:50/km en ce moment */
const YANIS: ProfilCourse = {
  meilleurEffort: { date: '2024-12-15', km: 5, secondes: 1308, equiv10Secondes: Math.round(equivalent(1308, 5, 10)) },
  recent: { sorties: 5, km: 27, minutes: 160, plusLongueMinutes: 41, allureMedianeSParKm: 350 },
  semaines: [{ km: 0, minutes: 0, sorties: 0 }, { km: 0, minutes: 0, sorties: 0 }, { km: 0, minutes: 0, sorties: 0 }, { km: 0, minutes: 0, sorties: 0 }, { km: 0, minutes: 0, sorties: 0 }, { km: 10.8, minutes: 71, sorties: 2 }, { km: 12.2, minutes: 75, sorties: 2 }, { km: 6, minutes: 35, sorties: 1 }],
  jours: { 1: 3, 3: 2, 5: 1 },
};
const DEMANDE = { date: COURSE, km: 10.15, tempsCibleMinutes: 40 };
const ajouts = (ops: Operation[]) => ops.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter');

test('formats : allure et temps', () => {
  assert.equal(formaterAllure(281), '4:41');
  assert.equal(formaterTemps(2400), '40:00');
  assert.equal(formaterTemps(3900), '1 h 05');
});
test('niveau : le meilleur effort vieillit, l\'allure facile le corrige ; null sans donnée', () => {
  const n = niveauActuel(YANIS, 10.15, AUJ)!;
  assert.ok(n.secondes > 2700 && n.secondes < 3100, String(n.secondes)); // entre 45:00 et 51:40
  assert.match(n.source, /meilleur effort/);
  assert.match(n.source, /allure facile/);
  assert.equal(niveauActuel(null, 10, AUJ), null);
  const sans = niveauActuel({ ...YANIS, meilleurEffort: null, recent: { ...YANIS.recent, sorties: 1 } }, 10, AUJ);
  assert.equal(sans, null);
});
test('objectif réaliste : 0,6 % par semaine, 8 % au plus', () => {
  assert.equal(objectifRealiste(3000, 5), 2910);
  assert.equal(objectifRealiste(3000, 40), 2760);
  assert.equal(objectifRealiste(3000, 0), 3000);
});
test('allures : cohérentes entre elles (vma < 5 km < course < seuil < tempo < facile < longue)', () => {
  const a = alluresDepuisCourse(2400, 10);
  assert.ok(a.vma < a.cinqK && a.cinqK < a.course && a.course < a.seuil && a.seuil < a.tempo && a.tempo < a.facile && a.facile < a.longue);
  assert.equal(Math.round(a.course), 240);
});
test('phases : 5 semaines = base, développement ×2, spécifique, affûtage ; 12 semaines ; 1 semaine', () => {
  assert.deepEqual(phases(5), ['base', 'developpement', 'developpement', 'specifique', 'affutage']);
  const p12 = phases(12);
  assert.equal(p12.length, 12);
  assert.deepEqual(p12.slice(-2), ['affutage', 'affutage']);
  assert.equal(p12.filter((x) => x === 'specifique').length, 3);
  assert.deepEqual(phases(1), ['affutage']);
});
test('le résumé : profil_course lu, champs bizarres = valeurs neutres', () => {
  const p = profilCourseDepuisResume({ profil_course: { meilleur_effort: { date: '2024-12-15', km: '5.00', secondes: 1308, equiv_10km_secondes: 2730 }, recent: { sorties: 5, km: 27, minutes: 160, plus_longue_minutes: 41, allure_mediane_s_par_km: 350 }, semaines: [{ km: 6, minutes: 35, sorties: 1 }], jours: { '1': 3, '9': 4, x: 1 } } })!;
  assert.equal(p.meilleurEffort?.equiv10Secondes, 2730);
  assert.deepEqual(p.jours, { 1: 3 });
  assert.equal(profilCourseDepuisResume({}), null);
  const vide = profilCourseDepuisResume({ profil_course: { meilleur_effort: null, recent: {}, semaines: 'non' } })!;
  assert.equal(vide.meilleurEffort, null);
  assert.deepEqual(vide.semaines, []);
});

test('plan de Yanis : 5 semaines jusqu\'au 13 déc., 40 min visées = ambitieux, calé sur le jouable, dit franchement', () => {
  const r = planifierCourse(DEMANDE, [], ctx(), YANIS);
  assert.equal(r.bilan?.verdict, 'ambitieux');
  assert.equal(r.bilan?.semaines, 5);
  assert.ok(r.bilan!.objectifPlan! > 2400);
  assert.match(r.message, /très ambitieux/);
  assert.match(r.message, /40:00/);
  // les allures facile et longue collent à ce qu'il court vraiment (5:40 à 6:10 /km)
  const facile = r.bilan!.allures!.facile;
  assert.ok(facile > 330 && facile < 380, String(facile));
  // chaque semaine est décrite
  assert.equal(r.semaines.length, 5);
  assert.match(r.semaines[0], /base/);
  assert.match(r.semaines[4], /affûtage/);
});
test('plan de Yanis : validé en entier, chaque séance a un contenu précis, jamais le jour J ni après, jamais deux fois le même jour', () => {
  const c = ctx();
  const r = planifierCourse(DEMANDE, [], c, YANIS);
  const a = ajouts(r.operations);
  assert.ok(a.length >= 12 && a.length <= 20, String(a.length));
  const ev = evaluerPlan(r.operations, [], c);
  assert.equal(ev.ok, true, ev.erreurs.join('|'));
  assert.ok(a.every((o) => o.proposition.date >= '2026-11-10' && o.proposition.date < COURSE));
  assert.equal(new Set(a.map((o) => o.proposition.date)).size, a.length);
  for (const o of a) {
    assert.ok(o.detail && o.detail.structure.length >= 1 && o.detail.nom.length > 5, JSON.stringify(o.proposition));
    // la somme des blocs est EXACTEMENT la durée de la séance
    const somme = o.detail!.structure.reduce((t, b) => t + b.reps * b.work.min + (b.rec ? b.reps * b.rec.min : 0), 0);
    assert.ok(Math.abs(somme - o.proposition.minutes) < 0.06, `${o.detail!.nom} : ${somme} ≠ ${o.proposition.minutes}`);
    assert.ok(o.justification.length > 30);
  }
  // pas que des footings : du fractionné, du tempo, une sortie longue
  const types = new Set(a.map((o) => o.proposition.type));
  for (const t of ['footing_facile', 'sortie_longue', 'fractionne']) assert.ok(types.has(t), `manque ${t} : ${[...types]}`);
  // des noms variés avec des allures chiffrées
  assert.ok(a.filter((o) => /\d:\d\d\/km/.test(o.detail!.resume)).length >= 8);
  assert.ok(new Set(a.map((o) => o.detail!.nom)).size >= 8);
});
test('plan de Yanis : la qualité suit les phases (VMA en développement, allure course en spécifique, rappel d\'allure en affûtage)', () => {
  const r = planifierCourse(DEMANDE, [], ctx(), YANIS);
  const a = ajouts(r.operations);
  const entre = (x: string, y: string) => a.filter((o) => o.proposition.date >= x && o.proposition.date <= y);
  const nomsDev = entre('2026-11-16', '2026-11-29').map((o) => o.detail!.nom).join(' | ');
  assert.match(nomsDev, /\d × \d+ m à \d:\d\d\/km/);
  assert.match(entre('2026-11-30', '2026-12-06').map((o) => o.detail!.nom).join(' | '), /allure course/);
  assert.match(entre('2026-12-07', '2026-12-12').map((o) => o.detail!.nom).join(' | '), /Rappel d'allure/);
});
test('plan de Yanis : le volume monte puis baisse à l\'affûtage ; la dernière semaine est la plus légère ; la sortie longue progresse sans dépasser 80 min', () => {
  const r = planifierCourse(DEMANDE, [], ctx(), YANIS);
  const a = ajouts(r.operations);
  const minutes = (x: string, y: string) => a.filter((o) => o.proposition.date >= x && o.proposition.date <= y).reduce((t, o) => t + o.proposition.minutes, 0);
  const v = [minutes('2026-11-10', '2026-11-16'), minutes('2026-11-17', '2026-11-23'), minutes('2026-11-24', '2026-11-30'), minutes('2026-12-01', '2026-12-07'), minutes('2026-12-08', '2026-12-12')];
  assert.ok(v[2] > v[0], v.join(','));
  assert.ok(v[4] < v[3] && v[4] < v[2], v.join(','));
  const longues = a.filter((o) => o.proposition.type === 'sortie_longue').map((o) => o.proposition.minutes);
  assert.ok(longues.length >= 3 && Math.max(...longues) <= 80, longues.join(','));
  assert.ok(longues[1] >= longues[0]);
});
test('une cible réaliste est confirmée, et sans cible le plan est calé sur le jouable', () => {
  const facile = planifierCourse({ ...DEMANDE, tempsCibleMinutes: 55 }, [], ctx(), YANIS);
  assert.equal(facile.bilan?.verdict, 'realiste');
  assert.match(facile.message, /réaliste/);
  const sans = planifierCourse({ date: COURSE, km: 10.15 }, [], ctx(), YANIS);
  assert.equal(sans.bilan?.verdict, 'sans_cible');
});
test('sans aucune donnée ni temps visé : rien, avec la raison ; avec un temps visé : plan calé dessus, prévenu', () => {
  const rien = planifierCourse({ date: COURSE, km: 10 }, [], ctx(), null);
  assert.deepEqual(rien.operations, []);
  const avec = planifierCourse({ date: COURSE, km: 10, tempsCibleMinutes: 50 }, [], ctx(), null);
  assert.equal(avec.bilan?.verdict, 'sans_donnees');
  assert.ok(ajouts(avec.operations).length > 8);
});
test('jours de repos, indisponibilité, jours libres : respectés ; le jour de la course : jamais', () => {
  const c = ctx({ joursDeRepos: ['2026-11-11'], indisponibilites: [{ type: 'blessure', du: '2026-11-20', au: '2026-11-22' }] });
  const r = planifierCourse({ ...DEMANDE, joursLibres: ['2026-11-14'] }, [], c, YANIS);
  const dates = ajouts(r.operations).map((o) => o.proposition.date);
  for (const x of ['2026-11-11', '2026-11-14', '2026-11-20', '2026-11-21', '2026-11-22', COURSE]) assert.ok(!dates.includes(x), x);
  assert.equal(evaluerPlan(r.operations, [], c).ok, true);
});
test('course trop proche, passée ou trop lointaine : refus clair ; course dans une semaine : un affûtage seulement', () => {
  assert.deepEqual(planifierCourse({ date: '2026-11-05', km: 10 }, [], ctx(), YANIS).operations, []);
  assert.deepEqual(planifierCourse({ date: '2028-11-05', km: 10 }, [], ctx(), YANIS).operations, []);
  const c = ctx({ competitions: [{ date: '2026-11-15' }] });
  const court = planifierCourse({ date: '2026-11-15', km: 10, tempsCibleMinutes: 50 }, [], c, YANIS);
  assert.equal(court.bilan?.semaines, 1);
  assert.ok(ajouts(court.operations).length >= 1);
  assert.ok(ajouts(court.operations).every((o) => o.proposition.date < '2026-11-15' && ecartJours(o.proposition.date, '2026-11-15') >= 1));
});
test('un plan long (20 semaines) : validé, 4e semaine plus légère, jamais plus de 60 semaines', () => {
  const course = ajouterJours(AUJ, 140);
  const c = ctx({ competitions: [{ date: course }] });
  const r = planifierCourse({ date: course, km: 21.1, tempsCibleMinutes: 110 }, [], c, YANIS);
  assert.equal(r.bilan?.semaines, 20);
  assert.equal(evaluerPlan(r.operations, [], c).ok, true);
  assert.match(r.semaines[3], /récupération/);
});
