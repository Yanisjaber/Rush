import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserAdresse, construireAdresse, estSport, estPageSport, moisDepuisAdresse, moisVersAdresse, anneeDepuisAdresse } from '../src/lib/data/adresses.js';

test('estSport : sports connus oui, pages et pièges non', () => {
  for (const s of ['course', 'velo', 'muscu', 'hyrox', 'natation']) assert.equal(estSport(s), true, s);
  for (const s of ['autre', 'calendrier', 'bilan', 'constructor', '__proto__', '', null, undefined, 3]) assert.equal(estSport(s), false, String(s));
});

test('analyserAdresse : accueil, avec et sans sport', () => {
  assert.deepEqual(analyserAdresse(''), { chemin: '/', sport: null, sous: '', redirection: null });
  assert.deepEqual(analyserAdresse('#/'), { chemin: '/', sport: null, sous: '', redirection: null });
  assert.deepEqual(analyserAdresse('#/course'), { chemin: '/', sport: 'course', sous: '', redirection: null });
});

test('analyserAdresse : pages qui suivent le sport, avec détail', () => {
  assert.deepEqual(analyserAdresse('#/calendrier'), { chemin: '/calendrier', sport: null, sous: '', redirection: null });
  assert.deepEqual(analyserAdresse('#/velo/calendrier/2026-09'), { chemin: '/calendrier', sport: 'velo', sous: '2026-09', redirection: null });
  assert.deepEqual(analyserAdresse('#/muscu/bilan/2025'), { chemin: '/bilan', sport: 'muscu', sous: '2025', redirection: null });
  assert.equal(analyserAdresse('#/course/plan').chemin, '/plan');
  assert.equal(analyserAdresse('#/competitions').chemin, '/competitions');
});

test('analyserAdresse : vues détaillées Muscu et Hyrox', () => {
  assert.deepEqual(analyserAdresse('#/muscu/journal'), { chemin: '/', sport: 'muscu', sous: 'journal', redirection: null });
  assert.deepEqual(analyserAdresse('#/hyrox/tests'), { chemin: '/', sport: 'hyrox', sous: 'tests', redirection: null });
  // une vue qui n'existe pas pour ce sport : pas une vue détaillée
  assert.equal(analyserAdresse('#/course/journal').sous, '');
  assert.equal(analyserAdresse('#/hyrox/journal').sous, '');
});

test('analyserAdresse : pages sans sport inchangées', () => {
  assert.deepEqual(analyserAdresse('#/sommeil/graphiques'), { chemin: '/sommeil/graphiques', sport: null, sous: '', redirection: null });
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
