// Test du validateur de séances et du menu du coach IA (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/validateur.test.mts
//
// Yanis a supprimé : les 4 réglages, la limite de hausse de charge, l'horizon de 14 jours, les bornes de durée.
// Ce fichier vérifie ce qui reste ET que ces règles n'existent plus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HORIZON_TECHNIQUE_JOURS, seuilJourDur, validerSeance } from '../../functions/_shared/validateur.ts';
import * as validateur from '../../functions/_shared/validateur.ts';
import type { ContexteValidation, Proposition } from '../../functions/_shared/validateur.ts';
import { clesDuMenu, MENU, MINUTES_MAX_TECHNIQUE, tssEstime, typeSeance } from '../../functions/_shared/menu-seances.ts';
import * as menu from '../../functions/_shared/menu-seances.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours, dateValide, ecartJours } from '../../functions/_shared/dates-iso.ts';

const AUJ = '2026-11-06';
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };

function ctx(sur: Partial<ContexteValidation> = {}): ContexteValidation {
  return { aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE, ...sur };
}
const velo = (date: string, type: string, minutes: number): Proposition => ({ date, sport: 'velo', type, minutes });
const codes = (r: { erreurs: { code: string }[] }) => r.erreurs.map((e) => e.code);
const jour = (n: number, tss: number) => ({ date: ajouterJours(AUJ, n), tss });

// ---------- menu ----------
test('menu : zone et charge cohérentes, clés uniques, plus de bornes de durée', () => {
  for (const [sport, types] of Object.entries(MENU)) {
    const cles = types.map((t) => t.cle);
    assert.equal(new Set(cles).size, cles.length, `clés en double en ${sport}`);
    for (const t of types) {
      assert.ok(t.tssParHeure > 0);
      assert.equal('minMinutes' in t || 'maxMinutes' in t, false);
    }
  }
  assert.equal('PLAFOND_MINUTES' in menu, false);
});
test('menu : clé inconnue ou sport hors liste = rien', () => {
  assert.equal(typeSeance('velo', 'endurance')?.nom, 'Endurance');
  for (const [s, k] of [['velo', 'inconnu'], ['muscu', 'endurance'], ['velo', '__proto__'], ['__proto__', 'endurance'], ['velo', 12], [null, null]] as const) {
    assert.equal(typeSeance(s, k), null);
  }
  assert.ok(clesDuMenu('natation').includes('endurance'));
});
test('charge estimée : 1 h 30 d\'endurance à vélo', () => {
  assert.equal(tssEstime(typeSeance('velo', 'endurance')!, 90), 75);
});

// ---------- dates ----------
test('dates : jours ajoutés, écart et validité', () => {
  assert.equal(ajouterJours('2026-12-30', 3), '2027-01-02');
  assert.equal(ecartJours('2026-11-06', '2026-11-20'), 14);
  assert.equal(dateValide('2026-02-30'), false);
  assert.equal(dateValide('2026-11-06'), true);
  assert.equal(dateValide(20261106), false);
});

// ---------- une séance ----------
test('une séance normale est acceptée', () => {
  const r = validerSeance(velo('2026-11-08', 'endurance', 90), ctx());
  assert.equal(r.ok, true);
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.tssEstime, 75);
});
test('proposition mal formée : refusée', () => {
  assert.deepEqual(codes(validerSeance({ date: '2026-02-30', sport: 'velo', type: 'endurance', minutes: 60 }, ctx())), ['date_invalide']);
  assert.deepEqual(codes(validerSeance({ date: '2026-11-08', sport: 'muscu', type: 'endurance', minutes: 60 }, ctx())), ['sport_inconnu']);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'marathon', 60), ctx())), ['type_inconnu']);
  for (const minutes of [0, -30, Number.NaN, Infinity, 67.5, MINUTES_MAX_TECHNIQUE + 1, '90' as unknown as number]) {
    assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', minutes), ctx())), ['minutes_invalides'], String(minutes));
  }
  assert.equal(validerSeance(null as unknown as Proposition, ctx()).ok, false);
});

// ---------- règles supprimées ----------
test('durée libre : 15, 67, 421 min passent partout', () => {
  for (const minutes of [1, 15, 67, 133, 421, MINUTES_MAX_TECHNIQUE]) {
    for (const [sport, types] of Object.entries(MENU)) {
      for (const t of types) {
        const r = validerSeance({ date: '2026-11-08', sport, type: t.cle, minutes }, ctx());
        assert.equal(r.ok, true, `${sport}/${t.cle} ${minutes} min : ${codes(r).join(',')}`);
      }
    }
  }
});
test('plus d\'horizon de 14 jours ; seule une date absurde est refusée', () => {
  for (const n of [15, 30, 200, 365, 400]) assert.equal(validerSeance(velo(ajouterJours(AUJ, n), 'endurance', 60), ctx()).ok, true, `+${n}`);
  assert.deepEqual(codes(validerSeance(velo(ajouterJours(AUJ, HORIZON_TECHNIQUE_JOURS + 1), 'endurance', 60), ctx())), ['date_absurde']);
});
test('plus de limite de charge, de jours durs d\'affilée ni de repos exigé', () => {
  const lourd = Array.from({ length: 19 }, (_, i) => jour(1 + (i % 7), 150));
  assert.equal(validerSeance(velo(ajouterJours(AUJ, 3), 'endurance', 180), ctx({ prevues: lourd })).ok, true);
  assert.equal(validerSeance(velo(ajouterJours(AUJ, 2), 'seuil', 60), ctx({ prevues: [jour(1, 100), jour(3, 100)] })).ok, true);
  assert.equal(validerSeance(velo(ajouterJours(AUJ, 7), 'recuperation', 30), ctx({ prevues: [1, 2, 3, 4, 5, 6].map((n) => jour(n, 20)) })).ok, true);
});
test('les réglages n\'existent plus dans le code', () => {
  for (const nom of ['REGLAGES_DEFAUT', 'normaliserReglages', 'PLAFONDS']) assert.equal(nom in validateur, false, nom);
});

// ---------- ce qui reste ----------
test('jour passé refusé, aujourd\'hui permis', () => {
  assert.deepEqual(codes(validerSeance(velo('2026-11-05', 'endurance', 60), ctx())), ['date_passee']);
  assert.equal(validerSeance(velo(AUJ, 'endurance', 60), ctx()).ok, true);
});
test('jour indisponible = refus, le lendemain est libre', () => {
  for (const type of ['maladie', 'blessure', 'indisponible'] as const) {
    const c = ctx({ indisponibilites: [{ type, du: '2026-11-07', au: '2026-11-09' }] });
    assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'recuperation', 40), c)), ['jour_indisponible'], type);
    assert.equal(validerSeance(velo('2026-11-10', 'recuperation', 40), c).ok, true);
  }
});
test('jour de repos et jour de compétition : refus', () => {
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ joursDeRepos: ['2026-11-08'] }))), ['jour_de_repos']);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ competitions: [{ date: '2026-11-08' }] }))), ['jour_de_competition']);
});
test('garde-fou : repos = aucune séance ; prudence = zones 1-2', () => {
  const repos: DecisionGardeFou = { niveau: 'repos', raisons: ['malade'], message: 'Aujourd\'hui, c\'est repos.', autoriserModele: true, autoriserCartes: false, intensiteMax: 'repos' };
  const r = validerSeance(velo('2026-11-08', 'recuperation', 40), ctx({ gardeFou: repos }));
  assert.deepEqual(codes(r), ['garde_fou']);
  assert.equal(r.erreurs[0].message, 'Aujourd\'hui, c\'est repos.');
  const prudence: DecisionGardeFou = { niveau: 'prudence', raisons: ['blessure'], message: 'Doucement.', autoriserModele: true, autoriserCartes: true, intensiteMax: 'facile' };
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'seuil', 45), ctx({ gardeFou: prudence }))), ['intensite_trop_haute']);
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ gardeFou: prudence })).ok, true);
});
test('seuil de jour dur', () => {
  assert.equal(seuilJourDur(null), 60);
  assert.equal(seuilJourDur(40), 64);
});
test('veille de compétition : rien de dur', () => {
  const c = ctx({ competitions: [{ date: '2026-11-09' }] });
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'vo2max', 45), c)), ['veille_competition']);
  assert.equal(validerSeance(velo('2026-11-08', 'recuperation', 40), c).ok, true);
});
test('séance déjà prévue ce jour-là : avertissement seulement', () => {
  const r = validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ prevues: [{ date: '2026-11-08', tss: 40 }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.avertissements.map((a) => a.code), ['deja_une_seance']);
});
