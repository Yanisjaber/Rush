import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bornerCadre, bornerZoom, deplacementMax, echelleBase, rectangleDecoupe, ZOOM_MAX } from '../../src/data/reglages/recadrage.ts';

// Photo paysage 4000 x 3000 dans un cercle de 300 px : le petit côté (3000) remplit le cercle, échelle 0,1
const PAYSAGE = { w: 4000, h: 3000, d: 300, zoom: 1, tx: 0, ty: 0 };

test("l'échelle de base fait remplir le cercle par le petit côté", () => {
  assert.equal(echelleBase(4000, 3000, 300), 0.1);
  assert.equal(echelleBase(3000, 4000, 300), 0.1);
  assert.equal(echelleBase(0, 0, 300), 1);
});

test('le zoom reste entre 1 et le maximum', () => {
  assert.equal(bornerZoom(0.2), 1);
  assert.equal(bornerZoom(99), ZOOM_MAX);
  assert.equal(bornerZoom(NaN), 1);
  assert.equal(bornerZoom(2.5), 2.5);
});

test('on ne peut déplacer que dans le sens où la photo dépasse du cercle', () => {
  // Paysage à zoom 1 : 400 px de large pour 300 de cercle, donc 50 px de marge de chaque côté, aucune en hauteur
  assert.deepEqual(deplacementMax(PAYSAGE), { x: 50, y: 0 });
  assert.deepEqual(bornerCadre({ ...PAYSAGE, tx: 500, ty: 500 }), { ...PAYSAGE, tx: 50, ty: 0 });
  assert.deepEqual(bornerCadre({ ...PAYSAGE, tx: -500 }), { ...PAYSAGE, tx: -50 });
  // Zoom 2 : de la marge partout
  assert.deepEqual(deplacementMax({ ...PAYSAGE, zoom: 2 }), { x: 250, y: 150 });
});

test('sans zoom ni déplacement, on découpe le carré central', () => {
  assert.deepEqual(rectangleDecoupe(PAYSAGE), { originX: 500, originY: 0, width: 3000, height: 3000 });
});

test('zoomer réduit la zone découpée, au centre', () => {
  assert.deepEqual(rectangleDecoupe({ ...PAYSAGE, zoom: 2 }), { originX: 1250, originY: 750, width: 1500, height: 1500 });
});

test('pousser la photo vers la droite montre sa partie gauche, sans jamais sortir de la photo', () => {
  const r = rectangleDecoupe({ ...PAYSAGE, tx: 50 });
  assert.equal(r.originX, 0);
  const trop = rectangleDecoupe({ ...PAYSAGE, tx: 9999, ty: 9999 });
  assert.equal(trop.originX, 0);
  assert.equal(trop.originY, 0);
  const gauche = rectangleDecoupe({ ...PAYSAGE, tx: -9999 });
  assert.equal(gauche.originX + gauche.width, 4000);
});

test('une photo en portrait se découpe par la hauteur', () => {
  const r = rectangleDecoupe({ w: 3000, h: 4000, d: 300, zoom: 1, tx: 0, ty: 0 });
  assert.deepEqual(r, { originX: 0, originY: 500, width: 3000, height: 3000 });
});

test('le rectangle reste toujours dans la photo', () => {
  for (const zoom of [1, 1.7, 3, 5]) {
    for (const t of [-1000, -37, 0, 41, 1000]) {
      const r = rectangleDecoupe({ w: 1200, h: 800, d: 280, zoom, tx: t, ty: -t });
      assert.ok(r.originX >= 0 && r.originY >= 0);
      assert.ok(r.originX + r.width <= 1200 && r.originY + r.height <= 800);
      assert.equal(r.width, r.height);
    }
  }
});
