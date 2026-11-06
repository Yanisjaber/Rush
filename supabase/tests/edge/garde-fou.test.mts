// Test du garde-fou santé du coach IA (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/garde-fou.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluerGardeFou, SEUILS } from '../../functions/_shared/garde-fou.ts';
import type { DonneesGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours } from '../../functions/_shared/dates-iso.ts';

const D = '2026-11-06';
const vide = (): DonneesGardeFou => ({ date: D, tsb: null, tss7: null, tss7Prec: null, indisponibilites: [], evenements: [], fcRepos: [], hrv: [], fatigue: [] });
/** Une mesure par jour, de `de` jours avant D jusqu'à `a` jours avant D (inclus) */
const serie = (de: number, a: number, valeur: number) => {
  const l: { date: string; valeur: number }[] = [];
  for (let i = de; i >= a; i--) l.push({ date: ajouterJours(D, -i), valeur });
  return l;
};
const fc = (de: number, a: number, bpm: number) => serie(de, a, bpm).map((x) => ({ date: x.date, bpm: x.valeur }));
const hrv = (de: number, a: number, valeur: number) => serie(de, a, valeur);

test('rien à signaler : tout est permis, aucun message', () => {
  const r = evaluerGardeFou(vide());
  assert.deepEqual(r, { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' });
});

test('malade (case cochée aujourd\'hui) : repos, pas de carte, mais le chat reste possible', () => {
  const d = vide();
  d.evenements = [{ date: D, malade: true, blesse: false }];
  const r = evaluerGardeFou(d);
  assert.equal(r.niveau, 'repos');
  assert.deepEqual(r.raisons, ['malade']);
  assert.equal(r.autoriserCartes, false);
  assert.equal(r.autoriserModele, true);
  assert.equal(r.intensiteMax, 'repos');
  assert.match(r.message ?? '', /médecin/);
});

test('malade coché il y a 2 jours compte encore, il y a 3 jours non', () => {
  const a = vide();
  a.evenements = [{ date: ajouterJours(D, -2), malade: true, blesse: false }];
  assert.equal(evaluerGardeFou(a).niveau, 'repos');
  const b = vide();
  b.evenements = [{ date: ajouterJours(D, -3), malade: true, blesse: false }];
  assert.equal(evaluerGardeFou(b).niveau, 'normal');
});

test('une période « maladie » qui couvre aujourd\'hui = repos ; une période terminée ne compte pas', () => {
  const a = vide();
  a.indisponibilites = [{ type: 'maladie', du: ajouterJours(D, -1), au: ajouterJours(D, 2) }];
  assert.equal(evaluerGardeFou(a).niveau, 'repos');
  const b = vide();
  b.indisponibilites = [{ type: 'maladie', du: ajouterJours(D, -9), au: ajouterJours(D, -2) }];
  assert.equal(evaluerGardeFou(b).niveau, 'normal');
});

test('blessé : prudence, séances faciles seulement, cartes permises', () => {
  const d = vide();
  d.evenements = [{ date: D, malade: false, blesse: true }];
  const r = evaluerGardeFou(d);
  assert.equal(r.niveau, 'prudence');
  assert.deepEqual(r.raisons, ['blessure']);
  assert.equal(r.intensiteMax, 'facile');
  assert.equal(r.autoriserCartes, true);
  assert.equal(r.autoriserModele, true);
});

test('une période « blessure » à venir ne déclenche rien aujourd\'hui', () => {
  const d = vide();
  d.indisponibilites = [{ type: 'blessure', du: ajouterJours(D, 1), au: ajouterJours(D, 5) }];
  assert.equal(evaluerGardeFou(d).niveau, 'normal');
});

test('fatigue (TSB) : -29 normal, -30 prudence, -40 repos', () => {
  const avec = (tsb: number) => evaluerGardeFou({ ...vide(), tsb });
  assert.equal(avec(-29).niveau, 'normal');
  assert.equal(avec(SEUILS.tsbPrudence).niveau, 'prudence');
  assert.deepEqual(avec(-35).raisons, ['fatigue_elevee']);
  const r = avec(SEUILS.tsbRepos);
  assert.equal(r.niveau, 'repos');
  assert.deepEqual(r.raisons, ['fatigue_extreme']);
  assert.equal(avec(Number.NaN).niveau, 'normal');
});

test('hausse brutale de la charge : plus de 1,5 fois la semaine d\'avant, si celle-ci pèse au moins 100', () => {
  assert.equal(evaluerGardeFou({ ...vide(), tss7: 160, tss7Prec: 100 }).niveau, 'prudence');
  assert.equal(evaluerGardeFou({ ...vide(), tss7: 150, tss7Prec: 100 }).niveau, 'normal');
  assert.equal(evaluerGardeFou({ ...vide(), tss7: 200, tss7Prec: 80 }).niveau, 'normal', 'une base très faible ne déclenche rien');
});

test('FC de repos : +8 bpm = prudence, +13 = pro et le modèle n\'est pas appelé', () => {
  const base = fc(30, 3, 50);
  const d1 = vide();
  d1.fcRepos = [...base, ...fc(2, 0, 58)];
  const r1 = evaluerGardeFou(d1);
  assert.equal(r1.niveau, 'prudence');
  assert.deepEqual(r1.raisons, ['fc_repos_haute']);
  const d2 = vide();
  d2.fcRepos = [...base, ...fc(2, 0, 63)];
  const r2 = evaluerGardeFou(d2);
  assert.equal(r2.niveau, 'pro');
  assert.equal(r2.autoriserModele, false);
  assert.equal(r2.autoriserCartes, false);
  assert.match(r2.message ?? '', /professionnel de santé/);
});

test('FC de repos : pas assez de mesures (base ou jours récents) ou valeur impossible = on ne conclut rien', () => {
  const peuDeBase = vide();
  peuDeBase.fcRepos = [...fc(30, 26, 50), ...fc(2, 0, 70)]; // 5 mesures de base seulement
  assert.equal(evaluerGardeFou(peuDeBase).niveau, 'normal');
  const unSeulRecent = vide();
  unSeulRecent.fcRepos = [...fc(30, 3, 50), ...fc(0, 0, 70)];
  assert.equal(evaluerGardeFou(unSeulRecent).niveau, 'normal');
  const impossible = vide();
  impossible.fcRepos = [...fc(30, 3, 50), ...fc(2, 0, 200)]; // 200 bpm au repos : mesure ignorée, il ne reste pas assez de jours récents
  assert.equal(evaluerGardeFou(impossible).niveau, 'normal');
});

test('HRV : -33 % = prudence, -53 % = pro', () => {
  const d1 = vide();
  d1.hrv = [...hrv(30, 3, 60), ...hrv(2, 0, 40)];
  assert.equal(evaluerGardeFou(d1).niveau, 'prudence');
  assert.deepEqual(evaluerGardeFou(d1).raisons, ['hrv_basse']);
  const d2 = vide();
  d2.hrv = [...hrv(30, 3, 60), ...hrv(2, 0, 28)];
  const r = evaluerGardeFou(d2);
  assert.equal(r.niveau, 'pro');
  assert.equal(r.autoriserModele, false);
  const sansHrv = evaluerGardeFou(vide());
  assert.equal(sansHrv.niveau, 'normal', 'sans mesure de HRV (cas le plus courant), aucun effet');
});

test('fatigue ressentie : 4 trois jours de suite = prudence ; 5 deux jours de suite = repos ; un trou casse la série', () => {
  const d1 = vide();
  d1.fatigue = serie(2, 0, 4);
  assert.equal(evaluerGardeFou(d1).niveau, 'prudence');
  const d2 = vide();
  d2.fatigue = serie(1, 0, 5);
  assert.equal(evaluerGardeFou(d2).niveau, 'repos');
  const d3 = vide();
  d3.fatigue = serie(1, 0, 4);
  assert.equal(evaluerGardeFou(d3).niveau, 'normal');
  const d4 = vide();
  d4.fatigue = [...serie(2, 2, 4), ...serie(0, 0, 4)]; // il manque hier
  assert.equal(evaluerGardeFou(d4).niveau, 'normal');
});

test('le niveau le plus fort gagne, et toutes les raisons sont gardées', () => {
  const d = vide();
  d.evenements = [{ date: D, malade: true, blesse: true }];
  d.fcRepos = [...fc(30, 3, 50), ...fc(2, 0, 64)];
  const r = evaluerGardeFou(d);
  assert.equal(r.niveau, 'pro');
  assert.deepEqual([...r.raisons].sort(), ['blessure', 'fc_repos_tres_haute', 'malade']);
  assert.equal(r.autoriserModele, false);
});

test('les messages ne contiennent aucune donnée de santé (pas un chiffre) et ne posent aucun diagnostic', () => {
  for (const tsb of [-35, -45]) assert.doesNotMatch(evaluerGardeFou({ ...vide(), tsb }).message ?? '', /\d/);
  const d = vide();
  d.fcRepos = [...fc(30, 3, 50), ...fc(2, 0, 70)];
  const pro = evaluerGardeFou(d);
  assert.doesNotMatch(pro.message ?? '', /\d/);
  assert.doesNotMatch(pro.raisons.join(' '), /\d/);
});
