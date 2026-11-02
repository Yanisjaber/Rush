import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NiveauGlobal, NiveauGlobalAnnee, NotesPiliers } from '../../src/data/bilan/piliers-niveau.ts';
import { recitNiveau } from '../../src/data/bilan/recit-niveau.ts';

const annee = (an: number, global: number, piliers: Partial<NotesPiliers> = {}): NiveauGlobalAnnee => ({
  an, global, nbPiliers: 5, piliers: { puissance: null, endurance: null, durabilite: null, repetabilite: null, charge: null, ...piliers },
});
/** Un niveau global à partir des années (actuel = la dernière, meilleur = le plus haut score, fort et faible donnés). */
const niveau = (annees: NiveauGlobalAnnee[], fort: NiveauGlobal['fort'], faible: NiveauGlobal['faible']): NiveauGlobal => ({
  annees,
  actuel: annees[annees.length - 1],
  precedent: annees.length > 1 ? annees[annees.length - 2] : null,
  meilleur: annees.reduce((m, a) => (a.global! > m.global! ? a : m)),
  fort,
  faible,
});

// Le compte de test (Sami), 2016 à 2026
const SCORES = [60, 47, 57, 54, 53, 52, 51, 58, 69, 77, 80];
const SAMI = niveau(
  SCORES.map((s, i) => {
    if (i === 9) return annee(2025, s, { puissance: 86, endurance: 69, durabilite: 54, repetabilite: 79, charge: 97 });
    if (i === 10) return annee(2026, s, { puissance: 86, endurance: 69, durabilite: 65, repetabilite: 79, charge: 100 });
    return annee(2016 + i, s);
  }),
  'charge',
  'durabilite',
);

test('recitNiveau : la phrase dit l\'écart avec l\'an dernier et avec le creux', () => {
  assert.equal(recitNiveau(SAMI).phrase, '3 points de plus qu\'en 2025, et 33 de plus qu\'au creux de 2017.');
});

test('recitNiveau : creux, reprise et record sur la courbe, dans l\'ordre des années', () => {
  const r = recitNiveau(SAMI).reperes;
  assert.deepEqual(r.map((x) => [x.an, x.titre, x.detail, x.dessus]), [
    [2017, 'Creux', '47 en 2017', false],
    [2022, 'Reprise', '51 en 2022', false],
    [2026, 'Record', '80', true],
  ]);
});

test('recitNiveau : le point fort, puis la plus grosse hausse fusionnée avec le point faible quand c\'est le même pilier', () => {
  assert.deepEqual(recitNiveau(SAMI).lignes, [
    { valeur: '100', gras: 'Capacité de charge', texte: 'tu encaisses beaucoup d’entraînement : c’est ce qui porte ton score.' },
    { valeur: '+11', gras: 'Durabilité', texte: 'ta plus grosse hausse depuis 2025, mais encore ton pilier le plus bas (65) : à travailler.' },
  ]);
});

test('recitNiveau : trois lignes quand la plus grosse hausse et le point faible sont deux piliers différents', () => {
  const g = { ...SAMI, faible: 'endurance' as const };
  assert.deepEqual(recitNiveau(g).lignes.map((l) => [l.valeur, l.gras]), [['100', 'Capacité de charge'], ['+11', 'Durabilité'], ['69', 'Endurance']]);
  assert.equal(recitNiveau(g).lignes[2].texte, 'c’est ce qui te tire vers le bas : à travailler.');
});

test('recitNiveau : une année en baisse, sous le meilleur', () => {
  const g = niveau([annee(2023, 70, { puissance: 80, charge: 60 }), annee(2024, 82, { puissance: 90, charge: 74 }), annee(2025, 75, { puissance: 85, charge: 65 })], 'puissance', 'charge');
  const r = recitNiveau(g);
  assert.equal(r.phrase, '7 points de moins qu\'en 2024, et 5 de plus qu\'au creux de 2023. Ton meilleur : 82 en 2024.');
  // Le record (2024) et l'année actuelle (2025) sont à un an : on garde le record ; le creux (2023) est aussi trop près du record
  assert.deepEqual(r.reperes.map((x) => x.titre), ['Record']);
  assert.equal(r.lignes[1].valeur, '−9');
  // La charge baisse le plus et c'est aussi le point faible : une seule ligne
  assert.equal(r.lignes[1].texte, 'ta plus grosse baisse depuis 2024, mais encore ton pilier le plus bas (65) : à travailler.');
  assert.equal(r.lignes.length, 2);
});

test('recitNiveau : une seule année', () => {
  const r = recitNiveau(niveau([annee(2026, 64, { puissance: 64, charge: 64 })], 'puissance', 'puissance'));
  assert.equal(r.phrase, 'Ta première année mesurée : 64 sur 100.');
  assert.deepEqual(r.reperes, []);
  assert.equal(r.lignes.length, 1); // pas d'écart sans année d'avant, pas de point faible distinct du point fort
});

test('recitNiveau : le même score que l\'an dernier, creux trop proche pour être cité', () => {
  const r = recitNiveau(niveau([annee(2024, 60), annee(2025, 62), annee(2026, 62)], 'puissance', 'charge'));
  assert.ok(r.phrase.startsWith('Le même score qu\'en 2025.'), r.phrase);
});
