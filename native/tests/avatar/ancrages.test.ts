import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancragesEcran, CAMERA, pixelsParMetre, POINTS_MODELE, trait, versEcran } from '../../src/data/avatar/ancrages.ts';

test('le centre de l’avatar tombe au centre de la vue', () => {
  const p = versEcran({ x: 0, y: CAMERA.hauteurModele / 2 }, 300, 400);
  assert.ok(Math.abs(p.x - 150) < 1e-9);
  assert.ok(Math.abs(p.y - 200) < 1e-9);
});

test('les pieds sont plus bas que la tête, et l’avatar tient dans la vue', () => {
  const pieds = versEcran({ x: 0, y: 0 }, 300, 400);
  const tete = versEcran({ x: 0, y: CAMERA.hauteurModele }, 300, 400);
  assert.ok(tete.y < pieds.y);
  assert.ok(tete.y > 0 && pieds.y < 400, `pieds ${pieds.y}, tête ${tete.y}`);
});

test('pixels par mètre proportionnels à la hauteur de la vue', () => {
  assert.ok(Math.abs(pixelsParMetre(800) - 2 * pixelsParMetre(400)) < 1e-9);
});

test('cœur à droite des poumons à l’écran, jambes sous le torse, cœur au-dessus du torse', () => {
  const a = ancragesEcran(325, 380);
  assert.ok(a.heart.x > a.lungs.x);
  assert.ok(a.legs.y > a.chest.y);
  assert.ok(a.heart.y < a.chest.y);
  for (const z of Object.values(a)) assert.ok(z.x > 0 && z.x < 325 && z.y > 0 && z.y < 380);
});

test('tous les points du modèle sont dans la silhouette (0 à 1,8 m)', () => {
  for (const p of Object.values(POINTS_MODELE)) assert.ok(p.y > 0 && p.y < CAMERA.hauteurModele);
});

test('trait : longueur et angle', () => {
  const t = trait({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert.equal(t.longueur, 5);
  assert.equal(t.milieuX, 1.5);
  assert.equal(t.milieuY, 2);
  assert.ok(Math.abs(t.angle - Math.atan2(4, 3)) < 1e-12);
});
