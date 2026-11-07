import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cheminAvatar, extrasAvecAvatar, lireCheminAvatar } from '../../src/data/reglages/avatar.ts';

const ID = '00000000-0000-4000-8000-00000000000a';
const AUTRE = '00000000-0000-4000-8000-00000000000b';

test('le chemin est dans le dossier du compte', () => {
  assert.equal(cheminAvatar(ID), `${ID}/avatar.jpg`);
  assert.equal(cheminAvatar('../autre'), null);
  assert.equal(cheminAvatar(''), null);
});

test('on ne lit que le chemin du compte connecté', () => {
  assert.equal(lireCheminAvatar({ avatar_path: `${ID}/avatar.jpg` }, ID), `${ID}/avatar.jpg`);
  assert.equal(lireCheminAvatar({ avatar_path: `${AUTRE}/avatar.jpg` }, ID), null);
  assert.equal(lireCheminAvatar({ avatar_path: `${ID}/../${AUTRE}/avatar.jpg` }, ID), null);
  assert.equal(lireCheminAvatar({ avatar_path: 42 }, ID), null);
  assert.equal(lireCheminAvatar({}, ID), null);
  assert.equal(lireCheminAvatar(null, ID), null);
});

test('poser ou retirer la photo garde les autres extras', () => {
  assert.deepEqual(extrasAvecAvatar({ first_name: 'Yanis' }, `${ID}/avatar.jpg`), { first_name: 'Yanis', avatar_path: `${ID}/avatar.jpg` });
  assert.deepEqual(extrasAvecAvatar({ first_name: 'Yanis', avatar_path: 'x' }, null), { first_name: 'Yanis' });
  assert.deepEqual(extrasAvecAvatar(null, null), {});
});
