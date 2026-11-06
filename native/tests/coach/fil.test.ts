import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquerEvenement, debutEnvoi, dernierEnEchec, erreurEnvoi, ERREURS_SANS_REESSAI, ID_REPONSE_EN_COURS, majCarte, MESSAGE_ERREUR_PAR_DEFAUT, messagesDepuisLignes, phraseErreur,
} from '../../src/data/coach/fil.ts';
import type { CarteSeance, MessageCoach } from '../../src/data/coach/types.ts';

const carte: CarteSeance = { id: 'c1', etat: 'proposee', proposition: { date: '2026-11-08', sport: 'velo', type: 'endurance', minutes: 90 }, tss_estime: 75, justification: '' };
const vide: MessageCoach[] = [];

test('lignes enregistrées → messages du plus ancien au plus récent, rôles inconnus écartés, cartes relues', () => {
  const m = messagesDepuisLignes([
    { id: '3', role: 'assistant', contenu: 'Réponse', cartes: [carte], created_at: '2026-11-06T10:00:02Z' },
    { id: '1', role: 'user', contenu: 'Question', cartes: null, created_at: '2026-11-06T10:00:01Z' },
    { id: '2', role: 'system', contenu: 'intrus', cartes: null, created_at: '2026-11-06T10:00:01.5Z' },
  ]);
  assert.deepEqual(m.map((x) => x.id), ['1', '3']);
  assert.equal(m[1].cartes[0].id, 'c1');
  assert.deepEqual(m[0].cartes, []);
});

test('envoi : le message de l\'utilisateur et une réponse vide « en cours » apparaissent tout de suite', () => {
  const m = debutEnvoi(vide, 'Salut', 'local-1');
  assert.deepEqual(m.map((x) => [x.id, x.role, x.texte, !!x.enCours]), [['local-1', 'user', 'Salut', false], [ID_REPONSE_EN_COURS, 'assistant', '', true]]);
});

test('flux : le texte s\'ajoute au fil de l\'eau, puis la fin remplace par le texte final et donne le vrai identifiant', () => {
  let m = debutEnvoi(vide, 'Salut', 'local-1');
  m = appliquerEvenement(m, { type: 'texte', delta: 'Bon' });
  m = appliquerEvenement(m, { type: 'texte', delta: 'jour' });
  assert.equal(m[1].texte, 'Bonjour');
  assert.equal(m[1].enCours, true);
  m = appliquerEvenement(m, { type: 'carte', message_id: 'm9', carte });
  assert.equal(m[1].cartes.length, 1);
  m = appliquerEvenement(m, { type: 'fin', message_id: 'm9', texte: 'Bonjour !' });
  assert.deepEqual([m[1].id, m[1].texte, m[1].enCours], ['m9', 'Bonjour !', false]);
  assert.equal(m[1].cartes.length, 1);
});

test('flux : une même carte reçue deux fois ne s\'affiche qu\'une fois', () => {
  let m = debutEnvoi(vide, 'x', 'l');
  m = appliquerEvenement(m, { type: 'carte', message_id: 'm', carte });
  m = appliquerEvenement(m, { type: 'carte', message_id: 'm', carte: { ...carte, tss_estime: 80 } });
  assert.equal(m[1].cartes.length, 1);
  assert.equal(m[1].cartes[0].tss_estime, 80);
});

test('flux : un événement qui arrive sans réponse en cours est ignoré (pas de plantage)', () => {
  const m: MessageCoach[] = [{ id: 'a', role: 'user', texte: 'x', cartes: [] }];
  assert.deepEqual(appliquerEvenement(m, { type: 'texte', delta: 'orphelin' }), m);
});

test('erreur du serveur : la réponse vide disparaît, le message de l\'utilisateur reste marqué en échec', () => {
  let m = debutEnvoi([{ id: 'v', role: 'assistant', texte: 'Avant', cartes: [] }], 'Ma question', 'local-1');
  m = appliquerEvenement(m, { type: 'erreur', code: 'plafond_jour', message: 'Reviens demain.' });
  assert.deepEqual(m.map((x) => x.id), ['v', 'local-1']);
  assert.equal(m[1].echec, 'Reviens demain.');
  assert.equal(dernierEnEchec(m)?.texte, 'Ma question');
  // erreur sans phrase : une phrase polie par défaut
  const n = appliquerEvenement(debutEnvoi(vide, 'q', 'l'), { type: 'erreur', code: 'modele_indisponible', message: '' });
  assert.equal(n[0].echec, MESSAGE_ERREUR_PAR_DEFAUT);
});

test('renvoyer après un échec : l\'ancien message en échec n\'est pas doublé', () => {
  let m = erreurEnvoi(debutEnvoi(vide, 'Ma question', 'local-1'), 'Panne');
  assert.equal(dernierEnEchec(m)?.id, 'local-1');
  m = debutEnvoi(m, 'Ma question', 'local-2');
  assert.deepEqual(m.map((x) => x.id), ['local-2', ID_REPONSE_EN_COURS]);
  assert.equal(dernierEnEchec(m), null);
});

test('carte : le changement d\'état remplace la bonne carte, où qu\'elle soit', () => {
  const m: MessageCoach[] = [
    { id: 'a', role: 'assistant', texte: 'x', cartes: [carte, { ...carte, id: 'c2' }] },
    { id: 'b', role: 'user', texte: 'y', cartes: [] },
  ];
  const n = majCarte(m, { ...carte, etat: 'ajoutee', seance_id: 's1' });
  assert.deepEqual(n[0].cartes.map((c) => [c.id, c.etat]), [['c1', 'ajoutee'], ['c2', 'proposee']]);
  assert.equal(n[1], m[1]);
  assert.deepEqual(majCarte(m, { ...carte, id: 'inconnue' }), m);
});

test('phrases d\'erreur : celle du serveur d\'abord, sinon une phrase connue, sinon la phrase par défaut ; jamais un code technique', () => {
  assert.equal(phraseErreur('plafond_jour', 'Reviens demain.'), 'Reviens demain.');
  assert.match(phraseErreur('plafond_jour'), /limite/);
  assert.equal(phraseErreur('inconnu_bizarre'), MESSAGE_ERREUR_PAR_DEFAUT);
  assert.equal(phraseErreur('__proto__'), MESSAGE_ERREUR_PAR_DEFAUT);
  assert.doesNotMatch(phraseErreur('base_indisponible'), /base_indisponible/);
  assert.ok(ERREURS_SANS_REESSAI.includes('plafond_jour') && !ERREURS_SANS_REESSAI.includes('modele_indisponible'));
});
