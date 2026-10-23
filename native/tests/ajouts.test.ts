import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliser } from '../src/data/structure.ts';
import { distanceEnMetres, estimerTss, formulaireCompetitionVide, formulaireNoteVide, formulaireSeanceVide, validerCompetition, validerNote, validerSeance, validerSortie, formulaireSortieVide, cleDuType, typeDeCle, chargeEstimee } from '../src/data/ajouts.ts';

const date = '2026-10-23';

test('estimerTss : durée et effort → charge, 0 sans durée', () => {
  assert.equal(estimerTss(60), 49); // 1 h à l'effort 5 : facteur d'intensité 0,45 + 0,05 × 5 = 0,7 ; 0,7² × 100 = 49
  assert.equal(estimerTss(30, 10), 45); // une demi-heure à fond : IF 0,95 → 0,5 × 0,9025 × 100
  assert.equal(estimerTss(0), 0);
});

test('validerSeance : une séance valide devient une ligne activity_planned', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), nom: ' Footing  facile ', type: 'Run', duree: '45', heure: '18:00', distance: '8,5' }, date, 'Course à pied');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.category, 'entrainement');
    assert.equal(r.ligne.name, 'Footing facile');
    assert.equal(r.ligne.start_date_local, '2026-10-23T18:00:00');
    assert.equal(r.ligne.duration, 45);
    assert.equal(r.ligne.km, 8.5);
    assert.equal(r.ligne.tss, estimerTss(45));
  }
});

test('validerSeance : sans nom, celui du sport ; la distance de natation se saisit en mètres', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Swim', duree: '40', distance: '2400' }, date, 'Natation');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.name, 'Natation');
    assert.equal(r.ligne.km, 2.4);
  }
  assert.equal(distanceEnMetres('Swim'), true);
  assert.equal(distanceEnMetres('Run'), false);
});

test('validerSeance : les valeurs hors bornes sont refusées avec un message', () => {
  const base = { ...formulaireSeanceVide(), duree: '30' };
  const refus = (f: Partial<typeof base>, d = date) => {
    const r = validerSeance({ ...base, ...f }, d, 'Course');
    assert.equal(r.ok, false);
    return r.ok ? '' : r.erreur;
  };
  assert.match(refus({ duree: '0' }), /durée/i);
  assert.match(refus({ duree: '1441' }), /durée/i);
  assert.match(refus({ duree: '12,5' }), /durée/i);
  assert.match(refus({ duree: 'abc' }), /durée/i);
  assert.match(refus({ heure: '25:00' }), /heure/i);
  assert.match(refus({ type: 'Piratage' }), /sport/i);
  assert.match(refus({ distance: '9999' }), /distance/i);
  assert.match(refus({ distance: '-3' }), /distance/i);
  assert.match(refus({ distance: 'beaucoup' }), /distance/i);
  assert.match(refus({ nom: 'x'.repeat(121) }), /nom/i);
  assert.match(refus({}, '2026-02-30'), /date/i);
});

test('validerCompetition : nom obligatoire, priorité A ou B, 9 h par défaut', () => {
  const r = validerCompetition({ ...formulaireCompetitionVide(), nom: 'Marathon', type: 'Run', priorite: 'A', epreuve: 'Route', distance: '42,195' }, date);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.category, 'competition');
    assert.equal(r.ligne.priority, 'A');
    assert.equal(r.ligne.type, 'Route');
    assert.equal(r.ligne.start_date_local, '2026-10-23T09:00:00');
    assert.equal(r.ligne.km, 42.195);
  }
  assert.equal(validerCompetition(formulaireCompetitionVide(), date).ok, false); // sans nom
  assert.equal(validerCompetition({ ...formulaireCompetitionVide(), nom: 'x', priorite: 'C' as 'A' }, date).ok, false);
  assert.equal(validerCompetition({ ...formulaireCompetitionVide(), nom: 'x', epreuve: 'y'.repeat(61) }, date).ok, false);
});

test('validerNote : une note veut un texte ; une maladie peut s\'en passer ; période et couleur contrôlées', () => {
  assert.equal(validerNote(formulaireNoteVide(date)).ok, false); // note sans texte
  const ok = validerNote({ ...formulaireNoteVide(date), texte: ' Genou raide ' });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.ligne, { type: 'texte', text: 'Genou raide', color: '#60a5fa', from_date: date, to_date: date });
  const maladie = validerNote({ ...formulaireNoteVide(date), type: 'maladie', a: '2026-10-26' });
  assert.ok(maladie.ok);
  if (maladie.ok) assert.equal(maladie.ligne.text, null);
  assert.equal(validerNote({ ...formulaireNoteVide(date), texte: 'x', a: '2026-10-22' }).ok, false); // fin avant début
  assert.equal(validerNote({ ...formulaireNoteVide(date), texte: 'x', a: '2027-03-01' }).ok, false); // plus de 90 jours
  assert.equal(validerNote({ ...formulaireNoteVide(date), texte: 'x', couleur: 'rouge' }).ok, false);
  assert.equal(validerNote({ ...formulaireNoteVide(date), texte: 'x'.repeat(501) }).ok, false);
  assert.equal(validerNote({ ...formulaireNoteVide(date), type: 'repos' as 'texte', texte: 'x' }).ok, false);
});

const AUJ = '2026-10-23';

test('validerSortie : une sortie valide devient une ligne activities saisie à la main', () => {
  const r = validerSortie({ ...formulaireSortieVide(), nom: 'Footing du matin', type: 'Run', heure: '07:30', heures: '0', minutes: '45', distance: '8,2', dplus: '60', fc: '148', rpe: 5, notes: ' RAS ' }, '2026-10-22', AUJ, 'Course');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.source, 'manual');
    assert.equal(r.ligne.moving_time, 2700);
    assert.equal(r.ligne.distance_km, 8.2);
    assert.equal(r.ligne.total_elevation_gain, 60);
    assert.equal(r.ligne.avg_heartrate, 148);
    assert.equal(r.ligne.rpe, 5);
    assert.equal(r.ligne.user_notes, 'RAS');
    assert.equal(r.ligne.start_date_local, '2026-10-22T07:30:00');
    assert.equal(r.ligne.tss, estimerTss(45, 5));
  }
});

test('validerSortie : sans nom, celui du sport ; la natation en mètres ; durée en heures et minutes', () => {
  const r = validerSortie({ ...formulaireSortieVide(), type: 'Swim', heures: '1', minutes: '5', distance: '2400' }, AUJ, AUJ, 'Natation');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.name, 'Natation');
    assert.equal(r.ligne.moving_time, 65 * 60);
    assert.equal(r.ligne.distance_km, 2.4);
  }
});

test('validerSortie : le futur, la durée et les bornes sont refusés avec un message', () => {
  const refus = (f: Partial<ReturnType<typeof formulaireSortieVide>>, d = '2026-10-22') => {
    const r = validerSortie({ ...formulaireSortieVide(), ...f }, d, AUJ, 'Course');
    assert.equal(r.ok, false);
    return r.ok ? '' : r.erreur;
  };
  assert.match(refus({}, '2026-10-24'), /futur/i);
  assert.match(refus({ heures: '0', minutes: '0' }), /durée/i);
  assert.match(refus({ minutes: '75' }), /minutes/i);
  assert.match(refus({ heures: '25', minutes: '0' }), /durée/i);
  assert.match(refus({ heures: '-1' }), /durée/i);
  assert.match(refus({ heure: '7h30' }), /heure/i);
  assert.match(refus({ distance: '9999' }), /distance/i);
  assert.match(refus({ dplus: '12,5' }), /dénivelé/i);
  assert.match(refus({ dplus: '31000' }), /dénivelé/i);
  assert.match(refus({ fc: '20' }), /cardiaque/i);
  assert.match(refus({ fc: '300' }), /cardiaque/i);
  assert.match(refus({ rpe: 11 }), /effort/i);
  assert.match(refus({ type: 'Piratage' }), /sport/i);
  assert.match(refus({ notes: 'x'.repeat(2001) }), /notes/i);
});

test('cleDuType / typeDeCle : les deux sens, « autre » pour l\'inconnu', () => {
  assert.equal(cleDuType('Ride'), 'velo');
  assert.equal(typeDeCle('natation'), 'Swim');
  assert.equal(cleDuType('Tennis'), 'autre');
  assert.equal(typeDeCle('inconnu'), 'Other');
});

test('validerSeance avec blocs : la durée et la charge viennent des blocs, la structure est écrite', () => {
  const blocs = normaliser([
    { type: 'warmup', work: { min: 10, int: 56, intHi: 75 } },
    { type: 'interval', reps: 5, metric: 'power', unit: 'zone', work: { min: 4, int: 91, intHi: 105 }, rec: { min: 2, int: 40, intHi: 55 } },
    { type: 'cooldown', work: { min: 10, int: 40, intHi: 55 } },
  ]);
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Ride', duree: '999' }, date, 'Cyclisme', blocs, { ftp: 250 });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.duration, 50); // la durée saisie (999) est ignorée : les blocs font 50 minutes
    assert.ok((r.ligne.tss ?? 0) > 30);
    assert.equal(r.ligne.structure?.length, 3);
    assert.ok((r.ligne.est_watts ?? 0) > 100);
  }
  // un sport sans structure (muscu) ignore les blocs et garde sa durée saisie
  const muscu = validerSeance({ ...formulaireSeanceVide(), type: 'WeightTraining', duree: '45' }, date, 'Muscu', blocs);
  assert.ok(muscu.ok);
  if (muscu.ok) {
    assert.equal(muscu.ligne.duration, 45);
    assert.equal(muscu.ligne.structure, undefined);
  }
});

test('validerSeance : dénivelé, effort estimé, charge saisie et notes', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), duree: '90', dplus: '850', rpe: 7, notes: ' Sortie en côtes ' }, date, 'Course');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.d_plus, 850);
    assert.equal(r.ligne.rpe, 7);
    assert.equal(r.ligne.notes, 'Sortie en côtes');
    assert.equal(r.ligne.tss, estimerTss(90, 7)); // l'effort estimé sert à estimer la charge
  }
  // une charge saisie à la main l'emporte sur l'estimation
  const saisi = validerSeance({ ...formulaireSeanceVide(), duree: '90', tss: '120,4' }, date, 'Course');
  assert.ok(saisi.ok);
  if (saisi.ok) assert.equal(saisi.ligne.tss, 120);
  const refus = (f: Partial<ReturnType<typeof formulaireSeanceVide>>) => {
    const x = validerSeance({ ...formulaireSeanceVide(), ...f }, date, 'Course');
    assert.equal(x.ok, false);
    return x.ok ? '' : x.erreur;
  };
  assert.match(refus({ dplus: '12,5' }), /dénivelé/i);
  assert.match(refus({ dplus: '31000' }), /dénivelé/i);
  assert.match(refus({ dplus: '-4' }), /dénivelé/i);
  assert.match(refus({ rpe: 11 }), /effort/i);
  assert.match(refus({ rpe: 0 }), /effort/i);
  assert.match(refus({ tss: '1500' }), /charge/i);
  assert.match(refus({ tss: 'beaucoup' }), /charge/i);
  assert.match(refus({ notes: 'x'.repeat(2001) }), /notes/i);
});

test('chargeEstimee : celle des blocs, sinon celle de la durée et de l\'effort, sinon rien', () => {
  const base = { ...formulaireSeanceVide(), duree: '60' };
  assert.equal(chargeEstimee(base), estimerTss(60, 5));
  assert.equal(chargeEstimee({ ...base, rpe: 8 }), estimerTss(60, 8));
  assert.equal(chargeEstimee({ ...base, duree: '' }), null); // durée pas encore lisible
  assert.equal(chargeEstimee({ ...base, duree: '0' }), null);
  const blocs = normaliser([{ type: 'steady', metric: 'power', unit: 'zone', work: { min: 30, int: 91, intHi: 105 } }]);
  assert.equal(chargeEstimee({ ...base, type: 'Ride', duree: '999' }, blocs, { ftp: 250 }), 48); // les blocs priment sur la durée saisie : 0,5 h à 98 % → 48,02 arrondi à 48
  assert.equal(chargeEstimee({ ...base, type: 'WeightTraining' }, blocs), estimerTss(60, 5)); // un sport sans structure ignore les blocs
});
