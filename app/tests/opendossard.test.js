import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliserLicences, nomLicence, licenceValide, normaliserResultats, resultatsManuels, fusionner, statistiques, parSaison, resultatDuJour, texteClassement, validerResultat, anneesDe } from '../src/lib/data/opendossard.js';

const od = (date, place, total = 40, nom = 'Course', extra = {}) => ({ date, nom, place, total, categorie: '', idCompetition: null, source: 'od', ...extra });

test('licences : liste ou { data }, champs bornés, éléments invalides ignorés', () => {
  const brut = { data: [{ id: 12, licenceNumber: '123', firstName: 'Yanis', lastName: 'Jaber', club: 'UV Toulouse', dept: '31' }, null, { nom: 'sans id' }] };
  const l = normaliserLicences(brut);
  assert.equal(l.length, 1);
  assert.deepEqual(l[0], { id: '12', numero: '123', prenom: 'Yanis', nom: 'Jaber', club: 'UV Toulouse', departement: '31' });
  assert.equal(nomLicence(l[0]), 'Yanis Jaber');
  assert.equal(nomLicence({ numero: '99' }), '99');
  assert.deepEqual(normaliserLicences(null), []);
  assert.equal(normaliserLicences([{ id: 1, club: 'x'.repeat(500) }])[0].club.length, 100);
});

test('licence relue du navigateur : revalidée', () => {
  assert.equal(licenceValide({ id: '12', nom: 'J' }), true);
  assert.equal(licenceValide({ id: '<img onerror=x>' }), false);
  assert.equal(licenceValide({ id: 12 }), false);
  assert.equal(licenceValide(null), false);
});

test('résultats : champs connus seulement, dates valides, texte jamais interprété', () => {
  const r = normaliserResultats({ results: [
    { date: '2026-09-20T00:00:00Z', competitionName: 'Cyclo <b>Test</b>', rankingScratch: '3', totalInCategory: 45, catev: '3', competitionId: 77, injecte: '<script>' },
    { date: 'pas une date', rankingScratch: 1 },
    { date: '2026-08-01', rankingScratch: 'abc' },
  ] });
  assert.equal(r.length, 2);
  assert.equal(r[0].date, '2026-09-20');
  assert.equal(r[0].place, 3);
  assert.equal(r[0].nom, 'Cyclo <b>Test</b>'); // conservé tel quel : Svelte l'affichera comme du texte
  assert.ok(!('injecte' in r[0]));
  assert.equal(r[1].place, null);
  assert.deepEqual(normaliserResultats(undefined), []);
});

test('fusion : un résultat saisi pour une date déjà officielle est un doublon', () => {
  const manuels = resultatsManuels([
    { id: 'a1', name: 'Local', start_date_local: '2026-09-20T09:00:00', result_place: 5, result_total: 30, result_catev: '4' },
    { id: 'a2', name: 'Autre', start_date_local: '2026-07-01T09:00:00', result_place: 2 },
    { id: 'a3', name: 'Sans résultat', start_date_local: '2026-06-01T09:00:00', result_place: null },
  ]);
  assert.equal(manuels.length, 2);
  const f = fusionner([od('2026-09-20', 3)], manuels);
  assert.deepEqual(f.map((r) => r.date), ['2026-09-20', '2026-07-01']);
  assert.equal(f[0].source, 'od');
});

test('statistiques : victoires, podiums, top 10, meilleur résultat, répartition, taux', () => {
  const rs = [od('2026-01-10', 1), od('2026-02-10', 2), od('2026-03-10', 8), od('2026-04-10', 20), od('2026-05-10', null), od('2025-06-10', 3)];
  const s = statistiques(rs, 2026);
  assert.equal(s.courses, 5);
  assert.equal(s.victoires, 1);
  assert.equal(s.podiums, 2);
  assert.equal(s.top10, 3);
  assert.equal(s.meilleur.place, 1);
  assert.deepEqual(s.repartition, { victoire: 1, podium: 1, top10: 1, autre: 2 });
  assert.equal(s.tauxTop10, 60);
  assert.equal(statistiques(rs, 'all').courses, 6);
  assert.deepEqual(statistiques([], 'all'), { courses: 0, victoires: 0, podiums: 0, top10: 0, meilleur: null, repartition: { victoire: 0, podium: 0, top10: 0, autre: 0 }, tauxTop10: 0 });
});

test('saison par saison et résultat du jour', () => {
  const rs = [od('2026-01-10', 1), od('2025-06-10', 3), od('2025-06-10', 7)];
  assert.deepEqual(parSaison(rs).map((s) => [s.annee, s.courses, s.podiums]), [[2026, 1, 1], [2025, 2, 1]]);
  assert.deepEqual(anneesDe(rs), [2026, 2025]);
  assert.equal(resultatDuJour(rs, '2025-06-10').place, 3);
  assert.equal(resultatDuJour(rs, '2024-01-01'), null);
  assert.equal(resultatDuJour(null, '2024-01-01'), null);
});

test('texte de classement', () => {
  assert.equal(texteClassement(od('2026-01-10', 1, 40, 'x', { categorie: 'Cat. 3' })), '1er / 40 · Cat. 3');
  assert.equal(texteClassement(od('2026-01-10', 12, null)), '12e');
  assert.equal(texteClassement(od('2026-01-10', null)), '');
  assert.equal(texteClassement(null), '');
});

test('résultat saisi : validation, place plus grande que les partants refusée, tout vide = effacer', () => {
  assert.deepEqual(validerResultat({ place: '', total: '', categorie: '' }).valeurs, { result_place: null, result_total: null, result_catev: null });
  assert.deepEqual(validerResultat({ place: '3', total: '45', categorie: '3' }).valeurs, { result_place: 3, result_total: 45, result_catev: '3' });
  assert.ok(validerResultat({ place: '0', total: '' }).erreurs.place);
  assert.ok(validerResultat({ place: '', total: '45' }).erreurs.place);
  assert.ok(validerResultat({ place: '50', total: '45' }).erreurs.total);
  assert.ok(validerResultat({ place: '3', total: 'x' }).erreurs.total);
  assert.ok(validerResultat({ place: '3', categorie: 'x'.repeat(31) }).erreurs.categorie);
});
