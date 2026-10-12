import test from 'node:test';
import assert from 'node:assert/strict';
import { prioriteDe, nomPriorite, phaseDepuis, formeDepuisTsb, conseilPreparation, lireObjectif, texteObjectif, formulaireVide, formulaireDepuisLigne, validerCompetition, versLigne, repartir, prochainObjectif } from '../src/lib/data/competitions.js';

const bon = () => ({ ...formulaireVide('2026-12-13'), nom: 'Ronde de Ramonville' });

test('priorité : A, principal ou absente = Objectif ; le reste = Préparation', () => {
  for (const p of ['A', 'principal', null, undefined, '']) assert.equal(prioriteDe(p), 'A');
  for (const p of ['B', 'C', 'secondaire']) assert.equal(prioriteDe(p), 'B');
  assert.equal(nomPriorite('B'), 'Préparation');
});

test('phase : seuils de la v1, grosse fatigue = décharge', () => {
  assert.equal(phaseDepuis(3, 5), 'race');
  assert.equal(phaseDepuis(20, 5), 'taper');
  assert.equal(phaseDepuis(40, 5), 'peak');
  assert.equal(phaseDepuis(90, 5), 'build');
  assert.equal(phaseDepuis(3, -40), 'recovery');
  assert.equal(phaseDepuis(null, null), 'build');
});

test('forme et conseil', () => {
  assert.equal(formeDepuisTsb(12).texte, 'très frais');
  assert.equal(formeDepuisTsb(-25).ton, 'mauvais');
  assert.equal(formeDepuisTsb(null).texte, '—');
  assert.match(conseilPreparation('peak', -25), /Fatigue/);
  assert.match(conseilPreparation('taper', 0), /Affûtage/);
});

test('objectif : formats libres', () => {
  assert.equal(lireObjectif('1h45'), 105);
  assert.equal(lireObjectif('1:45:00'), 105);
  assert.equal(lireObjectif('1:45'), 105);
  assert.equal(lireObjectif('45 min'), 45);
  assert.equal(lireObjectif('45'), 45);
  assert.equal(lireObjectif('2h'), 120);
  assert.equal(lireObjectif('abc'), null);
  assert.equal(lireObjectif(''), null);
  assert.equal(texteObjectif(105), '1h45');
  assert.equal(texteObjectif(45), '45 min');
  assert.equal(texteObjectif(null), '');
});

test('validerCompetition : cas valide, champs vides = null, objectif converti', () => {
  const { valeurs, erreurs } = validerCompetition({ ...bon(), km: '10,15', dPlus: '42', objectif: '40' });
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.km, 10.15);
  assert.equal(valeurs.objectif, 40);
  assert.equal(valeurs.type, null);
});

test('validerCompetition : refuse les valeurs invalides champ par champ', () => {
  const r = validerCompetition({ ...bon(), nom: ' ', date: '2026-02-30', heure: '25:00', sport: 'Hack', priorite: 'Z', km: '9999', dPlus: '4.5', objectif: 'bientôt', notes: 'x'.repeat(2001), type: 'x'.repeat(61) });
  assert.equal(r.valeurs, null);
  for (const c of ['nom', 'date', 'heure', 'sport', 'priorite', 'km', 'dPlus', 'objectif', 'notes', 'type']) assert.ok(r.erreurs[c], c);
});

test('versLigne : jamais de user_id, catégorie competition, objectif en minutes', () => {
  const l = versLigne(validerCompetition({ ...bon(), objectif: '1h45' }).valeurs);
  assert.equal(l.category, 'competition');
  assert.equal(l.duration, 105);
  assert.equal(l.start_date_local, '2026-12-13T09:00:00');
  assert.ok(!('user_id' in l));
});

test('formulaireDepuisLigne : relit une ligne de la base, priorité normalisée', () => {
  const f = formulaireDepuisLigne({ name: 'Cyclo', date: '2026-11-01', start_date_local: '2026-11-01T08:30:00', sport: 'Ride', priority: 'principal', km: 80, d_plus: null, duration: 150 });
  assert.equal(f.heure, '08:30');
  assert.equal(f.priorite, 'A');
  assert.equal(f.objectif, '2h30');
  assert.equal(f.dPlus, '');
});

test('répartition et prochain objectif', () => {
  const liste = [
    { id: 1, date: '2026-12-13', priority: 'B' },
    { id: 2, date: '2026-10-01', priority: 'A' },
    { id: 3, date: '2027-03-01', priority: 'A' },
    { id: 4, date: '2026-10-12', priority: 'B' },
  ];
  const { aVenir, passees } = repartir(liste, '2026-10-12');
  assert.deepEqual(aVenir.map((c) => c.id), [4, 1, 3]);
  assert.deepEqual(passees.map((c) => c.id), [2]);
  assert.equal(prochainObjectif(aVenir).id, 3); // le premier « Objectif », même s'il est plus loin
  assert.equal(prochainObjectif([{ id: 9, priority: 'B', date: 'x' }]).id, 9);
  assert.equal(prochainObjectif([]), null);
  assert.deepEqual(repartir(null, '2026-10-12'), { aVenir: [], passees: [] });
});

test('GPX d\'une compétition : même règle que pour une séance prévue', () => {
  const l = versLigne(validerCompetition({ ...bon(), gpx: { nom: 'course.gpx', contenu: '<gpx/>' } }).valeurs);
  assert.equal(l.gpx_name, 'course.gpx');
  assert.ok(!('gpx_content' in versLigne(validerCompetition(bon()).valeurs)));
  assert.ok(validerCompetition({ ...bon(), gpx: { contenu: 42 } }).erreurs.gpx);
});
