import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireGraphe, indiceTouche, jj, lectureGraphe, LARGEUR_GRAPHE } from '../src/data/outils/graphe-series.ts';

const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

test('barres simples : une barre par valeur, la plus haute prend le haut', () => {
  const g = construireGraphe({ etiquettes: dates, barres: [{ nom: 'Sommeil', valeurs: [6, 8, 7, 5], couleur: '#fff' }], hauteur: 100 });
  assert.equal(g.rects.length, 4);
  assert.ok(g.rects[1].y < g.rects[0].y); // 8 est plus haut que 6
  assert.ok(g.rects[1].h > g.rects[0].h);
  assert.equal(g.pas, LARGEUR_GRAPHE / 4);
  assert.ok(g.rects.every((r) => r.i >= 0 && r.i < 4 && r.w >= 2));
});

test('barres : les valeurs absentes sont sautées, et une barre par couleur si `couleurs` est donné', () => {
  const g = construireGraphe({ etiquettes: dates, barres: [{ nom: 'a', valeurs: [3, null, 5, Number.NaN], couleur: '#111', couleurs: ['#aaa', '#bbb', '#ccc', '#ddd'] }] });
  assert.deepEqual(g.rects.map((r) => r.i), [0, 2]);
  assert.deepEqual(g.rects.map((r) => r.couleur), ['#aaa', '#ccc']);
});

test('barres empilées : chaque pile fait 100 % de la hauteur utile', () => {
  const g = construireGraphe({
    etiquettes: ['2026-10-01'],
    barres: [{ nom: 'a', valeurs: [1], couleur: '#1' }, { nom: 'b', valeurs: [3], couleur: '#2' }],
    empile: true,
    hauteur: 106, // marge de 6 de chaque côté : 94 de hauteur utile
  });
  assert.equal(g.rects.length, 2);
  assert.ok(Math.abs(g.rects[0].h - 94 * 0.25) < 1e-9);
  assert.ok(Math.abs(g.rects[1].h - 94 * 0.75) < 1e-9);
});

test('lignes : un trou (valeur absente) interrompt le tracé', () => {
  const g = construireGraphe({ etiquettes: dates, lignes: [{ nom: 'l', valeurs: [1, 2, null, 4], couleur: '#fff' }], hauteur: 100 });
  const d = g.chemins[0].d;
  assert.equal((d.match(/M/g) || []).length, 2); // deux tronçons
  assert.equal((d.match(/L/g) || []).length, 1);
  assert.equal(g.chemins[0].pointille, false);
});

test('lignes : une ligne peut avoir sa propre échelle', () => {
  const commune = construireGraphe({ etiquettes: dates, lignes: [{ nom: 'a', valeurs: [0, 100, 0, 100], couleur: '#1' }, { nom: 'b', valeurs: [0, 1, 0, 1], couleur: '#2' }], hauteur: 100 });
  const propre = construireGraphe({ etiquettes: dates, lignes: [{ nom: 'a', valeurs: [0, 100, 0, 100], couleur: '#1' }, { nom: 'b', valeurs: [0, 1, 0, 1], couleur: '#2', echelle: { min: 0, max: 1 } }], hauteur: 100 });
  assert.notEqual(commune.chemins[1].d, propre.chemins[1].d);
});

test('bande min-max et repères horizontaux', () => {
  const g = construireGraphe({ etiquettes: dates, bande: { min: [1, 1, 1, 1], max: [3, 3, 3, 3] }, reperes: [{ valeur: 2, etiquette: 'Objectif' }], hauteur: 100 });
  assert.ok(g.zoneBande.startsWith('M') && g.zoneBande.endsWith('Z'));
  assert.equal(g.reperesY.length, 1);
  assert.equal(construireGraphe({ etiquettes: dates, hauteur: 100 }).zoneBande, '');
});

test('dates écrites sous le graphique : début, milieu, fin, sans doublon', () => {
  assert.deepEqual(construireGraphe({ etiquettes: dates }).repereDates, [0, 1, 3]);
  assert.deepEqual(construireGraphe({ etiquettes: ['2026-10-01'] }).repereDates, [0]);
  assert.deepEqual(construireGraphe({ etiquettes: [] }).repereDates, []);
});

test('un graphique vide ne casse pas', () => {
  const g = construireGraphe({ etiquettes: [] });
  assert.equal(g.n, 0);
  assert.deepEqual(g.rects, []);
  assert.deepEqual(g.chemins, []);
});

test('lecture : la date et les valeurs pointées', () => {
  const p = { etiquettes: dates, barres: [{ nom: 'Durée', valeurs: [6.4, 7.2, null, 5], couleur: '#f' }], lignes: [{ nom: 'FC', valeurs: [50, 51, 52, 53], couleur: '#e' }] };
  assert.equal(lectureGraphe(p, 1, (v, nom) => `${v} ${nom === 'FC' ? 'bpm' : 'h'}`), '02/10 : Durée 7.2 h · FC 51 bpm');
  assert.equal(lectureGraphe(p, 2, (v) => String(v)), '03/10 : FC 52'); // la barre absente n'est pas écrite
  assert.equal(lectureGraphe(p, null), '');
  assert.equal(lectureGraphe(p, 99), '');
});

test('indiceTouche : la position du doigt donne la date, bornée aux extrémités', () => {
  assert.equal(indiceTouche(0, 400, 4), 0);
  assert.equal(indiceTouche(150, 400, 4), 1);
  assert.equal(indiceTouche(399, 400, 4), 3);
  assert.equal(indiceTouche(-20, 400, 4), 0);
  assert.equal(indiceTouche(900, 400, 4), 3);
  assert.equal(indiceTouche(10, 0, 4), null);
  assert.equal(indiceTouche(10, 400, 0), null);
});

test('jj : jour/mois', () => {
  assert.equal(jj('2026-10-04'), '04/10');
});
