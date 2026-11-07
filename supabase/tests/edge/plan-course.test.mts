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

/** Le profil réel de Yanis (nov. 2026) : 5 km en 21:48 en déc. 2024 (ANCIEN), ~6 km à 5:50/km en ce moment */
const YANIS: ProfilCourse = {
  meilleurEffort: { date: '2024-12-15', km: 5, secondes: 1308, equiv10Secondes: Math.round(equivalent(1308, 5, 10)) },
  effortRecent: { date: '2026-11-04', km: 6, secondes: 2100, equiv10Secondes: Math.round(equivalent(2100, 6, 10)) },
  sorties90: 11,
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
test('niveau : fixé par les sorties des 90 derniers jours, JAMAIS par le record de 2024 ; chrono > récent > ancien ; null sans donnée', () => {
  const n = niveauActuel(YANIS, 10.15, AUJ)!;
  assert.equal(n.fiabilite, 'recente');
  assert.match(n.source, /sorties récentes/);
  // 6 km en 35:00 converti sur 10,15 km (≈ 1 h 01), pris pour 7 % plus lent qu'un vrai effort : autour de 57 min, très loin des 48:50 de l'ancien calcul
  assert.ok(n.secondes > 3300 && n.secondes < 3500, String(n.secondes));
  // sans sortie récente : le vieux record est très vieilli (+30 % après 2 ans), estimation « ancienne »
  const ancien = niveauActuel({ ...YANIS, effortRecent: null, recent: { ...YANIS.recent, sorties: 0 } }, 10.15, AUJ)!;
  assert.equal(ancien.fiabilite, 'ancienne');
  assert.ok(ancien.secondes > 3500, String(ancien.secondes));
  assert.match(ancien.source, /faute de sorties récentes/);
  // un chrono réel écrase tout : 3 km en 15:00 → environ 54:36 sur 10,15 km
  const c = niveauActuel(YANIS, 10.15, AUJ, { km: 3, secondes: 900 })!;
  assert.equal(c.fiabilite, 'chrono');
  assert.ok(c.secondes > 3200 && c.secondes < 3350, String(c.secondes));
  assert.equal(niveauActuel(null, 10, AUJ), null);
  assert.equal(niveauActuel({ ...YANIS, effortRecent: null, meilleurEffort: null }, 10, AUJ), null);
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
  const v = r.semaines.map((l) => Number(/(\d+) min$/.exec(l)![1]));
  assert.equal(v.length, 5);
  assert.ok(v[3] > v[0], v.join(','));
  assert.ok(v[4] < v[3] && v[4] === Math.min(...v), v.join(','));
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

test('allures imposées : remplacent celles du calcul (la VMA passe de 4:19 à 4:30), les autres restent, le bilan le dit', async () => {
  const { lireAllure, ALLURES_CLES } = await import('../../functions/_shared/plan-course.ts');
  assert.equal(lireAllure('4:30'), 270);
  assert.equal(lireAllure("4'30"), 270);
  assert.equal(lireAllure('4:30/km'), 270);
  for (const m of ['4:75', 'vite', '', null, '1:00', '20:00', 12]) assert.equal(lireAllure(m), null, String(m));
  assert.deepEqual(ALLURES_CLES, ['vma', 'cinqK', 'course', 'seuil', 'tempo', 'facile', 'longue']);
  const avant = planifierCourse(DEMANDE, [], ctx(), YANIS);
  const apres = planifierCourse({ ...DEMANDE, allures: { vma: 270 } }, [], ctx(), YANIS);
  assert.equal(apres.bilan!.allures!.vma, 270);
  assert.equal(apres.bilan!.allures!.course, avant.bilan!.allures!.course);
  assert.deepEqual(apres.bilan!.imposees, ['vma']);
  assert.match(apres.message, /Allures imposées/);
  assert.match(apres.message, /VMA \(fractionné court, 400-800 m\) 4:30/);
  const noms = ajouts(apres.operations).map((o) => o.detail!.nom).join(' | ');
  assert.match(noms, /× 400 m à 4:30\/km/);
  assert.doesNotMatch(noms, /4:19/);
});

test('le bilan rappelle le nombre de séances par semaine pour qu\'un plan refait garde le même rythme', () => {
  const r = planifierCourse({ ...DEMANDE, seancesParSemaine: 4 }, [], ctx(), YANIS);
  assert.match(r.message, /Plan à 4 séances par semaine/);
});

test('première sortie = TEST (3 km chrono) quand le niveau n\'est pas mesuré : en semaine 1, avec ses blocs, et le bilan demande le temps', () => {
  const r = planifierCourse(DEMANDE, [], ctx(), YANIS);
  assert.equal(r.bilan?.test, true);
  const a = ajouts(r.operations);
  const test = a.filter((o) => /Sortie test/.test(o.detail!.nom));
  assert.equal(test.length, 1);
  assert.ok(test[0].proposition.date <= '2026-11-16', test[0].proposition.date);
  assert.deepEqual(test[0].detail!.structure.map((b) => b.type), ['warmup', 'steady', 'cooldown']);
  assert.match(test[0].detail!.structure[1].name, /3 km chrono/);
  assert.match(test[0].justification, /donne-moi ton temps/);
  assert.match(r.message, /TEST \(3 km chrono\)/);
  assert.match(r.message, /chrono_km et chrono_temps/);
  assert.match(r.message, /ne sont pas des efforts maximaux/);
  assert.equal(evaluerPlan(r.operations, [], ctx()).ok, true);
});
test('chrono réel : plus de test, niveau mesuré, tout le plan recalibré dessus (allures plus rapides qu\'avec l\'estimation)', () => {
  const avant = planifierCourse(DEMANDE, [], ctx(), YANIS);
  const apres = planifierCourse({ ...DEMANDE, chrono: { km: 3, secondes: 840 } }, [], ctx(), YANIS); // 3 km en 14:00
  assert.equal(apres.bilan?.test, false);
  assert.equal(apres.bilan?.niveauFiabilite, 'chrono');
  assert.ok(ajouts(apres.operations).every((o) => !/Sortie test/.test(o.detail!.nom)));
  assert.match(apres.message, /ton chrono de test \(3 km en 14:00\)/);
  assert.ok(apres.bilan!.niveau!.secondes < avant.bilan!.niveau!.secondes);
  assert.ok(apres.bilan!.allures!.course < avant.bilan!.allures!.course);
});
test('sans_test, plan trop court, ou sans aucune donnée : pas de test quand il ne sert à rien ; avec une vieille donnée seulement : message d\'alerte', () => {
  assert.equal(planifierCourse({ ...DEMANDE, sansTest: true }, [], ctx(), YANIS).bilan?.test, false);
  const c = ctx({ competitions: [{ date: '2026-11-15' }] });
  assert.equal(planifierCourse({ date: '2026-11-15', km: 10, tempsCibleMinutes: 60 }, [], c, YANIS).bilan?.test, false);
  const ancien = planifierCourse(DEMANDE, [], ctx(), { ...YANIS, effortRecent: null, recent: { ...YANIS.recent, sorties: 0, allureMedianeSParKm: null } });
  assert.equal(ancien.bilan?.niveauFiabilite, 'ancienne');
  assert.match(ancien.message, /AUCUNE sortie récente/);
  assert.equal(ancien.bilan?.test, true);
});
test('le footing n\'est jamais plus lent que ce que le coureur court vraiment (plafond à son allure médiane récente +3 %)', () => {
  const r = planifierCourse(DEMANDE, [], ctx(), YANIS);
  assert.ok(r.bilan!.allures!.facile <= 350 * 1.03 + 0.5, String(r.bilan!.allures!.facile));
  assert.ok(r.bilan!.allures!.longue <= 350 * 1.06 + 0.5);
  const sans = planifierCourse({ ...DEMANDE, tempsCibleMinutes: 40 }, [], ctx(), { ...YANIS, recent: { ...YANIS.recent, sorties: 0 } });
  assert.ok(sans.bilan!.allures!.facile > 350 * 1.03);
});
test('temps : mm:ss et h:mm:ss', async () => {
  const { lireTemps } = await import('../../functions/_shared/plan-course.ts');
  assert.equal(lireTemps('15:10'), 910);
  assert.equal(lireTemps('1:05:30'), 3930);
  for (const m of ['15', '15:75', 'vite', '', null, '0:30', '25:00:00']) assert.equal(lireTemps(m), null, String(m));
});
