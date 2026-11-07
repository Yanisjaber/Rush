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

// ---------- Les mots d'une carte de planning ----------
import { descriptionPlan, MOT_ETAT_PLAN, nombreChangements, nomPeriode, phraseAnnulation, resumePlan } from '../../src/data/coach/libelles.ts';
import { cartePlanExemple, lignesPlanExemple } from '../../src/data/coach/exemple-plan.ts';

test('plan : chaque état se dit avec un mot, jamais la couleur seule', () => {
  assert.deepEqual(Object.keys(MOT_ETAT_PLAN).sort(), ['ajoutee', 'annulee', 'en_cours', 'proposee', 'refusee']);
  for (const mot of Object.values(MOT_ETAT_PLAN)) assert.ok(mot.length > 5);
});

test('plan : le résumé d\'une ligne — blessure, séances remplacées, séances retirées', () => {
  assert.equal(resumePlan(lignesPlanExemple('2026-11-06')), '1 blessure · 3 séances remplacées · 2 retirées');
  assert.equal(nombreChangements(lignesPlanExemple('2026-11-06')), '9 changements');
  assert.equal(nombreChangements(lignesPlanExemple('2026-11-06').slice(0, 1)), '1 changement');
});

test('plan : le résumé gère les déplacements, les ajouts libres et plusieurs périodes', () => {
  assert.equal(resumePlan([{ op: 'deplacer', texte: 'x', de: '2026-11-12', vers: '2026-11-16', sport: 'velo' }]), '1 séance déplacée');
  assert.equal(resumePlan([{ op: 'ajouter', texte: 'x', sport: 'velo', vers: '2026-11-16' }, { op: 'ajouter', texte: 'y', sport: 'course', vers: '2026-11-17' }]), '2 séances ajoutées');
  assert.equal(resumePlan([{ op: 'supprimer', texte: 'x', sport: 'velo', de: '2026-11-12' }]), '1 retirée');
  assert.equal(
    resumePlan([{ op: 'indisponibilite', texte: 'a', type: 'maladie', du: '2026-11-07', au: '2026-11-08' }, { op: 'indisponibilite', texte: 'b', type: 'indisponible', du: '2026-11-10', au: '2026-11-12' }]),
    '1 maladie · 1 indisponibilité',
  );
  assert.equal(resumePlan([]), '');
});

test('plan : nom d\'une période, jamais de valeur inconnue en clair', () => {
  assert.equal(nomPeriode('blessure'), 'blessure');
  assert.equal(nomPeriode('indisponible'), 'indisponibilité');
  assert.equal(nomPeriode('toString'), 'période');
  assert.equal(nomPeriode(undefined), 'période');
});

test('plan : la phrase lue par VoiceOver dit le titre, le nombre de changements, la charge et l\'état', () => {
  const d = descriptionPlan(cartePlanExemple('2026-11-06'));
  assert.match(d, /Blessure au genou, 10 jours/);
  assert.match(d, /9 changements/);
  assert.match(d, /460 points avant, 100 après/);
  assert.match(d, /En attente de ton accord\.$/);
});

test('plan annulé : tout est revenu, ou combien de lignes sont restées telles quelles', () => {
  const base = cartePlanExemple('2026-11-06');
  assert.equal(phraseAnnulation(base), 'Plan annulé.');
  assert.equal(phraseAnnulation({ ...base, annulation: { annulees: 9, ignorees: 0 } }), 'Plan annulé : tout est revenu comme avant.');
  assert.match(phraseAnnulation({ ...base, annulation: { annulees: 8, ignorees: 1 } }), /8 changements défaits\. 1 ligne que tu avais déjà modifiée à la main est restée telle quelle\./);
  assert.match(phraseAnnulation({ ...base, annulation: { annulees: 6, ignorees: 3 } }), /3 lignes que tu avais déjà modifiées à la main sont restées telles quelles\./);
});

test('plan : le résumé compte les jours de repos posés et retirés', () => {
  assert.equal(resumePlan([{ op: 'repos', texte: 'x', vers: '2026-11-12', poser: true }]), '1 jour de repos posé');
  assert.equal(resumePlan([{ op: 'repos', texte: 'x', vers: '2026-11-12', poser: true }, { op: 'repos', texte: 'y', vers: '2026-11-13', poser: true }]), '2 jours de repos posés');
  assert.equal(resumePlan([{ op: 'repos', texte: 'x', vers: '2026-11-12', poser: false }]), '1 jour de repos retiré');
  assert.equal(resumePlan([{ op: 'repos', texte: 'x', vers: '2026-11-12' }, { op: 'supprimer', texte: 'y', sport: 'velo', de: '2026-11-12' }]), '1 jour de repos posé · 1 retirée');
});
