// Test de la replanification : règles de déplacement, évaluation d'un plan entier, et moteur « contraintes → opérations »
// (aucun réseau, aucune base). Lancer : node --experimental-strip-types --test supabase/tests/edge/planning.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { etiquetteDate, evaluerPlan, MAX_OPERATIONS, proposerReplanification, seancesDepuisResume } from '../../functions/_shared/planning.ts';
import type { Contraintes, Operation, SeancePrevue } from '../../functions/_shared/planning.ts';
import { estSeanceDure, REGLAGES_DEFAUT, validerDeplacement } from '../../functions/_shared/validateur.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours, entre } from '../../functions/_shared/dates-iso.ts';

const AUJ = '2026-11-06'; // un vendredi
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
const FACILE: DecisionGardeFou = { niveau: 'prudence', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'facile' };
const REPOS: DecisionGardeFou = { niveau: 'repos', raisons: [], message: 'Repose-toi.', autoriserModele: true, autoriserCartes: false, intensiteMax: 'facile' };

const id = (n: number) => `00000000-0000-4000-8000-00000000010${n}`;
const S1: SeancePrevue = { id: id(1), date: '2026-11-07', sport: 'course', minutes: 60, tss: 50, creeeParIa: false };
const S2: SeancePrevue = { id: id(2), date: '2026-11-08', sport: 'velo', minutes: 120, tss: 100, creeeParIa: false };
const S3: SeancePrevue = { id: id(3), date: '2026-11-10', sport: 'course', minutes: 45, tss: 80, creeeParIa: false }; // dure : 107 points / heure
const S4: SeancePrevue = { id: id(4), date: '2026-11-12', sport: 'velo', minutes: 90, tss: 80, creeeParIa: false };
const S5: SeancePrevue = { id: id(5), date: '2026-11-14', sport: 'velo', minutes: 180, tss: 150, creeeParIa: false };
const SEANCES = [S1, S2, S3, S4, S5];

function ctx(sur: Partial<ContexteValidation> = {}, seances: SeancePrevue[] = SEANCES): ContexteValidation {
  return {
    aujourdhui: AUJ, ctl: 40, referenceHebdoTss: 400, joursPasses: [], prevues: seances.map((s) => ({ date: s.date, tss: s.tss })),
    indisponibilites: [], joursDeRepos: [], competitions: [], plusLongueMinutes: { velo: 180, course: 90, natation: 45 },
    gardeFou: LIBRE, reglages: { ...REGLAGES_DEFAUT }, ...sur,
  };
}
const par = (ops: Operation[], op: Operation['op']) => ops.filter((o) => o.op === op);
const blessure: Contraintes = { indisponibilite: { type: 'blessure', du: '2026-11-07', au: '2026-11-16' } };

// ---------- Lecture du résumé et libellés ----------
test('seancesDepuisResume : garde les séances avec identifiant valide, ignore le reste, nettoie les valeurs', () => {
  const r = seancesDepuisResume({ prevues: [
    { id: id(1).toUpperCase(), date: '2026-11-07', sport: 'course', minutes: 60, tss: 50, creee_par_ia: true },
    { id: 'pas-un-uuid', date: '2026-11-08', sport: 'velo' },
    { id: id(2), date: '2026-02-31', sport: 'velo' },
    { id: id(3), date: '2026-11-09', sport: 42, minutes: 'beaucoup', tss: NaN },
    null,
  ] });
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { id: id(1), date: '2026-11-07', sport: 'course', minutes: 60, tss: 50, creeeParIa: true });
  assert.deepEqual(r[1], { id: id(3), date: '2026-11-09', sport: null, minutes: null, tss: null, creeeParIa: false });
  assert.deepEqual(seancesDepuisResume(null), []);
  assert.deepEqual(seancesDepuisResume({ prevues: 'x' }), []);
});

test('etiquetteDate : jour de la semaine et jour/mois', () => {
  assert.equal(etiquetteDate('2026-11-06'), 'ven. 06/11');
  assert.equal(etiquetteDate('2026-11-08'), 'dim. 08/11');
  assert.equal(etiquetteDate('nimporte quoi'), 'nimporte quoi');
});

// ---------- Déplacer une séance ----------
test('validerDeplacement : jour libre accepté ; même jour, passé, hors horizon refusés', () => {
  const sans = SEANCES.filter((s) => s.id !== S4.id);
  const c = ctx({}, sans);
  assert.equal(validerDeplacement(S4, '2026-11-16', c).ok, true);
  assert.deepEqual(validerDeplacement(S4, '2026-11-12', c).erreurs.map((e) => e.code), ['meme_jour']);
  assert.ok(validerDeplacement(S4, '2026-11-05', c).erreurs.some((e) => e.code === 'date_passee'));
  assert.ok(validerDeplacement(S4, '2026-11-25', c).erreurs.some((e) => e.code === 'date_trop_loin'));
  assert.ok(validerDeplacement(S4, 'demain', c).erreurs.some((e) => e.code === 'date_invalide'));
});

test('validerDeplacement : indisponibilité, repos posé, compétition, veille de compétition (séance dure)', () => {
  const sans = SEANCES.filter((s) => s.id !== S1.id);
  const c = ctx({ indisponibilites: [{ type: 'blessure', du: '2026-11-17', au: '2026-11-18' }], joursDeRepos: ['2026-11-19'], competitions: [{ date: '2026-11-20' }] }, sans);
  const codes = (jour: string, s = S1) => validerDeplacement(s, jour, c).erreurs.map((e) => e.code);
  assert.ok(codes('2026-11-17').includes('jour_indisponible'));
  assert.ok(codes('2026-11-19').includes('jour_de_repos'));
  assert.ok(codes('2026-11-20').includes('jour_de_competition'));
  // S3 est une séance dure : pas la veille d'une compétition
  assert.ok(validerDeplacement({ ...S3 }, '2026-11-19', ctx({ competitions: [{ date: '2026-11-20' }], joursDeRepos: [] }, SEANCES.filter((s) => s.id !== S3.id))).erreurs.some((e) => e.code === 'veille_competition'));
});

test('validerDeplacement : deux jours durs de suite et semaine trop chargée refusés', () => {
  const sans = SEANCES.filter((s) => s.id !== S4.id);
  // le 11/11 est collé à la séance dure du 10/11 (80 points) : deux jours durs d'affilée
  assert.ok(validerDeplacement(S4, '2026-11-11', ctx({}, sans)).erreurs.some((e) => e.code === 'dures_affilee'));
  // semaine plafonnée : base de 100 points, la séance de 150 points ne passe pas
  assert.ok(validerDeplacement(S5, '2026-11-17', ctx({ referenceHebdoTss: 100 }, SEANCES.filter((s) => s.id !== S5.id))).erreurs.some((e) => e.code.startsWith('hausse_hebdo')));
});

test('validerDeplacement : le garde-fou santé a le dernier mot (repos : rien ; prudence : pas de séance dure)', () => {
  const sans = SEANCES.filter((s) => s.id !== S3.id);
  assert.ok(validerDeplacement(S1, '2026-11-17', ctx({ gardeFou: REPOS }, SEANCES.filter((s) => s.id !== S1.id))).erreurs.some((e) => e.code === 'garde_fou'));
  assert.ok(validerDeplacement(S3, '2026-11-17', ctx({ gardeFou: FACILE }, sans)).erreurs.some((e) => e.code === 'intensite_trop_haute'));
  assert.equal(validerDeplacement(S1, '2026-11-17', ctx({ gardeFou: FACILE }, SEANCES.filter((s) => s.id !== S1.id))).ok, true);
});

test('estSeanceDure : 75 points par heure ou plus ; inconnu = pas dure', () => {
  assert.equal(estSeanceDure(80, 45), true);
  assert.equal(estSeanceDure(50, 60), false);
  assert.equal(estSeanceDure(75, 60), true);
  assert.equal(estSeanceDure(null, 60), false);
  assert.equal(estSeanceDure(80, null), false);
  assert.equal(estSeanceDure(80, 0), false);
});

// ---------- Évaluer un plan entier ----------
test('evaluerPlan : plan vide, trop long, séance inconnue, séance touchée deux fois', () => {
  const c = ctx();
  assert.equal(evaluerPlan([], SEANCES, c).ok, false);
  const trop = Array.from({ length: MAX_OPERATIONS + 1 }, (): Operation => ({ op: 'supprimer', seanceId: S1.id }));
  assert.match(evaluerPlan(trop, SEANCES, c).erreurs[0], /opérations au maximum/);
  assert.match(evaluerPlan([{ op: 'supprimer', seanceId: id(9) }], SEANCES, c).erreurs[0], /n'existe pas/);
  const deux = evaluerPlan([{ op: 'supprimer', seanceId: S1.id }, { op: 'deplacer', seanceId: S1.id, vers: '2026-11-17' }], SEANCES, c);
  assert.equal(deux.ok, false);
  assert.match(deux.erreurs.join(' '), /déjà modifiée/);
});

test('evaluerPlan : supprimer et déplacer valides ; aperçu lisible ; charge avant/après', () => {
  const r = evaluerPlan([{ op: 'supprimer', seanceId: S5.id, raison: 'trop chargé' }, { op: 'deplacer', seanceId: S1.id, vers: '2026-11-09' }], SEANCES, ctx());
  assert.equal(r.ok, true, r.erreurs.join('|'));
  assert.deepEqual(r.lignes.map((l) => l.texte), ['Supprimer : vélo 180 min du sam. 14/11', 'Déplacer : course 60 min du sam. 07/11 → lun. 09/11']);
  assert.equal(r.lignes[0].raison, 'trop chargé');
  assert.equal(r.chargeAvant, 460);
  assert.equal(r.chargeApres, 310);
});

test('evaluerPlan : un déplacement vers un jour déjà occupé passe avec un avertissement', () => {
  const r = evaluerPlan([{ op: 'deplacer', seanceId: S1.id, vers: '2026-11-13' }], SEANCES, ctx());
  assert.equal(r.ok, true, r.erreurs.join('|'));
  assert.equal(r.avertissements.length, 0, 'le 13/11 est libre');
  const r2 = evaluerPlan([{ op: 'deplacer', seanceId: S1.id, vers: '2026-11-10' }], SEANCES, ctx());
  assert.match(r2.avertissements.join(' '), /déjà une séance/);
});

test('evaluerPlan : RÈGLE DURE — déclarer une blessure sans régler les séances de la période est refusé, quel que soit l\'ordre', () => {
  const indispo: Operation = { op: 'indisponibilite', type: 'blessure', du: '2026-11-07', au: '2026-11-16' };
  const seul = evaluerPlan([indispo], SEANCES, ctx());
  assert.equal(seul.ok, false);
  assert.equal(seul.erreurs.length, 5, 'une erreur par séance restante');
  assert.match(seul.erreurs[0], /il reste course 60 min le sam\. 07\/11/);
  // Séances toutes supprimées : le plan passe, que la déclaration soit avant ou après
  const sup: Operation[] = SEANCES.map((s) => ({ op: 'supprimer', seanceId: s.id }));
  assert.equal(evaluerPlan([indispo, ...sup], SEANCES, ctx()).ok, true);
  assert.equal(evaluerPlan([...sup, indispo], SEANCES, ctx()).ok, true);
  // Un déplacement DANS la période déclarée est refusé même si la déclaration vient après
  const mauvais = evaluerPlan([{ op: 'deplacer', seanceId: S1.id, vers: '2026-11-15' }, indispo], SEANCES.filter((s) => s.id === S1.id), ctx({}, [S1]));
  assert.equal(mauvais.ok, false);
});

test('evaluerPlan : bornes des périodes (début, fin, durée, dates) et types inconnus', () => {
  const essai = (op: Partial<Extract<Operation, { op: 'indisponibilite' }>>) =>
    evaluerPlan([{ op: 'indisponibilite', type: 'blessure', du: '2026-11-07', au: '2026-11-09', ...op }, ...SEANCES.map((s): Operation => ({ op: 'supprimer', seanceId: s.id }))], SEANCES, ctx());
  assert.equal(essai({}).ok, true);
  assert.equal(essai({ du: '2026-11-20', au: '2026-11-19' }).ok, false, 'fin avant début');
  assert.equal(essai({ du: '2026-10-01', au: '2026-10-10' }).ok, false, 'début trop loin dans le passé');
  assert.equal(essai({ du: '2026-11-07', au: '2027-02-10' }).ok, false, 'plus de 60 jours');
  assert.equal(essai({ du: '2026-02-31' }).ok, false, 'date impossible');
  assert.equal(essai({ type: 'vacances' as never }).ok, false, 'type inconnu');
  assert.equal(essai({ du: '2026-10-30', au: '2026-11-09' }).ok, true, 'blessé depuis une semaine : accepté');
});

test('evaluerPlan : garde-fou « repos » — supprimer et déclarer une période restent permis, déplacer et ajouter sont refusés', () => {
  const c = ctx({ gardeFou: REPOS });
  assert.equal(evaluerPlan([{ op: 'supprimer', seanceId: S5.id }], SEANCES, c).ok, true);
  assert.equal(evaluerPlan([{ op: 'deplacer', seanceId: S1.id, vers: '2026-11-17' }], SEANCES, c).ok, false);
  assert.equal(evaluerPlan([{ op: 'ajouter', proposition: { date: '2026-11-17', sport: 'course', type: 'footing_facile', minutes: 40 }, justification: 'x' }], SEANCES, c).ok, false);
});

test('evaluerPlan : ajouter est validé APRÈS les suppressions du même plan (le calendrier simulé change)', () => {
  // base de 250 points par semaine : plafond à 275. Semaine du 09/11 au 15/11 : S3 (80) + S4 (80) + S5 (150) = 310 déjà prévus.
  const c = ctx({ referenceHebdoTss: 250 }, SEANCES);
  const ajout: Operation = { op: 'ajouter', proposition: { date: '2026-11-15', sport: 'velo', type: 'endurance', minutes: 120 }, justification: 'Entretien.' };
  const seul = evaluerPlan([ajout], SEANCES, c);
  assert.equal(seul.ok, false);
  assert.match(seul.erreurs.join(' '), /semaine/);
  // en retirant la sortie longue du 14/11 (150 points) dans le même plan : 80 + 80 + 100 = 260, sous le plafond
  const avecSuppression = evaluerPlan([{ op: 'supprimer', seanceId: S5.id }, ajout], SEANCES, c);
  assert.equal(avecSuppression.ok, true, avecSuppression.erreurs.join('|'));
  // l'ordre compte : l'ajout placé AVANT la suppression est vérifié sur l'ancien calendrier et refusé
  assert.equal(evaluerPlan([ajout, { op: 'supprimer', seanceId: S5.id }], SEANCES, c).ok, false);
});

// ---------- Le moteur ----------
test('moteur : blessure de 10 jours — tout est réglé, la reprise est courte et facile, la séance dure devient un footing', () => {
  const ops = proposerReplanification(blessure, SEANCES, ctx());
  const r = evaluerPlan(ops, SEANCES, ctx());
  assert.equal(r.ok, true, r.erreurs.join('|'));
  assert.equal(ops[0].op, 'indisponibilite');
  // plus aucune séance pendant la blessure
  const apres = new Map(SEANCES.map((s) => [s.id, s.date]));
  for (const o of ops) if (o.op === 'supprimer') apres.delete(o.seanceId);
  for (const o of ops) if (o.op === 'deplacer') apres.set(o.seanceId, o.vers);
  const dates = [...apres.values(), ...par(ops, 'ajouter').map((o) => (o as Extract<Operation, { op: 'ajouter' }>).proposition.date)];
  assert.ok(dates.every((d) => !entre(d, '2026-11-07', '2026-11-16')), dates.join(','));
  // reprise : 2 jours après la fin (18/11), jamais avant
  assert.ok(dates.every((d) => d >= '2026-11-18'));
  // chaque ajout est une version courte (50 %) et facile (zone 2) de la séance qu'elle remplace
  const ajouts = par(ops, 'ajouter') as Extract<Operation, { op: 'ajouter' }>[];
  assert.ok(ajouts.length >= 1);
  assert.deepEqual(ajouts.map((a) => `${a.proposition.sport}:${a.proposition.type}:${a.proposition.minutes}`), ['course:footing_facile:30', 'velo:endurance:60', 'course:footing_facile:30']);
  // le moteur ne crée jamais plus de séances qu'il n'en retire
  assert.ok(ajouts.length <= par(ops, 'supprimer').length);
  // celles qui n'ont pas de place sont supprimées avec la raison
  assert.ok(par(ops, 'supprimer').some((o) => /aucun jour libre/.test((o as { raison?: string }).raison ?? '')));
  assert.ok(r.chargeApres < r.chargeAvant);
});

test('moteur : maladie de 2 jours — pas de semaine de reprise, les séances sont déplacées entières vers l\'avant', () => {
  const ops = proposerReplanification({ indisponibilite: { type: 'maladie', du: '2026-11-07', au: '2026-11-08' } }, SEANCES, ctx());
  const r = evaluerPlan(ops, SEANCES, ctx());
  assert.equal(r.ok, true, r.erreurs.join('|'));
  assert.equal(par(ops, 'ajouter').length, 0);
  const dep = par(ops, 'deplacer') as Extract<Operation, { op: 'deplacer' }>[];
  assert.deepEqual(dep.map((d) => d.seanceId), [S1.id, S2.id]);
  assert.ok(dep.every((d) => d.vers > '2026-11-08'), 'jamais avant la fin de la maladie');
  assert.equal(dep[0].vers, '2026-11-09');
});

test('moteur : jours bloqués (voyage) — jamais replacé sur un jour bloqué, ni sur un jour déjà pris', () => {
  const c: Contraintes = { joursBloques: ['2026-11-12', '2026-11-13'] };
  const ops = proposerReplanification(c, SEANCES, ctx());
  assert.equal(ops.length, 1);
  const o = ops[0] as Extract<Operation, { op: 'deplacer' }>;
  assert.equal(o.seanceId, S4.id);
  assert.ok(!c.joursBloques!.includes(o.vers));
  assert.ok(!SEANCES.some((s) => s.id !== S4.id && s.date === o.vers));
  assert.equal(evaluerPlan(ops, SEANCES, ctx()).ok, true);
});

test('moteur : sports exclus — seules les séances de ces sports pendant la période sont touchées', () => {
  const ops = proposerReplanification({ sportsExclus: { sports: ['velo'], du: '2026-11-06', au: '2026-11-12' } }, SEANCES, ctx());
  const ids = ops.map((o) => ('seanceId' in o ? o.seanceId : ''));
  assert.deepEqual(ids, [S2.id, S4.id], 'les deux vélos de la période, pas la course, pas le vélo du 14');
  for (const o of ops as Extract<Operation, { op: 'deplacer' }>[]) assert.ok(o.vers > '2026-11-12', 'après la période d\'exclusion');
  assert.equal(evaluerPlan(ops, SEANCES, ctx()).ok, true);
});

test('moteur : rien de touché = aucune opération', () => {
  assert.deepEqual(proposerReplanification({ joursBloques: ['2026-11-20'] }, SEANCES, ctx()), []);
  assert.deepEqual(proposerReplanification({}, SEANCES, ctx()), []);
});

test('moteur : jours de repos et compétition respectés ; déterministe ; ne modifie pas ses entrées', () => {
  const c = ctx({ joursDeRepos: ['2026-11-16'], competitions: [{ date: '2026-11-17' }] });
  const copie = JSON.stringify(SEANCES);
  const a = proposerReplanification({ joursBloques: ['2026-11-12'] }, SEANCES, c);
  const b = proposerReplanification({ joursBloques: ['2026-11-12'] }, SEANCES, c);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(SEANCES), copie);
  const vers = (a[0] as Extract<Operation, { op: 'deplacer' }>).vers;
  assert.ok(vers !== '2026-11-16' && vers !== '2026-11-17');
  assert.equal(evaluerPlan(a, SEANCES, c).ok, true);
});

test('moteur : garde-fou « prudence » — une séance dure bloquée n\'est pas replacée (supprimée), une facile l\'est', () => {
  const c = ctx({ gardeFou: FACILE });
  const ops = proposerReplanification({ joursBloques: ['2026-11-10', '2026-11-07'] }, SEANCES, c);
  const s3 = ops.find((o) => 'seanceId' in o && o.seanceId === S3.id);
  const s1 = ops.find((o) => 'seanceId' in o && o.seanceId === S1.id);
  assert.equal(s3?.op, 'supprimer');
  assert.equal(s1?.op, 'deplacer');
  assert.equal(evaluerPlan(ops, SEANCES, c).ok, true);
});

test('moteur : sans aucune place dans les 14 jours, la séance est supprimée avec une raison claire', () => {
  const c = ctx({ referenceHebdoTss: 60 });
  const ops = proposerReplanification({ joursBloques: ['2026-11-14'] }, SEANCES, c);
  const o = ops.find((x) => 'seanceId' in x && x.seanceId === S5.id) as Extract<Operation, { op: 'supprimer' }> | undefined;
  assert.equal(o?.op, 'supprimer');
  assert.match(o!.raison!, /aucun jour libre/);
});

test('moteur : toutes les opérations proposées tiennent dans l\'horizon de 14 jours', () => {
  const limite = ajouterJours(AUJ, 14);
  for (const c of [blessure, { joursBloques: ['2026-11-12'] }, { sportsExclus: { sports: ['velo', 'course'], du: '2026-11-06', au: '2026-11-13' } }] as Contraintes[]) {
    for (const o of proposerReplanification(c, SEANCES, ctx())) {
      if (o.op === 'deplacer') assert.ok(o.vers >= AUJ && o.vers <= limite);
      if (o.op === 'ajouter') assert.ok(o.proposition.date >= AUJ && o.proposition.date <= limite);
    }
  }
});

test('evaluerPlan : chaque ligne porte de quoi dessiner le plan (sport, durée, jour d\'origine, jour d\'arrivée, période)', () => {
  const r = evaluerPlan([
    { op: 'indisponibilite', type: 'blessure', du: '2026-11-07', au: '2026-11-16' },
    { op: 'supprimer', seanceId: S1.id },
    { op: 'deplacer', seanceId: S5.id, vers: '2026-11-18' },
    { op: 'ajouter', proposition: { date: '2026-11-19', sport: 'course', type: 'footing_facile', minutes: 30 }, justification: 'Reprise douce.' },
  ], SEANCES, ctx());
  assert.deepEqual(r.lignes.map((l) => ({ op: l.op, sport: l.sport, minutes: l.minutes, de: l.de, vers: l.vers, type: l.type, du: l.du, au: l.au })), [
    { op: 'indisponibilite', sport: undefined, minutes: undefined, de: undefined, vers: undefined, type: 'blessure', du: '2026-11-07', au: '2026-11-16' },
    { op: 'supprimer', sport: 'course', minutes: 60, de: '2026-11-07', vers: undefined, type: undefined, du: undefined, au: undefined },
    { op: 'deplacer', sport: 'velo', minutes: 180, de: '2026-11-14', vers: '2026-11-18', type: undefined, du: undefined, au: undefined },
    { op: 'ajouter', sport: 'course', minutes: 30, de: undefined, vers: '2026-11-19', type: undefined, du: undefined, au: undefined },
  ]);
  // le tout reste du JSON simple (la carte est enregistrée telle quelle dans la conversation)
  assert.deepEqual(JSON.parse(JSON.stringify(r.lignes)), JSON.parse(JSON.stringify(r.lignes)));
});
