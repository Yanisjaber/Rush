// Le calendrier de courses vu en entier : blocs (même jour ou jours qui se suivent), récupération, cible, étapes, et leur effet sur le plan.
// Lancer : node --experimental-strip-types --test supabase/tests/edge/calendrier-courses.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserCalendrier, coursesDepuisResume, formerBlocs, joursRecuperation } from '../../functions/_shared/calendrier-courses.ts';
import type { Course } from '../../functions/_shared/calendrier-courses.ts';
import { planifierCourse } from '../../functions/_shared/plan-course.ts';
import type { ProfilCourse } from '../../functions/_shared/plan-course.ts';
import { ajouterJours, ecartJours, nomDuJour } from '../../functions/_shared/dates-iso.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';

const c = (date: string, km: number | null, extra: Partial<Course> = {}): Course => ({ date, km, heure: null, priorite: null, tempsCibleMin: null, ...extra });

test('blocs : n courses le même jour, ou sur des jours qui se suivent, forment UN bloc ; deux jours d\'écart en font deux', () => {
  assert.equal(formerBlocs([c('2026-12-13', 5), c('2026-12-13', 10), c('2026-12-13', 3), c('2026-12-13', 1)]).length, 1);
  const trois = formerBlocs([c('2026-12-13', 10), c('2026-12-11', 10), c('2026-12-12', 10)]);
  assert.equal(trois.length, 1);
  assert.deepEqual([trois[0].debut, trois[0].fin, trois[0].kmTotal], ['2026-12-11', '2026-12-13', 30]);
  assert.equal(formerBlocs([c('2026-12-11', 10), c('2026-12-13', 10)]).length, 2);
  assert.deepEqual(formerBlocs([]), []);
});
test('blocs : les courses d\'un bloc sont classées par heure de départ', () => {
  const [b] = formerBlocs([c('2026-12-13', 10, { heure: '10:00' }), c('2026-12-13', 5, { heure: '09:10' })]);
  assert.deepEqual(b.courses.map((x) => x.km), [5, 10]);
});
test('récupération : milieu des fourchettes de la fiche (3 jours jusqu\'à 10 km, 10 jours dès un marathon), interpolé, distances additionnées', () => {
  assert.equal(joursRecuperation(5), 3);
  assert.equal(joursRecuperation(10), 3);
  assert.equal(joursRecuperation(42.195), 10);
  assert.equal(joursRecuperation(100), 10);
  assert.equal(joursRecuperation(21.1), 5);
  assert.equal(joursRecuperation(0), 3, 'distance inconnue');
  assert.ok(joursRecuperation(30) > joursRecuperation(20));
});
test('lecture du résumé : seulement la course à pied, champs bizarres = null', () => {
  const l = coursesDepuisResume([{ date: '2026-12-13', sport: 'course', km: '10', priorite: 'Z', heure: '9h', temps_cible_min: -3 }, { date: '2026-12-14', sport: 'velo', km: 80 }, { sport: 'course' }, null, { date: '2026-12-20', sport: 'course', km: 21.1, priorite: 'A', heure: '08:30', temps_cible_min: 100 }]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0], { date: '2026-12-13', km: null, heure: null, priorite: null, tempsCibleMin: null });
  assert.deepEqual(l[1], { date: '2026-12-20', km: 21.1, heure: '08:30', priorite: 'A', tempsCibleMin: 100 });
  assert.deepEqual(coursesDepuisResume(undefined), []);
});
const AUJ = '2026-11-09';
test('cible : la date demandée, sinon le premier bloc avec une course A, sinon le premier ; jamais de blocage pour demander', () => {
  const cal = [c('2026-11-22', 10, { priorite: 'B' }), c('2026-12-13', 10, { priorite: 'A' }), c('2027-02-07', 21.1, { priorite: 'A' })];
  const parDefaut = analyserCalendrier(cal, { aujourdhui: AUJ })!;
  assert.equal(parDefaut.cible.debut, '2026-12-13');
  assert.deepEqual(parDefaut.avant.map((b) => b.debut), ['2026-11-22']);
  assert.deepEqual(parDefaut.apres.map((b) => b.debut), ['2027-02-07']);
  assert.equal(analyserCalendrier(cal, { aujourdhui: AUJ, dateDemandee: '2026-11-22' })!.cible.debut, '2026-11-22');
  assert.equal(analyserCalendrier([c('2026-11-22', 10)], { aujourdhui: AUJ })!.cible.debut, '2026-11-22', 'aucune A : la première');
  assert.equal(analyserCalendrier([], { aujourdhui: AUJ }), null);
  // une date demandée qui n'est pas au calendrier : cible sans course, l'étape d'avant reste prise en compte
  const libre = analyserCalendrier(cal, { aujourdhui: AUJ, dateDemandee: '2026-12-01' })!;
  assert.equal(libre.reference, null);
  assert.deepEqual(libre.avant.map((b) => b.debut), ['2026-11-22']);
  // une course passée n'est jamais une cible
  assert.equal(analyserCalendrier([c('2026-11-01', 10)], { aujourdhui: AUJ }), null);
});
test('référence d\'un bloc : la distance demandée, sinon la meilleure priorité, sinon un temps visé, sinon la plus longue', () => {
  const bloc = [c('2026-12-13', 5, { heure: '09:10', priorite: 'A', tempsCibleMin: 20 }), c('2026-12-13', 10, { heure: '10:00', priorite: 'A' }), c('2026-12-13', 3, { heure: '11:30', priorite: 'B' })];
  assert.equal(analyserCalendrier(bloc, { aujourdhui: AUJ, kmDemande: 10 })!.reference!.km, 10);
  assert.equal(analyserCalendrier(bloc, { aujourdhui: AUJ })!.reference!.km, 5, 'à priorité égale, celle qui a un temps visé');
  assert.equal(analyserCalendrier([c('2026-12-13', 5, { priorite: 'B' }), c('2026-12-13', 10, { priorite: 'A' })], { aujourdhui: AUJ })!.reference!.km, 10);
  assert.equal(analyserCalendrier([c('2026-12-13', 5), c('2026-12-13', 10)], { aujourdhui: AUJ })!.reference!.km, 10, 'sinon la plus longue');
  const n = analyserCalendrier(bloc, { aujourdhui: AUJ })!.note;
  assert.match(n, /BLOC DE COMPÉTITION visé/);
  assert.match(n, /AUCUNE étude|Aucune étude/);
  assert.match(n, /tu n'inventes AUCUN chiffre/);
});
test('la note n\'existe que s\'il y a quelque chose à dire (une seule course, rien avant ni après = pas de note)', () => {
  assert.equal(analyserCalendrier([c('2026-12-13', 10, { priorite: 'A' })], { aujourdhui: AUJ })!.note, '');
});

// ---------- Effet sur le plan ----------
const COURSE = '2026-12-13';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
const ctx = (competitions: { date: string }[]): ContexteValidation => ({ aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions, gardeFou: LIBRE } as unknown as ContexteValidation);
const PROFIL: ProfilCourse = {
  meilleurEffort: null, effortRecent: { date: '2026-11-04', km: 6, secondes: 2100, equiv10Secondes: 3609 }, sorties90: 11,
  recent: { sorties: 12, km: 80, minutes: 480, plusLongueMinutes: 60, allureMedianeSParKm: 350 },
  semaines: Array.from({ length: 8 }, () => ({ km: 20, minutes: 120, sorties: 3 })), jours: { 1: 3, 3: 2, 5: 2 },
};
const estDur = (type: string) => !/footing|recuperation/.test(type);

for (const cas of [
  { nom: 'une étape B de 10 km', etapes: [c('2026-11-22', 10, { priorite: 'B' })] },
  { nom: 'trois étapes sur des jours qui se suivent', etapes: [c('2026-11-21', 10), c('2026-11-22', 10), c('2026-11-23', 10)] },
  { nom: 'quatre courses le même jour', etapes: [c('2026-11-22', 5, { heure: '09:00' }), c('2026-11-22', 5, { heure: '10:00' }), c('2026-11-22', 10, { heure: '11:30' }), c('2026-11-22', 3, { heure: '15:00' })] },
  { nom: 'deux étapes distinctes', etapes: [c('2026-11-18', 5), c('2026-11-29', 21.1)] },
]) {
  test(`plan avec ${cas.nom} avant la cible : jours de course vides, rien de dur la veille, que du facile pendant la récupération`, () => {
    const blocs = formerBlocs(cas.etapes);
    const competitions = [...cas.etapes, c(COURSE, 10, { priorite: 'A' })].map((x) => ({ date: x.date }));
    const r = planifierCourse({ date: COURSE, km: 10, tempsCibleMinutes: 55, evenements: blocs }, [], ctx(competitions), PROFIL);
    const a = r.operations.filter((o): o is Extract<typeof o, { op: 'ajouter' }> => o.op === 'ajouter');
    assert.ok(a.length > 6, String(a.length));
    for (const b of blocs) {
      const n = joursRecuperation(b.kmTotal);
      for (let j = b.debut; j <= b.fin; j = ajouterJours(j, 1)) assert.ok(a.every((o) => o.proposition.date !== j), `séance un jour de course : ${j}`);
      const veille = a.filter((o) => o.proposition.date === ajouterJours(b.debut, -1));
      assert.ok(veille.every((o) => !estDur(o.proposition.type)), 'rien de dur la veille');
      for (let i = 1; i <= n; i++) {
        const jour = ajouterJours(b.fin, i);
        const dures = a.filter((o) => o.proposition.date === jour && estDur(o.proposition.type));
        assert.equal(dures.length, 0, `séance dure en récupération le ${jour} (${dures.map((o) => o.proposition.type).join(',')})`);
      }
    }
    assert.match(r.message, /Ton calendrier de courses a changé le plan/);
    for (const o of a) assert.ok(o.proposition.date < COURSE);
  });
}
test('plan sans autre course : aucune mention du calendrier, plan identique à avant', () => {
  const r = planifierCourse({ date: COURSE, km: 10, tempsCibleMinutes: 55 }, [], ctx([{ date: COURSE }]), PROFIL);
  const r2 = planifierCourse({ date: COURSE, km: 10, tempsCibleMinutes: 55, evenements: [] }, [], ctx([{ date: COURSE }]), PROFIL);
  assert.deepEqual(r.operations, r2.operations);
  assert.doesNotMatch(r.message, /calendrier de courses/);
});
test('la cible est un bloc de plusieurs jours : le plan s\'arrête la veille du premier jour', () => {
  const analyse = analyserCalendrier([c('2026-12-11', 10), c('2026-12-12', 10, { priorite: 'A' }), c('2026-12-13', 10)], { aujourdhui: AUJ })!;
  assert.equal(analyse.cible.debut, '2026-12-11');
  const r = planifierCourse({ date: analyse.cible.debut, km: 10, tempsCibleMinutes: 55 }, [], ctx([{ date: '2026-12-11' }, { date: '2026-12-12' }, { date: '2026-12-13' }]), PROFIL);
  const dates = r.operations.filter((o) => o.op === 'ajouter').map((o) => (o as { proposition: { date: string } }).proposition.date);
  assert.ok(dates.every((d) => d < '2026-12-11'));
  assert.ok(ecartJours(dates.sort().at(-1)!, '2026-12-11') <= 3);
  void nomDuJour;
});
