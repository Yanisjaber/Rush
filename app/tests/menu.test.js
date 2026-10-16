import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesMenu, barreBas, cleDePage, lienPage, page, PAGES } from '../src/lib/data/menu.js';

const cles = (l) => l.map((p) => p.cle);

test('menu ordinateur : les six pages, dans l\'ordre (Muscu et Hyrox sont des sports, pas des pages)', () => {
  assert.deepEqual(cles(pagesMenu()), ['accueil', 'calendrier', 'plan', 'competitions', 'bilan', 'sommeil']);
  assert.equal(PAGES.force, undefined);
  assert.equal(PAGES.hyrox, undefined);
});

test('barre du bas : Accueil, Calendrier, Bilan, Santé, Paramètres', () => {
  const b = barreBas();
  assert.deepEqual(cles(b.items), ['accueil', 'calendrier', 'bilan', 'sante', 'parametres']);
  assert.equal(page('sante').chemin, '/sommeil');
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
  assert.equal(cleDePage('/sommeil/graphiques'), 'sante');
  assert.equal(cleDePage('/plan'), 'calendrier');
  assert.equal(cleDePage('/seance/123'), null);
  assert.equal(cleDePage('/confidentialite'), null);
  assert.equal(cleDePage('/__proto__'), null);
  assert.equal(cleDePage('/constructor'), null);
});
