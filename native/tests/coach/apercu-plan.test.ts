import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ajouterJours, calendrierApercu, friseApercu, lundiDe, marquesDuPlan, periodesDuPlan } from '../../src/data/coach/apercu-plan.ts';
import { lignesPlanExemple } from '../../src/data/coach/exemple-plan.ts';

const AUJ = '2026-11-06'; // un vendredi
const lignes = lignesPlanExemple(AUJ);

test('dates : décalage en jours et lundi de la semaine, sans dérive (heure d\'été comprise)', () => {
  assert.equal(ajouterJours('2026-11-06', 14), '2026-11-20');
  assert.equal(ajouterJours('2026-03-28', 2), '2026-03-30');
  assert.equal(ajouterJours('2026-10-24', 2), '2026-10-26');
  assert.equal(lundiDe('2026-11-06'), '2026-11-02');
  assert.equal(lundiDe('2026-11-08'), '2026-11-02', 'le dimanche appartient à la semaine qui finit');
  assert.equal(lundiDe('2026-11-09'), '2026-11-09');
});

test('périodes du plan : seulement les périodes déclarées, avec type et dates', () => {
  assert.deepEqual(periodesDuPlan(lignes), [{ type: 'blessure', du: '2026-11-07', au: '2026-11-16' }]);
  assert.deepEqual(periodesDuPlan([{ op: 'supprimer', texte: 'x', de: '2026-11-07', sport: 'velo' }]), []);
  assert.deepEqual(periodesDuPlan([{ op: 'indisponibilite', texte: 'x', type: 'blessure' }]), [], 'une période sans dates ne se dessine pas');
});

test('marques « avant » : toutes les séances touchées, à leur jour d\'origine, toutes « prévues »', () => {
  const m = marquesDuPlan(lignes, 'avant');
  assert.deepEqual([...m.keys()].sort(), ['2026-11-07', '2026-11-08', '2026-11-10', '2026-11-12', '2026-11-14']);
  assert.ok([...m.values()].flat().every((x) => x.etat === 'prevue'));
  assert.deepEqual(m.get('2026-11-08'), [{ sport: 'velo', etat: 'prevue' }]);
});

test('marques « après » : les retirées en pointillé à leur jour, les nouvelles aux jours de reprise', () => {
  const m = marquesDuPlan(lignes, 'apres');
  assert.equal(m.get('2026-11-07')![0].etat, 'retiree');
  assert.deepEqual(m.get('2026-11-18'), [{ sport: 'course', etat: 'nouvelle' }]);
  assert.deepEqual(m.get('2026-11-19'), [{ sport: 'velo', etat: 'nouvelle' }]);
  assert.deepEqual(m.get('2026-11-20'), [{ sport: 'course', etat: 'nouvelle' }]);
  assert.equal([...m.values()].flat().filter((x) => x.etat === 'retiree').length, 5);
  assert.equal([...m.values()].flat().filter((x) => x.etat === 'nouvelle').length, 3);
});

test('un déplacement : retiré de son jour et nouveau au jour d\'arrivée (vue « après »), prévu à l\'origine seulement (vue « avant »)', () => {
  const l = [{ op: 'deplacer' as const, texte: 'x', sport: 'velo', minutes: 90, de: '2026-11-12', vers: '2026-11-16' }];
  assert.deepEqual([...marquesDuPlan(l, 'avant')], [['2026-11-12', [{ sport: 'velo', etat: 'prevue' }]]]);
  assert.deepEqual([...marquesDuPlan(l, 'apres')], [['2026-11-12', [{ sport: 'velo', etat: 'retiree' }]], ['2026-11-16', [{ sport: 'velo', etat: 'nouvelle' }]]]);
});

test('lignes incomplètes (sans sport ou sans jour) : ignorées sans casser', () => {
  assert.equal(marquesDuPlan([{ op: 'supprimer', texte: 'x', de: '2026-11-07' }, { op: 'ajouter', texte: 'y', sport: 'velo' }], 'apres').size, 0);
});

test('calendrier : semaines entières de lundi à dimanche, trois semaines depuis la semaine d\'aujourd\'hui', () => {
  const { entetes, semaines } = calendrierApercu(lignes, 'apres', AUJ);
  assert.deepEqual([...entetes], ['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  assert.equal(semaines.length, 3);
  assert.ok(semaines.every((s) => s.length === 7));
  assert.equal(semaines[0][0].iso, '2026-11-02');
  assert.equal(semaines[2][6].iso, '2026-11-22');
});

test('calendrier : jours passés grisés, aujourd\'hui repéré, période hachurée seulement en vue « après »', () => {
  const apres = calendrierApercu(lignes, 'apres', AUJ).semaines.flat();
  const jour = (iso: string) => apres.find((j) => j.iso === iso)!;
  assert.equal(jour('2026-11-05').passe, true);
  assert.equal(jour('2026-11-06').aujourdhui, true);
  assert.equal(jour('2026-11-06').passe, false);
  assert.equal(jour('2026-11-06').periode, null);
  assert.equal(jour('2026-11-07').periode, 'blessure');
  assert.equal(jour('2026-11-16').periode, 'blessure');
  assert.equal(jour('2026-11-17').periode, null);
  const avant = calendrierApercu(lignes, 'avant', AUJ).semaines.flat();
  assert.ok(avant.every((j) => j.periode === null), 'avant le plan, aucune période');
  assert.equal(avant.find((j) => j.iso === '2026-11-08')!.marques[0].etat, 'prevue');
});

test('calendrier : une quatrième semaine s\'ajoute quand le plan va plus loin, jamais plus de quatre', () => {
  const loin = [{ op: 'ajouter' as const, texte: 'x', sport: 'velo', minutes: 60, vers: '2026-11-25' }];
  assert.equal(calendrierApercu(loin, 'apres', AUJ).semaines.length, 4);
  const tresLoin = [{ op: 'ajouter' as const, texte: 'x', sport: 'velo', minutes: 60, vers: '2027-03-01' }];
  assert.equal(calendrierApercu(tresLoin, 'apres', AUJ).semaines.length, 4);
  assert.equal(calendrierApercu([], 'apres', AUJ).semaines.length, 3);
});

test('frise : 14 jours à partir du premier jour touché, lettres du jour exactes', () => {
  const { jours } = friseApercu(lignes, 'apres', AUJ);
  assert.equal(jours.length, 14);
  assert.equal(jours[0].iso, '2026-11-07');
  assert.equal(jours[13].iso, '2026-11-20');
  assert.deepEqual(jours.slice(0, 3).map((j) => j.lettre), ['S', 'D', 'L']);
  assert.deepEqual(jours.slice(0, 3).map((j) => j.numero), [7, 8, 9]);
  assert.equal(jours[0].periode, 'blessure');
  assert.equal(jours[10].periode, null, 'le 17 : la période est finie');
});

test('frise : une rangée par sport touché (course avant vélo), cases au bon état selon la vue', () => {
  const apres = friseApercu(lignes, 'apres', AUJ).rangees;
  assert.deepEqual(apres.map((r) => r.sport), ['course', 'velo']);
  const etats = (sport: string) => apres.find((r) => r.sport === sport)!.cases.map((c) => c.etat);
  assert.deepEqual(etats('course'), ['retiree', 'vide', 'vide', 'retiree', 'vide', 'vide', 'vide', 'vide', 'vide', 'vide', 'vide', 'nouvelle', 'vide', 'nouvelle']);
  assert.deepEqual(etats('velo'), ['vide', 'retiree', 'vide', 'vide', 'vide', 'retiree', 'vide', 'retiree', 'vide', 'vide', 'vide', 'vide', 'nouvelle', 'vide']);
  const avant = friseApercu(lignes, 'avant', AUJ).rangees;
  assert.ok(avant.flatMap((r) => r.cases).every((c) => c.etat === 'vide' || c.etat === 'prevue'));
  assert.equal(avant.flatMap((r) => r.cases).filter((c) => c.etat === 'prevue').length, 5);
});

test('frise : un plan sans séance (seulement une période) a des jours mais pas de rangée', () => {
  const l = [{ op: 'indisponibilite' as const, texte: 'x', type: 'maladie' as const, du: '2026-11-07', au: '2026-11-09' }];
  const f = friseApercu(l, 'apres', AUJ);
  assert.equal(f.jours.length, 14);
  assert.deepEqual(f.rangees, []);
  assert.equal(f.jours[0].periode, 'maladie');
  assert.equal(friseApercu([], 'apres', AUJ).jours[0].iso, '2026-11-07', 'sans rien : à partir de demain');
});

import { reposDuPlan } from '../../src/data/coach/apercu-plan.ts';

test('repos : un repos posé se voit « après », un repos retiré se voit « avant », jamais les deux', () => {
  const l = [
    { op: 'repos' as const, texte: 'a', vers: '2026-11-09', poser: true },
    { op: 'repos' as const, texte: 'b', vers: '2026-11-10', poser: false },
    { op: 'supprimer' as const, texte: 'c', sport: 'velo', de: '2026-11-11' },
  ];
  assert.deepEqual([...reposDuPlan(l, 'apres')], ['2026-11-09']);
  assert.deepEqual([...reposDuPlan(l, 'avant')], ['2026-11-10']);
  const jours = calendrierApercu(l, 'apres', AUJ).semaines.flat();
  assert.equal(jours.find((j) => j.iso === '2026-11-09')!.repos, true);
  assert.equal(jours.find((j) => j.iso === '2026-11-10')!.repos, false);
  assert.ok(calendrierApercu(l, 'apres', AUJ).semaines.flat().filter((j) => j.repos).length === 1);
});

test('repos : un plan qui ne contient qu\'un repos cadre quand même la frise sur ce jour', () => {
  const f = friseApercu([{ op: 'repos', texte: 'a', vers: '2026-11-12', poser: true }], 'apres', AUJ);
  assert.equal(f.jours[0].iso, '2026-11-12');
  assert.deepEqual(f.rangees, []);
});

import { cartePlanReposExemple, cartePlanSemaineExemple, EXEMPLES, PREFIXE_EXEMPLE } from '../../src/data/coach/exemple-plan.ts';
import { resumePlan } from '../../src/data/coach/libelles.ts';
import { lireCarte } from '../../src/data/coach/flux.ts';

test('cartes d\'essai : trois exemples, tous relus sans perte par le lecteur de cartes, identifiants préfixés', () => {
  assert.equal(EXEMPLES.length, 3);
  for (const fabrique of EXEMPLES) {
    const c = fabrique(AUJ);
    assert.ok(c.id.startsWith(PREFIXE_EXEMPLE));
    const relue = lireCarte(JSON.parse(JSON.stringify(c))) as { lignes: unknown[] };
    assert.ok(relue, c.id);
    assert.equal(relue.lignes.length, c.lignes.length);
  }
});

test('carte de semaine d\'essai : quatre séances à venir, dessinées « nouvelles » dans les deux vues utiles', () => {
  const c = cartePlanSemaineExemple(AUJ);
  assert.equal(resumePlan(c.lignes), '4 séances ajoutées');
  const apres = calendrierApercu(c.lignes, 'apres', AUJ).semaines.flat();
  assert.equal(apres.flatMap((j) => j.marques).filter((m) => m.etat === 'nouvelle').length, 4);
  assert.equal(calendrierApercu(c.lignes, 'avant', AUJ).semaines.flat().flatMap((j) => j.marques).length, 0, 'avant : rien n\'était prévu');
  assert.ok(c.lignes.every((l) => (l.vers ?? '') > AUJ));
});

test('carte de repos d\'essai : un repos posé dans trois jours', () => {
  const c = cartePlanReposExemple(AUJ);
  assert.equal(resumePlan(c.lignes), '1 jour de repos posé');
  assert.equal(c.lignes[0].vers, '2026-11-09');
});
