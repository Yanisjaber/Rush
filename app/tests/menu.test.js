import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesMenu, barreBas, cleDePage, ouvertureActive, lienPage, PAGES } from '../src/lib/data/menu.js';

const cles = (l) => l.map((p) => p.cle);

test('menu ordinateur : les six pages, dans l\'ordre (Muscu et Hyrox sont des sports, pas des pages)', () => {
  assert.deepEqual(cles(pagesMenu()), ['accueil', 'calendrier', 'plan', 'competitions', 'bilan', 'sommeil']);
  assert.equal(PAGES.force, undefined);
  assert.equal(PAGES.hyrox, undefined);
});

test('barre du bas : Accueil, Calendrier, Plan et Plus (le sport se choisit dans la barre du haut)', () => {
  const b = barreBas();
  assert.deepEqual(cles(b.items), ['accueil', 'calendrier', 'plan', 'plus']);
  assert.equal(b.items[3].ouvre, 'plus');
  assert.deepEqual(cles(b.plus), ['competitions', 'bilan', 'sommeil', 'parametres']);
  assert.ok(b.items.length <= 5);
});

test('lienPage : le sport est écrit dans l\'adresse sauf pour Sommeil et Paramètres', () => {
  assert.equal(lienPage('accueil'), '#/');
  assert.equal(lienPage('accueil', 'course'), '#/course');
  assert.equal(lienPage('bilan', 'velo'), '#/velo/bilan');
  assert.equal(lienPage('calendrier', 'tout'), '#/calendrier');
  assert.equal(lienPage('sommeil', 'course'), '#/sommeil');
  assert.equal(lienPage('parametres', 'course'), '#/parametres');
  assert.equal(lienPage('inconnue', 'course'), '#/');
});

test('cleDePage : la page courante, y compris les sous-pages', () => {
  assert.equal(cleDePage('/'), 'accueil');
  assert.equal(cleDePage(''), 'accueil');
  assert.equal(cleDePage('/calendrier'), 'calendrier');
  assert.equal(cleDePage('/force/seance/abc'), 'accueil');
  assert.equal(cleDePage('/parametres/connexions'), 'parametres');
  assert.equal(cleDePage('/sommeil/graphiques'), 'sommeil');
  assert.equal(cleDePage('/seance/123'), null);
  assert.equal(cleDePage('/confidentialite'), null);
  assert.equal(cleDePage('/__proto__'), null);
  assert.equal(cleDePage('/constructor'), null);
});

test('ouvertureActive : « Plus » est surligné sur les pages qu\'il cache', () => {
  assert.equal(ouvertureActive('bilan'), 'plus');
  assert.equal(ouvertureActive('parametres'), 'plus');
  assert.equal(ouvertureActive('accueil'), null);
  assert.equal(ouvertureActive(null), null);
});
