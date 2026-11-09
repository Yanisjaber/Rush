import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chevauchement, placerPastille, type Point } from '../../src/data/outils/pastille.ts';

const taille = { largeur: 100, hauteur: 26 };
const cadre = { largeur: 340, hauteur: 140 };
const rect = (p: { left: number; top: number }) => ({ left: p.left, top: p.top, largeur: taille.largeur, hauteur: taille.hauteur });

test('placerPastille : sur un profil plat, la pastille est au-dessus et centrée', () => {
  const courbe: Point[] = Array.from({ length: 35 }, (_, i) => [i * 10, 110]);
  const p = placerPastille(courbe, [170, 110], taille, cadre);
  assert.equal(p.position, 'dessus');
  assert.equal(p.left, 120); // 170 - 100/2
  assert.equal(chevauchement(courbe, rect(p)), 0);
});

test('placerPastille : sur une pente, elle s\'écarte pour ne pas couvrir la courbe', () => {
  // Une descente régulière : y grandit avec x
  const courbe: Point[] = Array.from({ length: 35 }, (_, i) => [i * 10, 20 + i * 2.5]);
  const point: Point = [170, 20 + 17 * 2.5];
  const p = placerPastille(courbe, point, taille, cadre);
  assert.equal(chevauchement(courbe, rect(p)), 0, 'aucun point de courbe sous la pastille');
});

test('placerPastille : elle reste toujours dans le cadre, même contre les bords', () => {
  const courbe: Point[] = Array.from({ length: 35 }, (_, i) => [i * 10, 70 + Math.sin(i) * 20]);
  for (const x of [0, 5, 170, 335, 340]) {
    const p = placerPastille(courbe, [x, 70], taille, cadre);
    assert.ok(p.left >= 0 && p.left + taille.largeur <= cadre.largeur, `horizontal pour x=${x}`);
    assert.ok(p.top >= 0 && p.top + taille.hauteur <= cadre.hauteur, `vertical pour x=${x}`);
  }
});

test('placerPastille : un point en haut de la courbe met la pastille en dessous', () => {
  const courbe: Point[] = Array.from({ length: 35 }, (_, i) => [i * 10, 130]);
  courbe[17] = [170, 10]; // un pic tout en haut
  const p = placerPastille(courbe, [170, 10], taille, cadre);
  assert.notEqual(p.position, 'dessus');
});

test('placerPastille : la pastille ne recouvre jamais le point touché', () => {
  const courbe: Point[] = Array.from({ length: 35 }, (_, i) => [i * 10, 60 + (i % 2) * 40]);
  const point: Point = [170, 60];
  const p = placerPastille(courbe, point, taille, cadre);
  const sur = point[0] >= p.left && point[0] <= p.left + taille.largeur && point[1] >= p.top && point[1] <= p.top + taille.hauteur;
  assert.equal(sur, false);
});
