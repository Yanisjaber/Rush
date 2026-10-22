import test from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerQ, analyserAdresse, construireAdresse, estSport, estPageSport, moisDepuisAdresse, moisVersAdresse, anneeDepuisAdresse } from '../src/lib/data/adresses.js';

test('estSport : sports connus oui, pages et pièges non', () => {
  for (const s of ['course', 'velo', 'muscu', 'hyrox', 'natation', 'autre']) assert.equal(estSport(s), true, s);
  for (const s of ['calendrier', 'bilan', 'constructor', '__proto__', '', null, undefined, 3]) assert.equal(estSport(s), false, String(s));
});

test('analyserAdresse : accueil, avec et sans sport', () => {
  assert.deepEqual(analyserAdresse(''), { chemin: '/', sport: null, sous: '', q: {}, redirection: null });
  assert.deepEqual(analyserAdresse('#/'), { chemin: '/', sport: null, sous: '', q: {}, redirection: null });
  assert.deepEqual(analyserAdresse('#/course'), { chemin: '/', sport: 'course', sous: '', q: {}, redirection: null });
});

test('analyserAdresse : pages qui suivent le sport, avec détail', () => {
  assert.deepEqual(analyserAdresse('#/calendrier'), { chemin: '/calendrier', sport: null, sous: '', q: {}, redirection: null });
  assert.deepEqual(analyserAdresse('#/velo/calendrier/2026-09'), { chemin: '/calendrier', sport: 'velo', sous: '2026-09', q: {}, redirection: null });
  assert.deepEqual(analyserAdresse('#/muscu/bilan/2025'), { chemin: '/bilan', sport: 'muscu', sous: '2025', q: {}, redirection: null });
  assert.equal(analyserAdresse('#/course/plan').chemin, '/plan');
  assert.equal(analyserAdresse('#/competitions').chemin, '/competitions');
});

test('analyserAdresse : vues détaillées Muscu et Hyrox', () => {
  assert.deepEqual(analyserAdresse('#/muscu/journal'), { chemin: '/', sport: 'muscu', sous: 'journal', q: {}, redirection: null });
  assert.deepEqual(analyserAdresse('#/hyrox/tests'), { chemin: '/', sport: 'hyrox', sous: 'tests', q: {}, redirection: null });
  // une vue qui n'existe pas pour ce sport : pas une vue détaillée
  assert.equal(analyserAdresse('#/course/journal').sous, '');
  assert.equal(analyserAdresse('#/hyrox/journal').sous, '');
});

test('analyserAdresse : pages sans sport inchangées', () => {
  assert.deepEqual(analyserAdresse('#/sommeil/graphiques'), { chemin: '/sommeil/graphiques', sport: null, sous: '', q: {}, redirection: null });
  assert.equal(analyserAdresse('#/parametres/connexions').chemin, '/parametres/connexions');
  assert.equal(analyserAdresse('#/seance/abc-123').chemin, '/seance/abc-123');
  assert.equal(analyserAdresse('#/force/seance/libre').chemin, '/force/seance/libre');
  assert.equal(analyserAdresse('#/catalogue').chemin, '/catalogue');
  assert.equal(analyserAdresse('#/confidentialite').chemin, '/confidentialite');
});

test('analyserAdresse : anciennes adresses Muscu redirigées', () => {
  assert.equal(analyserAdresse('#/force').redirection, '#/muscu/programmes');
  assert.equal(analyserAdresse('#/force/journal').redirection, '#/muscu/journal');
  assert.equal(analyserAdresse('#/force/exercices').redirection, '#/muscu/exercices');
  assert.equal(analyserAdresse('#/force/seance/libre').redirection, null); // la séance en direct garde son adresse
});

test('analyserAdresse : adresses piégées ou bizarres ne cassent rien', () => {
  assert.equal(analyserAdresse('#/__proto__').sport, null);
  assert.equal(analyserAdresse('#/constructor/bilan').sport, null);
  assert.equal(analyserAdresse('#/course/inconnue/zzz').sport, 'course');
  assert.equal(analyserAdresse('#//course///bilan//').chemin, '/bilan');
  assert.equal(analyserAdresse('#/course?x=1').sport, 'course');
  assert.equal(analyserAdresse(null).chemin, '/');
});

test('construireAdresse : sport écrit seulement pour les pages qui le suivent', () => {
  assert.equal(construireAdresse(), '#/');
  assert.equal(construireAdresse({ sport: 'course' }), '#/course');
  assert.equal(construireAdresse({ sport: 'course', page: '/calendrier' }), '#/course/calendrier');
  assert.equal(construireAdresse({ sport: 'tout', page: 'bilan', sous: '2025' }), '#/bilan/2025');
  assert.equal(construireAdresse({ sport: 'velo', page: '/sommeil' }), '#/sommeil'); // Sommeil ignore le sport
  assert.equal(construireAdresse({ sport: 'muscu', sous: 'journal' }), '#/muscu/journal');
  assert.equal(construireAdresse({ sport: 'pasunsport', page: '/plan' }), '#/plan');
});

test('construire puis analyser : aller-retour', () => {
  for (const a of [{ sport: 'course', page: '/bilan', sous: '2024' }, { sport: 'muscu', sous: 'exercices' }, { sport: 'tout', page: '/calendrier', sous: '2026-01' }, { sport: 'hyrox', sous: 'tests' }]) {
    const lu = analyserAdresse(construireAdresse(a));
    assert.equal(lu.sport, a.sport === 'tout' ? null : a.sport);
    assert.equal(lu.chemin, a.page ? '/' + a.page.replace(/^\//, '') : '/');
    assert.equal(lu.sous, a.sous || '');
  }
});

test('estPageSport', () => {
  for (const c of ['/', '/calendrier', '/plan', '/competitions', '/bilan']) assert.equal(estPageSport(c), true, c);
  for (const c of ['/sommeil', '/parametres', '/seance/x', '/catalogue']) assert.equal(estPageSport(c), false, c);
});

test('mois et année dans l\'adresse', () => {
  assert.deepEqual(moisDepuisAdresse('2026-09'), { annee: 2026, mois: 8 });
  assert.equal(moisDepuisAdresse('2026-13'), null);
  assert.equal(moisDepuisAdresse('2026-9'), null);
  assert.equal(moisDepuisAdresse('1800-01'), null);
  assert.equal(moisDepuisAdresse(''), null);
  assert.equal(moisVersAdresse({ annee: 2026, mois: 0 }), '2026-01');
  assert.equal(anneeDepuisAdresse('2025'), 2025);
  assert.equal(anneeDepuisAdresse('25'), null);
  assert.equal(anneeDepuisAdresse('abcd'), null);
  assert.equal(anneeDepuisAdresse('9999'), null);
});

test('compléments d\'adresse : seules les clés connues aux valeurs bien formées passent', () => {
  assert.deepEqual(nettoyerQ('prevue=nouvelle&date=2026-09-14'), { prevue: 'nouvelle', date: '2026-09-14' });
  assert.deepEqual(nettoyerQ('prevue=abc-123_X'), { prevue: 'abc-123_X' });
  assert.deepEqual(nettoyerQ('edition'), { edition: '1' });
  assert.deepEqual(nettoyerQ('edition=1&fc=1'), { edition: '1', fc: '1' });
  assert.deepEqual(nettoyerQ('metrique=total_elevation_gain'), { metrique: 'total_elevation_gain' });
  // pièges : clé inconnue, valeur mal formée, doublon, injection
  assert.deepEqual(nettoyerQ('inconnue=1&__proto__=x&constructor=y'), {});
  assert.deepEqual(nettoyerQ('prevue=a b'), {});
  assert.deepEqual(nettoyerQ('prevue=<img src=x>'), {});
  assert.deepEqual(nettoyerQ('prevue=' + 'a'.repeat(65)), {});
  assert.deepEqual(nettoyerQ('date=2026-9-1'), {});
  assert.deepEqual(nettoyerQ('edition=oui'), {});
  assert.deepEqual(nettoyerQ('prevue=a&prevue=b'), { prevue: 'a' });
  assert.deepEqual(nettoyerQ({ prevue: 'x', zzz: 'y' }), { prevue: 'x' });
  assert.deepEqual(nettoyerQ(null), {});
});

test('analyserAdresse lit les compléments, construireAdresse les écrit', () => {
  const a = analyserAdresse('#/course/calendrier/2026-09?prevue=nouvelle&date=2026-09-14');
  assert.equal(a.chemin, '/calendrier');
  assert.equal(a.sous, '2026-09');
  assert.deepEqual(a.q, { prevue: 'nouvelle', date: '2026-09-14' });
  assert.equal(construireAdresse({ sport: 'course', page: '/calendrier', sous: '2026-09', q: a.q }), '#/course/calendrier/2026-09?prevue=nouvelle&date=2026-09-14');
  assert.equal(construireAdresse({ page: '/plan', q: { prevue: 'abc' } }), '#/plan?prevue=abc');
  assert.equal(construireAdresse({ q: { edition: '1' } }), '#/?edition=1');
  assert.equal(construireAdresse({ q: { zzz: '1', prevue: 'a b' } }), '#/'); // rien d'invalide n'est écrit
  assert.deepEqual(analyserAdresse('#/?edition').q, { edition: '1' });
  assert.equal(analyserAdresse('#/force?prevue=x').redirection, '#/muscu/programmes?prevue=x'); // l'ancien lien garde ses compléments
  assert.equal(analyserAdresse('#/sommeil?fc=1').q.fc, '1');
});

test('compléments d\'adresse : nuit, jour et feuille du téléphone', () => {
  assert.deepEqual(nettoyerQ('nuit=2026-10-13&jour=2026-10-14&feuille=plus'), { nuit: '2026-10-13', jour: '2026-10-14', feuille: 'plus' });
  assert.deepEqual(nettoyerQ('feuille=PLUS'), {});
  assert.deepEqual(nettoyerQ('nuit=hier'), {});
  assert.equal(construireAdresse({ page: '/sommeil', q: { nuit: '2026-10-13', fc: '1' } }), '#/sommeil?nuit=2026-10-13&fc=1');
});

test('adresse : ?exo= (exercice de la page Records) accepte une clé d\'exercice, ignore le reste', () => {
  assert.equal(construireAdresse({ sport: 'muscu', page: '/analyse', sous: 'records', q: { exo: 'squat' } }), '#/muscu/analyse/records?exo=squat');
  assert.equal(analyserAdresse('#/muscu/analyse/records?exo=perso-3f2a9c1e-0b7d-4c55-9a1e-6d2f8b4c7a10').q.exo, 'perso-3f2a9c1e-0b7d-4c55-9a1e-6d2f8b4c7a10');
  assert.deepEqual(analyserAdresse('#/analyse/records?exo=<img src=x>').q, {}); // forme invalide : ignorée
  assert.deepEqual(analyserAdresse('#/analyse/records?exo=a%20b').q, {});
});

test('adresse : ?seancejour= (séance du jour ouverte sur l\'accueil) accepte un identifiant, ignore le reste', () => {
  assert.equal(construireAdresse({ sport: 'muscu', q: { seancejour: 'demo-p0' } }), '#/muscu?seancejour=demo-p0');
  assert.equal(analyserAdresse('#/muscu?seancejour=3f2a9c1e-0b7d-4c55-9a1e-6d2f8b4c7a10').q.seancejour, '3f2a9c1e-0b7d-4c55-9a1e-6d2f8b4c7a10');
  assert.deepEqual(analyserAdresse('#/muscu?seancejour=<script>').q, {});
});
