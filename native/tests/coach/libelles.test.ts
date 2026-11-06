import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descriptionCarte, dureeMinutes, jourCarte, MOT_ETAT, nomSport, nomType, NOM_SPORT_COACH, NOM_TYPE_COACH, sportDeCarte, titreCarte } from '../../src/data/coach/libelles.ts';
import { MENU } from '../../../supabase/functions/_shared/menu-seances.ts';
import type { CarteSeance } from '../../src/data/coach/types.ts';

const carte: CarteSeance = { id: 'c1', etat: 'proposee', proposition: { date: '2026-11-08', sport: 'velo', type: 'endurance', minutes: 90 }, tss_estime: 75, justification: '' };

test('parité avec le menu du serveur : mêmes sports, mêmes types, mêmes noms', () => {
  assert.deepEqual(Object.keys(NOM_SPORT_COACH).sort(), Object.keys(MENU).sort());
  for (const [sport, types] of Object.entries(MENU)) {
    assert.deepEqual(Object.keys(NOM_TYPE_COACH[sport]).sort(), types.map((t) => t.cle).sort(), `types de ${sport}`);
    for (const t of types) assert.equal(NOM_TYPE_COACH[sport][t.cle], t.nom, `${sport}/${t.cle}`);
  }
});

test('durées en clair', () => {
  assert.equal(dureeMinutes(45), '45 min');
  assert.equal(dureeMinutes(60), '1 h');
  assert.equal(dureeMinutes(90), '1 h 30');
  assert.equal(dureeMinutes(125), '2 h 05');
  assert.equal(dureeMinutes(-5), '0 min');
});

test('jours en clair (sans décalage de fuseau)', () => {
  assert.equal(jourCarte('2026-11-08'), 'dim. 8 nov.');
  assert.equal(jourCarte('2026-11-06'), 'ven. 6 nov.');
  assert.equal(jourCarte('2027-01-01'), 'ven. 1 janv.');
  assert.equal(jourCarte('pas une date'), 'pas une date');
});

test('noms : un type inconnu devient un texte lisible, jamais un plantage ni une propriété héritée', () => {
  assert.equal(nomType('velo', 'endurance'), 'Endurance');
  assert.equal(nomType('velo', 'type_inconnu'), 'type inconnu');
  assert.equal(nomType('__proto__', 'x'), 'x');
  assert.equal(nomType('velo', 'constructor'), 'constructor');
  assert.equal(nomSport('course'), 'Course');
  assert.equal(nomSport('__proto__'), 'Séance');
  assert.equal(sportDeCarte({ ...carte, proposition: { ...carte.proposition, sport: 'ski' } }), 'autre');
  assert.equal(sportDeCarte(carte), 'velo');
});

test('titre et description d\'une carte : chaque état se dit avec un mot', () => {
  assert.equal(titreCarte(carte), 'Endurance · 1 h 30');
  assert.equal(descriptionCarte(carte), 'Séance proposée, Vélo, Endurance, 1 h 30, dim. 8 nov., charge estimée 75 points. Proposée.');
  for (const etat of ['proposee', 'en_cours', 'ajoutee', 'refusee', 'annulee'] as const) assert.ok(MOT_ETAT[etat].length > 3);
});
