import test from 'node:test';
import assert from 'node:assert/strict';
import { estimerTss, formulaireVide, formulaireDepuisLigne, validerPrevue, versLigne } from '../src/lib/data/prevue.js';

const bon = () => ({ ...formulaireVide('2026-10-20'), nom: 'Footing', duree: '45' });

test('estimerTss : 1 h à RPE 5 ≈ 49, plus dur = plus de charge, durée nulle = 0', () => {
  assert.equal(estimerTss(60, 5), 49);
  assert.ok(estimerTss(60, 9) > estimerTss(60, 5));
  assert.equal(estimerTss(0, 5), 0);
  assert.equal(estimerTss(60, 'x'), 49);
});

test('validerPrevue : formulaire correct, TSS estimé si vide, virgule décimale acceptée', () => {
  const { valeurs, erreurs } = validerPrevue({ ...bon(), km: '10,5' });
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.km, 10.5);
  assert.equal(valeurs.tss, estimerTss(45, null));
  assert.equal(valeurs.notes, null);
});

test('validerPrevue : refuse les valeurs invalides champ par champ', () => {
  const r = validerPrevue({ ...bon(), nom: '  ', date: '2026-02-30', heure: '25:00', sport: 'Hack', duree: '0', rpe: '11', tss: '-3', km: '9999', dPlus: 'abc', notes: 'x'.repeat(2001) });
  assert.equal(r.valeurs, null);
  for (const c of ['nom', 'date', 'heure', 'sport', 'duree', 'rpe', 'tss', 'km', 'dPlus', 'notes']) assert.ok(r.erreurs[c], c);
});

test('validerPrevue : nom trop long et durée non entière refusés', () => {
  assert.ok(validerPrevue({ ...bon(), nom: 'a'.repeat(121) }).erreurs.nom);
  assert.ok(validerPrevue({ ...bon(), duree: '45.5' }).erreurs.duree);
});

test('versLigne : jamais de user_id, date et heure combinées', () => {
  const l = versLigne(validerPrevue(bon()).valeurs);
  assert.equal(l.start_date_local, '2026-10-20T12:00:00');
  assert.equal(l.category, 'entrainement');
  assert.ok(!('user_id' in l));
});

test('formulaireDepuisLigne : relit une ligne de la base, sport inconnu → Workout', () => {
  const f = formulaireDepuisLigne({ name: 'Sortie', date: '2026-10-21', start_date_local: '2026-10-21T07:30:00', sport: 'Ride', duration: 90, tss: 62, rpe: null, km: 40, d_plus: null, notes: null });
  assert.equal(f.heure, '07:30');
  assert.equal(f.duree, '90');
  assert.equal(f.rpe, '');
  assert.equal(formulaireDepuisLigne({ sport: 'Bizarre' }).sport, 'Workout');
});
