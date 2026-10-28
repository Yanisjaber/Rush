import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE } from '../../src/data/sports/catalogue-sports.ts';
import { normaliser, sportAvecStructure } from '../../src/data/calendrier/structure.ts';
import { formulaireDepuisSortie, ligneDeModification, sortieModifiable, distanceEnMetres, estimerTss, formulaireCompetitionVide, formulaireNoteVide, formulaireSeanceVide, validerCompetition, validerNote, validerSeance, validerSortie, formulaireSortieVide, cleDuType, typeDeCle, chargeEstimee, chargeEstimeeSortie, typeInitial, SPORTS_AJOUT, blocsDePrevue, formulaireDepuisCompetition, formulaireDepuisSeance, parcoursDePrevue, prevueDepuisLigne, type LignePrevue } from '../../src/data/calendrier/ajouts.ts';
import type { PrevueComplete } from '../../src/data/types.ts';

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
  if (ok.ok) assert.deepEqual(ok.ligne, { type: 'texte', text: 'Genou raide', color: '#60a5fa', from_date: date, to_date: date, details: null });
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

test('validerSeance avec parcours GPX : le nom et le contenu sont joints, un faux fichier est refusé', () => {
  const contenu = '<gpx version="1.1"><trk><trkseg><trkpt lat="43.6" lon="1.44"></trkpt><trkpt lat="43.7" lon="1.44"></trkpt></trkseg></trk></gpx>';
  const ok = validerSeance(formulaireSeanceVide(), date, 'Course', [], {}, { nom: 'boucle.gpx', contenu });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.ligne.gpx_name, 'boucle.gpx');
    assert.equal(ok.ligne.gpx_content, contenu);
  }
  const sans = validerSeance(formulaireSeanceVide(), date, 'Course');
  assert.ok(sans.ok);
  if (sans.ok) assert.equal(sans.ligne.gpx_name, undefined); // sans parcours, les colonnes GPX ne sont pas écrites
  assert.equal(validerSeance(formulaireSeanceVide(), date, 'Course', [], {}, { nom: 'x.gpx', contenu: '<html></html>' }).ok, false);
  assert.equal(validerSeance(formulaireSeanceVide(), date, 'Course', [], {}, { nom: 'x.gpx', contenu: '' }).ok, false);
});

test('le sport choisi dans la barre du haut est pré-sélectionné dans la séance prévue', () => {
  assert.equal(formulaireSeanceVide('velo').type, 'Ride');
  assert.equal(formulaireSeanceVide('natation').type, 'Swim');
  assert.equal(typeInitial('tout'), 'Run');
  assert.equal(typeInitial('tout', ['natation', 'course']), 'Swim'); // sur « Tous » : le premier sport de la barre
  assert.equal(formulaireSeanceVide('tout', ['velo']).type, 'Ride');
  assert.equal(typeInitial('course', ['natation']), 'Run'); // un sport choisi l'emporte
  assert.equal(typeInitial('inconnu'), 'Run');
  assert.equal(formulaireSeanceVide().type, 'Run');
  assert.equal(formulaireSortieVide('velo').type, 'Ride');
  assert.equal(formulaireSortieVide('tout', ['muscu']).type, 'WeightTraining');
  assert.equal(formulaireCompetitionVide('natation').type, 'Swim');
  assert.equal(formulaireCompetitionVide('tout', ['velo']).type, 'Ride');
  assert.equal(formulaireCompetitionVide().type, 'Run');
});

test('activité déjà faite : la charge estimée suit la durée et l\'effort, et celle qu\'on tape l\'emporte', () => {
  const f = { ...formulaireSortieVide(), heures: '1', minutes: '0' };
  assert.equal(chargeEstimeeSortie(f), estimerTss(60, 5));
  assert.equal(chargeEstimeeSortie({ ...f, rpe: 8 }), estimerTss(60, 8));
  assert.equal(chargeEstimeeSortie({ ...f, heures: '0', minutes: '0' }), null); // durée illisible : pas d'estimation
  assert.equal(chargeEstimeeSortie({ ...f, minutes: '75' }), null);
  const estimee = validerSortie(f, '2026-10-20', '2026-10-23', 'Course');
  assert.ok(estimee.ok && estimee.ligne.tss === estimerTss(60, 5)); // vide : estimée
  const saisie = validerSortie({ ...f, tss: '123,6' }, '2026-10-20', '2026-10-23', 'Course');
  assert.ok(saisie.ok && saisie.ligne.tss === 124);
  for (const mauvais of ['-5', '1001', 'abc']) assert.equal(validerSortie({ ...f, tss: mauvais }, '2026-10-20', '2026-10-23', 'Course').ok, false, mauvais);
});

test('validerCompetition : tous les champs de l\'ancien site, bornés', () => {
  const date = '2027-04-18';
  const complete = { ...formulaireCompetitionVide(), nom: 'Marathon de Toulouse', type: 'Run', epreuve: 'Route', distance: '42,2', heure: '09:30', federation: 'FFA', niveau: 'SE', cible: '3h45', dplus: '120', tours: '1', tss: '310', rpe: 8, notes: ' Partir prudent ' };
  const r = validerCompetition(complete, date, { nom: 'trace.gpx', contenu: '<gpx></gpx>' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.start_date_local, '2027-04-18T09:30:00');
    assert.equal(r.ligne.target, '225'); // minutes, comme sur l'ancien site
    assert.equal(r.ligne.d_plus, 120);
    assert.equal(r.ligne.laps, 1);
    assert.equal(r.ligne.federation, 'FFA');
    assert.equal(r.ligne.race_level, 'SE');
    assert.equal(r.ligne.tri_format, null);
    assert.equal(r.ligne.tss, 310);
    assert.equal(r.ligne.rpe, 8);
    assert.equal(r.ligne.notes, 'Partir prudent');
    assert.equal(r.ligne.gpx_name, 'trace.gpx');
  }
  const vide = validerCompetition({ ...formulaireCompetitionVide(), nom: 'x' }, date);
  assert.ok(vide.ok);
  if (vide.ok) {
    assert.equal(vide.ligne.target, null);
    assert.equal(vide.ligne.federation, null);
    assert.equal('gpx_name' in vide.ligne, false); // sans parcours, aucune colonne GPX n'est écrite
  }
  const tri = validerCompetition({ ...formulaireCompetitionVide(), nom: 'x', type: 'Triathlon', federation: 'FFTri', format: 'M' }, date);
  assert.ok(tri.ok && tri.ligne.tri_format === 'M' && tri.ligne.federation === 'FFTri');
});

test('validerCompetition : refus des valeurs incohérentes', () => {
  const base = { ...formulaireCompetitionVide(), nom: 'x', type: 'Run' };
  const date = '2027-04-18';
  for (const [nom, f] of Object.entries({
    'heure': { heure: '25:00' },
    'fédération d\'un autre sport': { federation: 'FFC' },
    'format hors triathlon': { format: 'M' },
    'format inconnu': { type: 'Triathlon', format: 'XXL' },
    'temps cible illisible': { cible: 'bientôt' },
    'dénivelé négatif': { dplus: '-5' },
    'dénivelé décimal': { dplus: '12,5' },
    'tours à zéro': { tours: '0' },
    'charge trop haute': { tss: '1001' },
    'effort hors échelle': { rpe: 11 },
    'niveau trop long': { niveau: 'n'.repeat(61) },
    'notes trop longues': { notes: 'n'.repeat(2001) },
  })) assert.equal(validerCompetition({ ...base, ...f } as typeof base, date).ok, false, nom);
  assert.equal(validerCompetition(base, date, { nom: 'x.gpx', contenu: 'pas un gpx' }).ok, false); // GPX invalide
});

test('tous les sports du catalogue sont proposés : la saisie enregistre le vrai sport, pas « Autre »', () => {
  assert.equal(SPORTS_AJOUT.length, CATALOGUE.length);
  assert.equal(cleDuType('NordicSki'), 'autre'); // sans famille : l'onglet « Autres » de la barre du haut
  assert.equal(cleDuType('TrailRun'), 'course');
  assert.equal(typeDeCle('autre'), 'Other'); // le filtre « Autres » seul ne dit pas quel sous-sport
  assert.equal(typeDeCle('course'), 'Run');
  const r = validerSortie({ ...formulaireSortieVide(), type: 'NordicSki', heures: '1', minutes: '30', distance: '18' }, AUJ, AUJ, 'Ski de fond');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.ligne.sport, 'NordicSki');
    assert.equal(r.ligne.name, 'Ski de fond');
  }
  const s = validerSeance({ ...formulaireSeanceVide(), type: 'Rowing', duree: '45' }, date, 'Aviron', []);
  assert.ok(s.ok);
  if (s.ok) assert.equal(s.ligne.sport, 'Rowing');
});

test('les blocs restent réservés au vélo, à la course et à la natation (variantes comprises)', () => {
  for (const t of ['Run', 'TrailRun', 'Ride', 'GravelRide', 'EMountainBikeRide', 'Swim']) assert.equal(sportAvecStructure(t), true, t);
  for (const t of ['NordicSki', 'Rowing', 'WeightTraining', 'Hyrox', 'Triathlon']) assert.equal(sportAvecStructure(t), false, t);
});

// --- Rouvrir une séance prévue ou une compétition pour la modifier : ligne de la base → formulaire → ligne, sans rien perdre ---

const relue = (ligne: LignePrevue): PrevueComplete => prevueDepuisLigne('a1b2c3d4-0000-4000-8000-000000000001', ligne);

test('formulaireDepuisSeance : une séance rouverte puis réenregistrée donne la même ligne', () => {
  const depart = validerSeance({ ...formulaireSeanceVide(), nom: 'Footing du soir', type: 'Run', duree: '50', heure: '18:30', distance: '9,5', dplus: '80', rpe: 6, notes: 'Rester facile' }, date, 'Course à pied');
  assert.ok(depart.ok);
  if (!depart.ok) return;
  const f = formulaireDepuisSeance(relue(depart.ligne));
  assert.equal(f.distance, '9,5');
  assert.equal(f.heure, '18:30');
  assert.equal(f.tss, ''); // la charge était estimée : elle se réestime
  const encore = validerSeance(f, date, 'Course à pied');
  assert.ok(encore.ok);
  if (encore.ok) assert.deepEqual(encore.ligne, depart.ligne);
});

test('formulaireDepuisSeance : une charge saisie à la main est reprise, la natation se relit en mètres', () => {
  const main = validerSeance({ ...formulaireSeanceVide(), type: 'Swim', duree: '40', distance: '2400', tss: '55' }, date, 'Natation');
  assert.ok(main.ok);
  if (!main.ok) return;
  const f = formulaireDepuisSeance(relue(main.ligne));
  assert.equal(f.distance, '2400');
  assert.equal(f.tss, '55');
  const encore = validerSeance(f, date, 'Natation');
  assert.ok(encore.ok);
  if (encore.ok) assert.deepEqual(encore.ligne, main.ligne);
});

test('blocsDePrevue : les blocs reviennent tels qu\'ils ont été écrits, et un sport sans structure n\'en a pas', () => {
  const blocs = normaliser([
    { type: 'warmup', work: { min: 10, int: 56, intHi: 75 } },
    { type: 'interval', reps: 4, metric: 'pace', unit: 'zone', work: { min: 8, int: 91, intHi: 105 }, rec: { min: 2, int: 40, intHi: 55 } },
  ], 'pace');
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Run' }, date, 'Course', blocs, { ftp: 250 });
  assert.ok(r.ok);
  if (!r.ok) return;
  const lue = relue(r.ligne);
  assert.deepEqual(blocsDePrevue(lue), blocs);
  assert.deepEqual(blocsDePrevue({ ...lue, sport: 'WeightTraining' }), []);
  assert.deepEqual(blocsDePrevue({ ...lue, structure: null }), []);
});

test('formulaireDepuisCompetition : une compétition rouverte puis réenregistrée donne la même ligne', () => {
  const depart = validerCompetition({
    ...formulaireCompetitionVide(), nom: 'Semi de Paris', type: 'Run', priorite: 'B', epreuve: 'Route', distance: '21,1', heure: '09:30', federation: 'FFA', niveau: 'Senior', cible: '1h35', dplus: '85', tours: '1', tss: '140', rpe: 9, notes: 'Partir prudent',
  }, '2027-03-07', { nom: 'semi.gpx', contenu: '<gpx></gpx>' });
  assert.ok(depart.ok);
  if (!depart.ok) return;
  const lue = relue(depart.ligne);
  const f = formulaireDepuisCompetition(lue);
  assert.equal(f.cible, '1h35');
  assert.equal(f.priorite, 'B');
  assert.equal(f.heure, '09:30');
  assert.deepEqual(parcoursDePrevue(lue), { nom: 'semi.gpx', contenu: '<gpx></gpx>' });
  const encore = validerCompetition(f, '2027-03-07', parcoursDePrevue(lue));
  assert.ok(encore.ok);
  if (encore.ok) assert.deepEqual(encore.ligne, depart.ligne);
});

test('formulaireDepuisSeance / Competition : une ligne sans heure ni sport connu prend des valeurs par défaut valides', () => {
  const vide = relue({ category: 'entrainement', name: '', date, start_date_local: '', sport: 'Inconnu', duration: null, tss: null, rpe: null, km: null, d_plus: null, notes: null });
  const f = formulaireDepuisSeance(vide);
  assert.equal(f.heure, '12:00');
  assert.equal(f.type, 'Other'); // un sport inconnu ne devient pas « Course »
  assert.equal(formulaireDepuisCompetition({ ...vide, category: 'competition' }).heure, '09:00');
  assert.equal(formulaireDepuisCompetition({ ...vide, category: 'competition' }).type, 'Other');
});

test('formulaireDepuisSortie : une activité enregistrée redonne son formulaire, la charge seulement si elle a été saisie', () => {
  const base = { name: 'Footing', sport: 'Run', start_date_local: '2026-10-22T07:30:00', moving_time: 2700, distance_km: 8.2, total_elevation_gain: 60, avg_heartrate: 148, tss: estimerTss(45, 5), rpe: 5, user_notes: 'RAS' };
  const { date, f } = formulaireDepuisSortie(base);
  assert.equal(date, '2026-10-22');
  assert.deepEqual({ heure: f.heure, heures: f.heures, minutes: f.minutes, distance: f.distance, dplus: f.dplus, fc: f.fc, tss: f.tss, notes: f.notes }, { heure: '07:30', heures: '0', minutes: '45', distance: '8,2', dplus: '60', fc: '148', tss: '', notes: 'RAS' });
  assert.equal(formulaireDepuisSortie({ ...base, tss: 99 }).f.tss, '99'); // charge saisie à la main : reprise
  assert.equal(formulaireDepuisSortie({ ...base, sport: 'Swim', distance_km: 2.4 }).f.distance, '2400'); // natation en mètres
  assert.equal(formulaireDepuisSortie({ ...base, moving_time: 5400 }).f.heures, '1');
  // aller-retour : le formulaire relu se valide en la même ligne
  const r = validerSortie(f, date, '2026-10-30', 'Course');
  assert.ok(r.ok && r.ligne.moving_time === 2700 && r.ligne.distance_km === 8.2);
});

test('ligneDeModification : une valeur seulement arrondie par le formulaire garde sa valeur exacte', () => {
  const origine = { moving_time: 2731, avg_heartrate: 147.6, total_elevation_gain: 60.4 };
  const f = formulaireDepuisSortie({ name: 'x', sport: 'Run', start_date_local: '2026-10-22T07:30:00', ...origine, distance_km: 8, tss: 40, rpe: null, user_notes: null }).f;
  const r = validerSortie(f, '2026-10-22', '2026-10-30', 'Course');
  assert.ok(r.ok);
  if (!r.ok) return;
  const intacte = ligneDeModification(origine, r.ligne);
  assert.deepEqual([intacte.moving_time, intacte.avg_heartrate, intacte.total_elevation_gain], [2731, 147.6, 60.4]);
  // on change la durée et la FC : les nouvelles valeurs l'emportent, le dénivelé non touché reste exact
  const r2 = validerSortie({ ...f, minutes: '50', fc: '150' }, '2026-10-22', '2026-10-30', 'Course');
  assert.ok(r2.ok);
  if (!r2.ok) return;
  const changee = ligneDeModification(origine, r2.ligne);
  assert.deepEqual([changee.moving_time, changee.avg_heartrate, changee.total_elevation_gain], [3000, 150, 60.4]);
});

test('sortieModifiable : seulement une activité saisie à la main', () => {
  assert.equal(sortieModifiable({ source: 'manual' }), true);
  assert.equal(sortieModifiable({ source: 'strava' }), false);
  assert.equal(sortieModifiable({}), false);
});

test('validerNote : une ancienne note de plus de 90 jours reste modifiable tant qu\'on ne touche pas à sa période', () => {
  const longue = { ...formulaireNoteVide('2026-01-01'), texte: 'Pubalgie', a: '2026-06-30' };
  assert.equal(validerNote(longue).ok, false); // en création : trop longue
  assert.equal(validerNote(longue, { de: '2026-01-01', a: '2026-06-30' }).ok, true); // en modification, période inchangée
  assert.equal(validerNote({ ...longue, a: '2026-07-15' }, { de: '2026-01-01', a: '2026-06-30' }).ok, false); // période changée : la règle revient
});
