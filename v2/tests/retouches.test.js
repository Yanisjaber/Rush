import test from 'node:test';
import assert from 'node:assert/strict';
import { cleRetouche, estManuelle, appliquer, appliquerTout, formulaireDepuisSortie, validerSortie, versLigneManuelle, retoucheDepuis } from '../src/lib/data/retouches.js';

const strava = { id: 'uuid-1', strava_id: 12345, name: 'Sortie du matin', sport: 'Ride', start_date_local: '2026-10-05T07:30:00+00:00', moving_time: 3600, distance_km: 30, total_elevation_gain: 200, tss: 55, rpe: null, user_notes: null, source: 'strava' };

test('clé de retouche : strava_id en texte, sinon identifiant ; sortie manuelle reconnue', () => {
  assert.equal(cleRetouche(strava), '12345');
  assert.equal(cleRetouche({ id: 'abc' }), 'abc');
  assert.equal(cleRetouche(null), null);
  assert.equal(estManuelle({ source: 'manual' }), true);
  assert.equal(estManuelle(strava), false);
});

test('appliquer : champs retouchés remplacés, original intact, valeurs invalides ignorées', () => {
  const r = appliquer(strava, { name: 'Sortie renommée', duration: 75, tss: 70, rpe: 7, notes: 'Bien roulé', sport: '', distance_km: 'x' });
  assert.equal(r.name, 'Sortie renommée');
  assert.equal(r.moving_time, 4500);
  assert.equal(r.tss, 70);
  assert.equal(r.rpe, 7);
  assert.equal(r.user_notes, 'Bien roulé');
  assert.equal(r.sport, 'Ride'); // chaîne vide ignorée
  assert.equal(r.distance_km, 30); // valeur non numérique ignorée
  assert.equal(r.retouchee, true);
  assert.equal(strava.name, 'Sortie du matin'); // l'original ne bouge pas
  assert.equal(appliquer(strava, null), strava);
});

test('appliquerTout : seules les sorties retouchées changent', () => {
  const autre = { id: 'u2', strava_id: 999, name: 'Autre' };
  const liste = appliquerTout([strava, autre], { 12345: { name: 'Neuf' } });
  assert.equal(liste[0].name, 'Neuf');
  assert.equal(liste[1], autre);
  assert.deepEqual(appliquerTout(null, {}), []);
  assert.equal(appliquerTout([strava], null)[0], strava);
  // une clé héritée du prototype n'est jamais prise pour une retouche
  assert.equal(appliquerTout([{ id: '__proto__', name: 'x' }], {})[0].name, 'x');
});

test('formulaire depuis une sortie puis validation : aller-retour cohérent', () => {
  const f = formulaireDepuisSortie(strava);
  assert.equal(f.nom, 'Sortie du matin');
  assert.equal(f.date, '2026-10-05');
  assert.equal(f.heure, '07:30');
  assert.equal(f.duree, '60');
  assert.equal(f.rpe, '');
  const { valeurs, erreurs } = validerSortie(f);
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.tss, 55);
  assert.equal(valeurs.duree, 60);
});

test('sortie manuelle : colonnes de activities, jamais de user_id', () => {
  const v = validerSortie({ ...formulaireDepuisSortie({ ...strava, name: 'Footing' }), sport: 'Run', duree: '45', tss: '', km: '8,5' }).valeurs;
  const l = versLigneManuelle(v);
  assert.equal(l.source, 'manual');
  assert.equal(l.category, 'entrainement');
  assert.equal(l.moving_time, 2700);
  assert.equal(l.distance_km, 8.5);
  assert.equal(l.start_date_local, '2026-10-05T07:30:00');
  assert.ok(l.tss > 0); // estimée quand elle est vide
  assert.ok(!('user_id' in l));
});

test('retoucheDepuis : seulement ce qui diffère de l\'original, null si rien ne change', () => {
  const memes = validerSortie(formulaireDepuisSortie(strava)).valeurs;
  assert.equal(retoucheDepuis(memes, strava), null);
  const f = { ...formulaireDepuisSortie(strava), nom: 'Renommée', rpe: '8', notes: 'Jambes lourdes' };
  const d = retoucheDepuis(validerSortie(f).valeurs, strava);
  assert.deepEqual(d, { name: 'Renommée', rpe: 8, notes: 'Jambes lourdes' });
  const dur = retoucheDepuis(validerSortie({ ...formulaireDepuisSortie(strava), duree: '90' }).valeurs, strava);
  assert.equal(dur.duration, 90);
});

test('une sortie déjà retouchée : le calcul se fait contre les valeurs d\'origine, pas contre les valeurs retouchées', () => {
  const retouchee = appliquer(strava, { name: 'Déjà renommée', rpe: 6 });
  assert.equal(retouchee.origine.name, 'Sortie du matin');
  // On ne touche qu'aux notes : le nom et l'effort déjà retouchés doivent rester dans la retouche
  const f = { ...formulaireDepuisSortie(retouchee), notes: 'Nouvelle note' };
  const d = retoucheDepuis(validerSortie(f).valeurs, retouchee);
  assert.deepEqual(d, { name: 'Déjà renommée', rpe: 6, notes: 'Nouvelle note' });
  // Tout remettre comme à l'origine : plus aucune retouche
  const retour = formulaireDepuisSortie(strava);
  assert.equal(retoucheDepuis(validerSortie(retour).valeurs, retouchee), null);
  assert.equal(strava.origine, undefined);
});
