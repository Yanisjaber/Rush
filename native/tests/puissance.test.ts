import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CADRE, CADRE_M, CADRE_S, geometriePuissance, lignesValides } from '../src/data/puissance.ts';
import { donneesDemo } from '../src/data/demo.ts';

const p = (d: number, w90: number, wTout: number) => ({ duration_s: d, watts_90d: w90, watts_alltime: wTout });

test('lignesValides : ignore les durées sans puissance, trie par durée', () => {
  const l = lignesValides([p(300, 250, 280), p(5, 700, 800), p(60, 0, 0)]);
  assert.deepEqual(l.map((x) => x.duration_s), [5, 300]);
});

test('geometriePuissance : moins de deux durées valides, pas de courbe', () => {
  assert.equal(geometriePuissance([]), null);
  assert.equal(geometriePuissance(null), null);
  assert.equal(geometriePuissance([p(5, 700, 800)]), null);
});

test('geometriePuissance : la plus courte durée à gauche, la plus longue à droite, plus de watts = plus haut', () => {
  const g = geometriePuissance([p(5, 700, 800), p(3600, 200, 240)]);
  assert.ok(g);
  const [court, long] = g.points;
  assert.equal(court.x, CADRE.gauche);
  assert.equal(long.x, CADRE.largeur - CADRE.droite);
  assert.ok(court.y < long.y, 'une grosse puissance est plus haute (y plus petit)');
  assert.equal(g.base, CADRE.hauteur - CADRE.bas);
  assert.equal(court.label, '5 s');
  assert.equal(long.label, '1 h');
});

test('geometriePuissance : les points restent dans le cadre', () => {
  const g = geometriePuissance(donneesDemo(new Date(2026, 9, 19)).puissance);
  assert.ok(g);
  assert.equal(g.points.length, 8);
  for (const pt of g.points) {
    assert.ok(pt.x >= CADRE.gauche && pt.x <= CADRE.largeur - CADRE.droite);
    assert.ok(pt.y >= CADRE.haut && pt.y <= g.base);
  }
  assert.ok(g.ligne90.startsWith('M') && g.ligneTout.startsWith('M'));
});

test('geometriePuissance : un libellé « n s » pour une durée hors catalogue', () => {
  const g = geometriePuissance([p(5, 700, 800), p(45, 500, 0), p(3600, 200, 240)]);
  assert.equal(g?.points[1].label, '45 s');
});

test('geometriePuissance : un cadre sur mesure (M, S) garde les points dans ce cadre', () => {
  const lignes = [p(5, 700, 800), p(60, 400, 450), p(1200, 250, 280), p(3600, 200, 240)];
  for (const cadre of [CADRE_M, CADRE_S]) {
    const g = geometriePuissance(lignes, cadre);
    assert.ok(g);
    assert.equal(g.base, cadre.hauteur - cadre.bas);
    for (const pt of g.points) {
      assert.ok(pt.x >= cadre.gauche && pt.x <= cadre.largeur - cadre.droite);
      assert.ok(pt.y >= cadre.haut && pt.y <= g.base);
    }
  }
});
