// Test du planificateur de semaine : « fais-moi ma semaine » (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/semaine.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { habitudesDepuisResume, planifierSemaine, SEANCES_TOTAL_MAX } from '../../functions/_shared/semaine.ts';
import type { DemandeSemaine, Habitude } from '../../functions/_shared/semaine.ts';
import { evaluerPlan } from '../../functions/_shared/planning.ts';
import type { Operation, SeancePrevue } from '../../functions/_shared/planning.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours, ecartJours, entre, nomDuJour } from '../../functions/_shared/dates-iso.ts';
import { tssEstime, typeSeance } from '../../functions/_shared/menu-seances.ts';

const AUJ = '2026-11-06'; // un vendredi
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
const FACILE_ONLY: DecisionGardeFou = { niveau: 'prudence', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'facile' };
const REPOS: DecisionGardeFou = { niveau: 'repos', raisons: [], message: 'Repose-toi.', autoriserModele: true, autoriserCartes: false, intensiteMax: 'facile' };

function ctx(sur: Partial<ContexteValidation> = {}): ContexteValidation {
  return {
    aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [],
    gardeFou: LIBRE, ...sur,
  };
}
const HAB: Record<'velo' | 'course' | 'natation', Habitude> = {
  velo: { moyenneMinutes: 90, plusLongueMinutes: 180 },
  course: { moyenneMinutes: 50, plusLongueMinutes: 90 },
  natation: { moyenneMinutes: null, plusLongueMinutes: null },
};
const plan = (d: DemandeSemaine, c = ctx(), seances: SeancePrevue[] = [], h = HAB) => planifierSemaine(d, seances, c, h);
const ajouts = (ops: Operation[]) => ops.map((o) => (o as Extract<Operation, { op: 'ajouter' }>).proposition);
const VC: DemandeSemaine = { sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 2 }] };

test('habitudes : durée moyenne et plus longue séance lues dans le résumé, null sans historique', () => {
  const h = habitudesDepuisResume({ volume_par_sport: { velo: { seances_28_jours: 4, minutes_28_jours: 360, plus_longue_minutes_28_jours: 150 }, course: { seances_28_jours: 0, minutes_28_jours: 0 } } });
  assert.deepEqual(h.velo, { moyenneMinutes: 90, plusLongueMinutes: 150 });
  assert.deepEqual(h.course, { moyenneMinutes: null, plusLongueMinutes: null });
  assert.deepEqual(h.natation, { moyenneMinutes: null, plusLongueMinutes: null });
  assert.deepEqual(habitudesDepuisResume(null).velo, { moyenneMinutes: null, plusLongueMinutes: null });
  assert.deepEqual(habitudesDepuisResume({ volume_par_sport: 'x' }).course, { moyenneMinutes: null, plusLongueMinutes: null });
});

test('une semaine vélo + course : ne fait QU\'ajouter, le plan passe la vérification complète, aucune erreur', () => {
  const r = plan(VC);
  assert.ok(r.operations.length >= 3);
  assert.ok(r.operations.every((o) => o.op === 'ajouter'));
  const ev = evaluerPlan(r.operations, [], ctx());
  assert.equal(ev.ok, true, ev.erreurs.join('|'));
  assert.equal(r.abandons.length, 0);
});

test('jours : dans la fenêtre (demain, 7 jours), tous différents, bien espacés, jamais plus de séances que demandé', () => {
  const p = ajouts(plan(VC).operations);
  const dates = p.map((x) => x.date);
  assert.equal(new Set(dates).size, dates.length);
  assert.ok(dates.every((d) => entre(d, '2026-11-07', '2026-11-13')));
  assert.ok(p.length <= 4);
  assert.equal(p.filter((x) => x.sport === 'velo').length, 2);
  assert.equal(p.filter((x) => x.sport === 'course').length, 2);
  // espacés : jamais deux jours de suite avec 4 séances sur 7 jours
  const tries = [...dates].sort();
  for (let i = 1; i < tries.length; i++) assert.ok(ecartJours(tries[i - 1], tries[i]) >= 2, tries.join(','));
});

test('au moins un jour de repos par semaine : jamais sept séances en sept jours, et on le dit', () => {
  const r = plan({ sports: [{ sport: 'velo', seances: 4 }, { sport: 'course', seances: 4 }] });
  const p = ajouts(r.operations);
  assert.ok(p.length <= 6, `${p.length} séances`);
  assert.match(r.abandons.join(' '), /au moins 1 jour de repos/);
  const jours = new Set(p.map((x) => x.date));
  assert.ok(jours.size <= 6);
});

test('jours interdits : jours libres demandés, repos posé, compétition, indisponibilité et jours déjà occupés ne reçoivent jamais de séance', () => {
  const occupee: SeancePrevue = { id: '00000000-0000-4000-8000-000000000301', date: '2026-11-09', sport: 'course', minutes: 40, tss: 35, creeeParIa: false };
  const c = ctx({
    joursDeRepos: ['2026-11-08'],
    competitions: [{ date: '2026-11-13' }],
    indisponibilites: [{ type: 'maladie', du: '2026-11-10', au: '2026-11-10' }],
    prevues: [{ date: occupee.date, tss: occupee.tss }],
  });
  const r = plan({ ...VC, joursLibres: ['2026-11-11'] }, c, [occupee]);
  const interdits = ['2026-11-11', '2026-11-08', '2026-11-13', '2026-11-10', '2026-11-09'];
  for (const p of ajouts(r.operations)) assert.ok(!interdits.includes(p.date), `${p.date} est interdit`);
  assert.equal(evaluerPlan(r.operations, [occupee], c).ok, true);
});

test('sorties longues : seulement si l\'historique les permet, et placées le week-end quand un week-end est choisi', () => {
  const p = ajouts(plan(VC).operations);
  const longues = p.filter((x) => x.type === 'sortie_longue');
  assert.ok(longues.length >= 1);
  // le week-end des 7 et 8 nov. est dans la fenêtre : la première sortie longue s'y trouve
  const weekend = p.filter((x) => ['samedi', 'dimanche'].includes(nomDuJour(x.date)));
  assert.ok(weekend.some((x) => x.type === 'sortie_longue'), JSON.stringify(p));
  // sans historique de longue séance : jamais de sortie longue
  const sans = plan(VC, ctx(), [], { ...HAB, velo: { moyenneMinutes: 60, plusLongueMinutes: 70 }, course: { moyenneMinutes: 40, plusLongueMinutes: 45 } });
  assert.ok(ajouts(sans.operations).every((x) => x.type !== 'sortie_longue'));
});

test('qualité : une séance de tempo seulement avec 3 séances d\'un sport ET une forme de fond suffisante (CTL ≥ 30)', () => {
  const trois = plan({ sports: [{ sport: 'course', seances: 3 }] });
  assert.equal(ajouts(trois.operations).filter((x) => x.type === 'tempo').length, 1);
  const deux = plan({ sports: [{ sport: 'course', seances: 2 }] });
  assert.equal(ajouts(deux.operations).filter((x) => x.type === 'tempo').length, 0);
  const faible = plan({ sports: [{ sport: 'course', seances: 3 }] }, ctx({ ctl: 20 }));
  assert.equal(ajouts(faible.operations).filter((x) => x.type === 'tempo').length, 0);
  const inconnu = plan({ sports: [{ sport: 'course', seances: 3 }] }, ctx({ ctl: null }));
  assert.equal(ajouts(inconnu.operations).filter((x) => x.type === 'tempo').length, 0);
});

test('intensité « facile » : que des séances faciles, jamais de longue ni de qualité', () => {
  const p = ajouts(plan({ sports: [{ sport: 'velo', seances: 3 }, { sport: 'course', seances: 2 }], intensite: 'facile' }).operations);
  assert.ok(p.length >= 4);
  assert.ok(p.every((x) => ['endurance', 'footing_facile'].includes(x.type)), JSON.stringify(p));
});

test('garde-fou « prudence » : seulement du facile ; garde-fou « repos » : aucune séance, avec la raison', () => {
  const prudence = plan({ sports: [{ sport: 'course', seances: 3 }] }, ctx({ gardeFou: FACILE_ONLY }));
  assert.ok(ajouts(prudence.operations).length >= 2);
  assert.ok(ajouts(prudence.operations).every((x) => x.type === 'footing_facile'), 'ni qualité ni sortie longue');
  const repos = plan(VC, ctx({ gardeFou: REPOS }));
  assert.deepEqual(repos.operations, []);
  assert.ok(repos.abandons.length >= 1);
  assert.match(repos.abandons.join(' '), /Repose-toi/);
});

test('durées : d\'après l\'habitude de l\'utilisateur, en minutes entières, sans plage imposée ; défaut raisonnable sans historique', () => {
  const p = ajouts(plan(VC).operations);
  assert.ok(p.every((x) => Number.isInteger(x.minutes) && x.minutes >= 1));
  const facileVelo = p.find((x) => x.sport === 'velo' && x.type === 'endurance');
  assert.equal(facileVelo?.minutes, 90, 'sa moyenne');
  const nat = ajouts(plan({ sports: [{ sport: 'natation', seances: 2 }] }).operations);
  assert.ok(nat.length === 2 && nat.every((x) => x.minutes > 0), 'défaut natation sans historique');
});

test('plus de limite de charge : trois séances de vélo sont toutes placées, sans abandon', () => {
  const c = ctx();
  const r = plan({ sports: [{ sport: 'velo', seances: 3 }] }, c);
  assert.equal(r.abandons.length, 0);
  assert.equal(ajouts(r.operations).length, 3);
  assert.equal(evaluerPlan(r.operations, [], c).ok, true);
});

test('la veille d\'une compétition : jamais de qualité ni de sortie longue', () => {
  const c = ctx({ competitions: [{ date: '2026-11-14' }] });
  const p = ajouts(plan(VC, c).operations);
  const veille = p.find((x) => x.date === '2026-11-13');
  if (veille) assert.ok(['endurance', 'footing_facile'].includes(veille.type));
  assert.ok(p.every((x) => x.date !== '2026-11-14'));
});

test('fenêtre : demain par défaut, un début donné est respecté, un début passé retombe sur demain, un début lointain est accepté, une date absurde refusée', () => {
  assert.ok(ajouts(plan({ sports: [{ sport: 'course', seances: 2 }] }).operations).every((x) => x.date >= '2026-11-07'));
  const dec = ajouts(plan({ sports: [{ sport: 'course', seances: 2 }], debut: '2026-11-10', jours: 5 }).operations);
  assert.ok(dec.every((x) => entre(x.date, '2026-11-10', '2026-11-14')));
  const passe = ajouts(plan({ sports: [{ sport: 'course', seances: 2 }], debut: '2026-10-01' }).operations);
  assert.ok(passe.every((x) => x.date >= '2026-11-07'));
  const loin = ajouts(plan({ sports: [{ sport: 'course', seances: 2 }], debut: '2026-12-25' }).operations);
  assert.ok(loin.length === 2 && loin.every((x) => x.date >= '2026-12-25'), 'plus d\'horizon de 14 jours');
  assert.deepEqual(plan({ sports: [{ sport: 'course', seances: 2 }], debut: '2032-01-01' }).operations, []);
});

test('deux semaines : au moins deux jours de repos, séances sur les deux semaines', () => {
  const r = plan({ sports: [{ sport: 'velo', seances: 3 }, { sport: 'course', seances: 3 }], jours: 14 });
  const p = ajouts(r.operations);
  assert.ok(p.length >= 6);
  assert.ok(p.some((x) => x.date <= '2026-11-13') && p.some((x) => x.date >= '2026-11-14'));
  assert.equal(evaluerPlan(r.operations, [], ctx()).ok, true);
});

test('rien de libre : message clair, aucune opération', () => {
  const c = ctx({ indisponibilites: [{ type: 'maladie', du: '2026-11-06', au: '2026-11-30' }] });
  const r = plan(VC, c);
  assert.deepEqual(r.operations, []);
  assert.match(r.abandons[0], /Aucun jour libre/);
});

test('limites : 10 séances au plus, sport à zéro séance ignoré, déterministe, entrées intactes', () => {
  const grosse: DemandeSemaine = { sports: [{ sport: 'velo', seances: 6 }, { sport: 'course', seances: 6 }, { sport: 'natation', seances: 6 }] };
  assert.ok(ajouts(plan(grosse).operations).length <= SEANCES_TOTAL_MAX);
  assert.deepEqual(plan({ sports: [{ sport: 'velo', seances: 0 }] }).operations, []);
  const entree = JSON.stringify(VC);
  const a = plan(VC);
  const b = plan(VC);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(VC), entree);
});

test('les justifications sont écrites par le code (jamais par le modèle), courtes et en français', () => {
  const ops = plan(VC).operations as Extract<Operation, { op: 'ajouter' }>[];
  assert.ok(ops.every((o) => o.justification.length > 10 && o.justification.length <= 200));
  assert.ok(new Set(ops.map((o) => o.justification)).size >= 2);
});

test('ajouter la semaine à un calendrier déjà chargé : le plan reste valide', () => {
  const deja: SeancePrevue[] = [
    { id: '00000000-0000-4000-8000-000000000401', date: '2026-11-09', sport: 'velo', minutes: 180, tss: 150, creeeParIa: false },
    { id: '00000000-0000-4000-8000-000000000402', date: '2026-11-11', sport: 'course', minutes: 90, tss: 90, creeeParIa: false },
  ];
  const c = ctx({ prevues: deja.map((s) => ({ date: s.date, tss: s.tss })) });
  const r = plan(VC, c, deja);
  const ev = evaluerPlan(r.operations, deja, c);
  assert.equal(ev.ok, true, ev.erreurs.join('|'));
  assert.ok(ajouts(r.operations).length >= 1);
});

test('après une grosse semaine passée : les séances sont quand même placées, sur des jours différents', () => {
  const passes = [0, 1, 2, 3, 4, 5].map((n) => ({ date: ajouterJours(AUJ, -n), tss: 70 }));
  const c = ctx({ joursPasses: passes });
  const r = plan({ sports: [{ sport: 'course', seances: 3 }], intensite: 'facile' }, c);
  const p = ajouts(r.operations);
  assert.equal(p.length, 3, `${p.length} séances placées, abandons : ${r.abandons.join(' | ')}`);
  assert.equal(new Set(p.map((x) => x.date)).size, 3);
  assert.equal(evaluerPlan(r.operations, [], c).ok, true);
});

test('quand AUCUN jour ne convient (repos partout), la séance est abandonnée avec la raison', () => {
  const jours = Array.from({ length: 70 }, (_, n) => ajouterJours(AUJ, n));
  const c = ctx({ joursDeRepos: jours });
  const r = plan({ sports: [{ sport: 'velo', seances: 2 }] }, c);
  assert.deepEqual(ajouts(r.operations), []);
  assert.ok(r.abandons.length >= 1);
});
