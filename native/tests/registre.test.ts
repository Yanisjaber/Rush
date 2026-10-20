import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositionAuto, composerOnglet, estPertinent, existe, normaliserListe, ORDRE_ONGLET, TAILLES, WIDGETS } from '../src/data/registre.ts';
import { construireContexte } from '../src/data/contexte.ts';
import { donneesDemoAccueil } from '../src/data/accueil.ts';

test('existe : seuls les vrais widgets, pas les propriétés héritées', () => {
  assert.equal(existe('objectif'), true);
  assert.equal(existe('constructor'), false);
  assert.equal(existe('__proto__'), false);
  assert.equal(existe(null), false);
  assert.equal(existe(42), false);
});

test('registre : 23 widgets, chacun avec une taille par défaut permise', () => {
  const ids = Object.keys(WIDGETS);
  assert.equal(ids.length, 23);
  for (const id of ids) {
    const d = (WIDGETS as Record<string, { tailles: readonly string[]; taille: string }>)[id];
    assert.ok(d.tailles.includes(d.taille), id);
  }
});

test('estPertinent : un widget « tous sports » l\'est toujours, un widget de sport seulement pour ce sport', () => {
  assert.equal(estPertinent('forme', []), true);
  assert.equal(estPertinent('predictions', ['course']), true);
  assert.equal(estPertinent('predictions', ['velo']), false);
  assert.equal(estPertinent('inconnu', ['course']), false);
});

test('compositionAuto : les widgets propres à Muscu et Hyrox ne sont jamais sur l\'onglet « Tout »', () => {
  const ids = compositionAuto(['course', 'velo', 'muscu', 'hyrox']).map((w) => w.id);
  for (const propre of ['seancedujour', 'programmes', 'hyroxdossard', 'hyroxtest', 'hyroxallure', 'hyroxgains', 'chargeforce']) {
    assert.equal(ids.includes(propre), false, propre);
  }
  assert.ok(ids.includes('objectif'));
  assert.ok(ids.includes('predictions'));
});

test('compositionAuto : sans sport de course, pas de widgets de course', () => {
  const ids = compositionAuto(['velo']).map((w) => w.id);
  assert.equal(ids.includes('predictions'), false);
  assert.equal(ids.includes('puissance'), true);
});

test('composerOnglet : Muscu et Hyrox ont leur composition fixe, en gardant la taille choisie', () => {
  const auto = compositionAuto(['muscu', 'hyrox']);
  assert.deepEqual(composerOnglet(auto, 'muscu').map((w) => w.id), [...ORDRE_ONGLET.muscu]);
  assert.deepEqual(composerOnglet(auto, 'hyrox').map((w) => w.id), [...ORDRE_ONGLET.hyrox]);
});

test('composerOnglet : un autre sport met l\'objectif en premier, puis les widgets de ce sport', () => {
  const ids = composerOnglet(compositionAuto(['course', 'velo']), 'course').map((w) => w.id);
  assert.equal(ids[0], 'objectif');
  assert.ok(ids.indexOf('predictions') < ids.indexOf('forme'), 'les widgets de course passent avant les universels');
  assert.equal(ids.includes('puissance'), false);
});

test('construireContexte : « Tous » ne filtre rien, un sport filtre séances et séances prévues', () => {
  const donnees = donneesDemoAccueil(new Date(2026, 9, 19));
  const tout = construireContexte(donnees, 'tout');
  assert.equal(tout.seances.length, donnees.seances.length);
  const course = construireContexte(donnees, 'course');
  assert.ok(course.seances.length > 0 && course.seances.length < donnees.seances.length);
  assert.ok(course.seances.every((s) => s.sport === 'Run'));
  assert.equal(course.toutesSeances.length, donnees.seances.length); // les calculs globaux gardent tout
  assert.ok(course.planifiees.every((p) => p.sport === 'Run'));
  assert.equal(course.hrMax, 196);
  assert.equal(course.filtre, 'course');
  assert.equal(course.hyrox.tests.length, 3);
  assert.equal(course.force.programmes.length, 3);
});

test('tailles : chaque widget a les quatre tailles, et chaque taille a sa hauteur fixe', async () => {
  const { HAUTEURS } = await import('../src/components/taille.ts');
  for (const [id, d] of Object.entries(WIDGETS)) assert.deepEqual([...(d as { tailles: readonly string[] }).tailles], ['xs', 's', 'm', 'l'], id);
  assert.deepEqual(Object.keys(TAILLES), ['xs', 's', 'm', 'l']);
  assert.deepEqual(Object.keys(HAUTEURS), ['xs', 's', 'm', 'l']);
  assert.ok(HAUTEURS.xs < HAUTEURS.s && HAUTEURS.s <= HAUTEURS.m && HAUTEURS.m < HAUTEURS.l);
});

test("normaliserListe : l'ancienne taille xl devient l, une taille inconnue revient à celle par défaut", () => {
  const r = normaliserListe([{ id: 'charge', taille: 'xl' }, { id: 'forme', taille: 'geant' }, { id: 'volume', taille: 'xs' }]);
  assert.deepEqual(r, [{ id: 'charge', taille: 'l' }, { id: 'forme', taille: WIDGETS.forme.taille }, { id: 'volume', taille: 'xs' }]);
});
