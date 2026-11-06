import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decouperEvenements, lireCarte, lireCartes, viderTampon } from '../../src/data/coach/flux.ts';

const carte = { id: 'c1', etat: 'proposee', proposition: { date: '2026-11-08', sport: 'velo', type: 'endurance', minutes: 90 }, tss_estime: 75, justification: 'Pour entretenir.' };
const ligne = (e: unknown) => `data: ${JSON.stringify(e)}\n\n`;

test('découpage : plusieurs événements complets arrivent d\'un coup', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'Bon' }) + ligne({ type: 'texte', delta: 'jour' }));
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'Bon' }, { type: 'texte', delta: 'jour' }]);
  assert.equal(r.reste, '');
});

test('découpage : un événement coupé en deux morceaux est reconstitué', () => {
  const entier = ligne({ type: 'texte', delta: 'Salut' });
  const a = decouperEvenements(entier.slice(0, 12));
  assert.deepEqual(a.evenements, []);
  const b = decouperEvenements(a.reste + entier.slice(12));
  assert.deepEqual(b.evenements, [{ type: 'texte', delta: 'Salut' }]);
  // coupé pile entre les deux sauts de ligne
  const c = decouperEvenements(entier.slice(0, -1));
  assert.deepEqual(c.evenements, []);
  assert.deepEqual(decouperEvenements(c.reste + entier.slice(-1)).evenements, [{ type: 'texte', delta: 'Salut' }]);
});

test('découpage : les accents et les retours chariot (\\r\\n) passent', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'Allez, à fond !' }).replace(/\n/g, '\r\n'));
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'Allez, à fond !' }]);
});

test('découpage : une ligne cassée, de type inconnu ou mal formée est ignorée sans empêcher les suivantes', () => {
  const r = decouperEvenements(
    'data: {pas du json}\n\n' + ligne({ type: 'inconnu' }) + ligne({ type: 'texte', delta: 12 }) + ligne({ type: 'fin', message_id: 'm1' }) + ': commentaire\n\n' + ligne({ type: 'texte', delta: 'ok' }),
  );
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'ok' }]);
});

test('découpage : fin, erreur et carte', () => {
  const r = decouperEvenements(ligne({ type: 'carte', message_id: 'm1', carte }) + ligne({ type: 'fin', message_id: 'm1', texte: 'Voilà.' }) + ligne({ type: 'erreur', code: 'plafond_jour', message: 'Reviens demain.' }));
  assert.equal(r.evenements.length, 3);
  assert.deepEqual(r.evenements[0], { type: 'carte', message_id: 'm1', carte });
  assert.deepEqual(r.evenements[1], { type: 'fin', message_id: 'm1', texte: 'Voilà.' });
  assert.deepEqual(r.evenements[2], { type: 'erreur', code: 'plafond_jour', message: 'Reviens demain.' });
});

test('une carte douteuse est écartée : mauvais état, proposition incomplète, identifiant absent', () => {
  assert.equal(lireCarte({ ...carte, etat: 'hackee' }), null);
  assert.equal(lireCarte({ ...carte, proposition: { date: '2026-11-08' } }), null);
  assert.equal(lireCarte({ ...carte, id: 3 }), null);
  assert.equal(lireCarte(null), null);
  assert.equal(lireCarte([carte]), null);
  assert.deepEqual(lireCarte({ ...carte, tss_estime: 'beaucoup' })?.tss_estime, 0);
  // une carte dans un événement mal formé n'est pas affichée
  assert.deepEqual(decouperEvenements(ligne({ type: 'carte', message_id: 'm1', carte: { ...carte, etat: 'x' } })).evenements, []);
});

test('lireCartes : une liste ou rien ; les cartes douteuses sont filtrées ; les champs en trop sont retirés', () => {
  assert.deepEqual(lireCartes(null), []);
  assert.deepEqual(lireCartes('x'), []);
  assert.deepEqual(lireCartes({ a: 1 }), []);
  const l = lireCartes([carte, { id: 'z' }, { ...carte, id: 'c2', etat: 'ajoutee', seance_id: 's1', extra: '<script>' }]);
  assert.deepEqual(l.map((c) => c.id), ['c1', 'c2']);
  assert.equal(l[1].seance_id, 's1');
  assert.equal('extra' in l[1], false);
});

test('fin du flux : un dernier événement sans sa ligne vide est quand même lu', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'a' }) + 'data: {"type":"texte","delta":"b"}');
  assert.equal(r.evenements.length, 1);
  assert.deepEqual(viderTampon(r.reste), [{ type: 'texte', delta: 'b' }]);
  assert.deepEqual(viderTampon('   '), []);
  assert.deepEqual(viderTampon(''), []);
});
