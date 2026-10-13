import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesMenu, barreBas, cleDePage, ouvertureActive, pagesDeSports, PAGES } from '../src/lib/data/menu.js';

const cles = (l) => l.map((p) => p.cle);

test('menu ordinateur : pages universelles toujours là, Muscu et Hyrox seulement si on les pratique', () => {
  assert.deepEqual(cles(pagesMenu([])), ['accueil', 'calendrier', 'plan', 'competitions', 'bilan', 'sommeil']);
  assert.deepEqual(cles(pagesMenu(['course', 'velo'])), ['accueil', 'calendrier', 'plan', 'competitions', 'bilan', 'sommeil']);
  assert.deepEqual(cles(pagesMenu(['muscu'])), ['accueil', 'calendrier', 'plan', 'force', 'competitions', 'bilan', 'sommeil']);
  assert.deepEqual(cles(pagesMenu(['hyrox', 'muscu'])), ['accueil', 'calendrier', 'plan', 'force', 'hyrox', 'competitions', 'bilan', 'sommeil']); // ordre fixe
  assert.equal(PAGES.force.nom, 'Muscu'); // la page Force s'appelle Muscu dans le menu
  assert.deepEqual(cles(pagesMenu(null)), cles(pagesMenu([])));
});

test('barre du bas : 4 boutons sans sport à page, un bouton direct pour un sport, « Sports » pour deux', () => {
  assert.deepEqual(cles(barreBas(['course']).items), ['accueil', 'calendrier', 'plan', 'plus']);
  const un = barreBas(['muscu']);
  assert.deepEqual(cles(un.items), ['accueil', 'calendrier', 'plan', 'force', 'plus']);
  assert.equal(un.items[3].href, '#/force');
  const deux = barreBas(['muscu', 'hyrox']);
  assert.deepEqual(cles(deux.items), ['accueil', 'calendrier', 'plan', 'sports', 'plus']);
  assert.equal(deux.items[3].ouvre, 'sports');
  assert.deepEqual(cles(deux.sports), ['force', 'hyrox']);
  assert.deepEqual(cles(deux.plus), ['competitions', 'bilan', 'sommeil', 'parametres']);
  assert.ok(deux.items.length <= 5); // jamais plus de cinq boutons au pouce
});

test('cleDePage : la page courante, y compris les sous-pages', () => {
  assert.equal(cleDePage('/'), 'accueil');
  assert.equal(cleDePage(''), 'accueil');
  assert.equal(cleDePage('/calendrier'), 'calendrier');
  assert.equal(cleDePage('/force/journal'), 'force');
  assert.equal(cleDePage('/force/seance/abc'), 'force');
  assert.equal(cleDePage('/parametres/connexions'), 'parametres');
  assert.equal(cleDePage('/sommeil/graphiques'), 'sommeil');
  assert.equal(cleDePage('/seance/123'), null);
  assert.equal(cleDePage('/confidentialite'), null);
  assert.equal(cleDePage('/__proto__'), null);
});

test('ouvertureActive : « Plus » ou « Sports » est surligné quand on est sur une page qu\'ils cachent', () => {
  assert.equal(ouvertureActive('bilan', ['muscu']), 'plus');
  assert.equal(ouvertureActive('parametres', []), 'plus');
  assert.equal(ouvertureActive('hyrox', ['muscu', 'hyrox']), 'sports');
  assert.equal(ouvertureActive('force', ['muscu']), null); // direct dans la barre
  assert.equal(ouvertureActive('accueil', ['muscu', 'hyrox']), null);
  assert.equal(ouvertureActive(null, []), null);
  assert.deepEqual(cles(pagesDeSports(['hyrox'])), ['hyrox']);
});
