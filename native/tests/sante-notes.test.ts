import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formulaireNoteVide, validerNote } from '../src/data/calendrier/ajouts.ts';
import { libelleNote } from '../src/data/calendrier/annotations.ts';
import { detailsParDefaut, lignesDetail, nettoyerDetails, titreNote } from '../src/data/sante/sante-notes.ts';

const date = '2026-10-23';

test('nettoyerDetails : garde seulement les clés du type, avec des valeurs connues', () => {
  assert.equal(nettoyerDetails('texte', { maladie: 'grippe' }), null);
  assert.equal(nettoyerDetails('maladie', {}), null);
  assert.deepEqual(nettoyerDetails('maladie', { maladie: 'grippe', symptomes: ['toux', 'fievre', 'inconnu'], gravite: 'terrible', zone: 'genou' }), { maladie: 'grippe', symptomes: ['fievre', 'toux'] });
  assert.deepEqual(nettoyerDetails('blessure', { zone: 'genou', cote: 'droit', nature: 'autre', autre: '  Syndrome rotulien  ', douleur: 6 }), { zone: 'genou', cote: 'droit', nature: 'autre', autre: 'Syndrome rotulien', douleur: 6 });
  assert.deepEqual(nettoyerDetails('blessure', { douleur: 11 }), null);
  assert.deepEqual(nettoyerDetails('blessure', { douleur: 2.5 }), null);
  assert.deepEqual(nettoyerDetails('indisponible', { motif: 'voyage', lieu: 'x'.repeat(100) }), { motif: 'voyage', lieu: 'x'.repeat(60) });
  // « autre » n'est gardé que si on a choisi Autre
  assert.deepEqual(nettoyerDetails('maladie', { maladie: 'rhume', autre: 'peu importe' }), { maladie: 'rhume' });
  assert.equal(nettoyerDetails('maladie', 'pas un objet'), null);
});

test('titreNote et libelleNote : le nom de la maladie, la zone et le côté, le motif', () => {
  assert.equal(titreNote({ type: 'maladie', text: null, details: { maladie: 'grippe' } }), 'Grippe');
  assert.equal(titreNote({ type: 'maladie', text: null, details: { maladie: 'autre', autre: 'Zona' } }), 'Zona');
  assert.equal(titreNote({ type: 'maladie', text: null }), 'Maladie'); // ancienne note sans détail
  assert.equal(titreNote({ type: 'blessure', text: null, details: { zone: 'mollet', cote: 'gauche' } }), 'Mollet gauche');
  assert.equal(titreNote({ type: 'blessure', text: 'x' }), 'Blessure');
  assert.equal(titreNote({ type: 'indisponible', text: null, details: { motif: 'voyage' } }), 'Voyage');
  assert.equal(libelleNote({ type: 'blessure', text: 'Descente difficile', details: { zone: 'genou', cote: 'droit' } }), 'Genou droit : Descente difficile');
  assert.equal(libelleNote({ type: 'texte', text: 'Mot' }), 'Mot');
});

test('lignesDetail : une ligne par détail rempli, la note en dernier', () => {
  const l = lignesDetail({ type: 'blessure', text: 'Aïe', details: { zone: 'genou', cote: 'droit', nature: 'dechirure', douleur: 7 } });
  assert.deepEqual(l.map((x) => x.etiquette), ['Zone', 'Côté', 'Nature', 'Douleur', 'Note']);
  assert.equal(l[3].valeur, '7 / 10 · forte');
  assert.deepEqual(lignesDetail({ type: 'maladie', text: null, details: { symptomes: ['fievre', 'toux'], entrainement: 'repos' } }).map((x) => x.valeur), ['Fièvre, Toux', 'Repos']);
  assert.deepEqual(lignesDetail({ type: 'texte', text: 'Mot' }), []);
});

test('validerNote : le détail est nettoyé et enregistré selon le type', () => {
  const r = validerNote({ ...formulaireNoteVide(date), type: 'blessure', couleur: '#f87171', details: { ...detailsParDefaut('blessure'), zone: 'cheville', zonePirate: 1 } as never });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.ligne.details, { zone: 'cheville', cote: 'droit', nature: 'tendinite', douleur: 4 });
  const note = validerNote({ ...formulaireNoteVide(date), texte: 'Un mot', details: { maladie: 'grippe' } });
  assert.ok(note.ok);
  if (note.ok) assert.equal(note.ligne.details, null); // une simple note n'a pas de détail
  assert.ok(validerNote({ ...formulaireNoteVide(date), type: 'indisponible', details: detailsParDefaut('indisponible') }).ok);
});
