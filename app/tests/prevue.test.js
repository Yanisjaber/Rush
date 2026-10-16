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

test('formulaireDepuisLigne : relit une ligne de la base, sport inconnu → Other', () => {
  const f = formulaireDepuisLigne({ name: 'Sortie', date: '2026-10-21', start_date_local: '2026-10-21T07:30:00', sport: 'Ride', duration: 90, tss: 62, rpe: null, km: 40, d_plus: null, notes: null });
  assert.equal(f.heure, '07:30');
  assert.equal(f.duree, '90');
  assert.equal(f.rpe, '');
  assert.equal(formulaireDepuisLigne({ sport: 'Bizarre' }).sport, 'Other');
});

test('validerPrevue : avec structure, durée, charge et estimations viennent des blocs', () => {
  const structure = [{ type: 'steady', name: 'Bloc', reps: 1, metric: 'power', unit: 'pct', work: { min: 60, int: 100, intHi: null } }];
  const { valeurs, erreurs } = validerPrevue({ ...bon(), sport: 'Ride', duree: '', tss: '', structure }, { ftp: 250 });
  assert.deepEqual(erreurs, {});
  assert.equal(valeurs.duree, 60);
  assert.equal(valeurs.tss, 100);
  const l = versLigne(valeurs);
  assert.equal(l.structure.length, 1);
  assert.equal(l.est_kj, 900);
  assert.equal(l.est_watts, 250);
});

test('validerPrevue : une structure est ignorée pour un sport qui n\'en a pas (muscu)', () => {
  const structure = [{ type: 'steady', work: { min: 60, int: 100 } }];
  const { valeurs } = validerPrevue({ ...bon(), sport: 'WeightTraining', structure });
  assert.equal(valeurs.structure.length, 0);
  assert.equal(versLigne(valeurs).structure, null);
});

test('GPX : inchangé = rien d\'écrit, retrait = colonnes à null, nouveau parcours = nom et contenu, contenu invalide refusé', () => {
  const base = { ...formulaireVide('2026-10-20'), nom: 'Sortie' };
  assert.ok(!('gpx_content' in versLigne(validerPrevue(base).valeurs))); // on ne touche pas au parcours existant
  const retrait = versLigne(validerPrevue({ ...base, gpx: null }).valeurs);
  assert.equal(retrait.gpx_content, null);
  assert.equal(retrait.gpx_name, null);
  const ajout = versLigne(validerPrevue({ ...base, gpx: { nom: 'col.gpx', contenu: '<gpx></gpx>' } }).valeurs);
  assert.equal(ajout.gpx_name, 'col.gpx');
  assert.equal(ajout.gpx_content, '<gpx></gpx>');
  assert.ok(validerPrevue({ ...base, gpx: { nom: 'x', contenu: '' } }).erreurs.gpx);
  assert.ok(validerPrevue({ ...base, gpx: 'pas un objet' }).erreurs.gpx);
  assert.ok(validerPrevue({ ...base, gpx: { nom: 'x', contenu: 'a'.repeat(5 * 1024 * 1024 + 1) } }).erreurs.gpx);
});

test('sportsTries et sportDefaut : le sport filtré passe en premier et devient le sport proposé', async () => {
  const { sportsTries, sportDefaut, SPORTS_PREVUE } = await import('../src/lib/data/prevue.js');
  assert.deepEqual(sportsTries('tout'), SPORTS_PREVUE);
  assert.deepEqual(sportsTries('velo').slice(0, 1).map((s) => s.type), ['Ride']);
  assert.equal(sportsTries('course')[1].type, 'TrailRun'); // course et trail ensemble
  assert.equal(sportsTries('muscu').length, SPORTS_PREVUE.length); // rien ne disparaît
  assert.equal(sportDefaut('muscu'), 'WeightTraining');
  assert.equal(sportDefaut('hyrox'), 'Hyrox');
  assert.equal(sportDefaut('tout'), 'Run');
  assert.equal(sportDefaut('escalade'), 'Run'); // sport sans type prévu : la course par défaut
});

test('discipline : seulement pour l\'athlétisme, seulement une vraie discipline, jamais du texte libre', () => {
  const athle = { ...bon(), sport: 'Athletics', discipline: '400m' };
  const r = validerPrevue(athle);
  assert.equal(r.valeurs.discipline, '400m');
  assert.equal(versLigne(r.valeurs).discipline, '400m');
  // sans discipline choisie : null (la colonne reste vide)
  assert.equal(validerPrevue({ ...athle, discipline: '' }).valeurs.discipline, null);
  assert.equal(versLigne(validerPrevue({ ...athle, discipline: '' }).valeurs).discipline, null);
  // une clé qui n'existe pas (ou du texte libre, ou une tentative d'injection) est refusée
  for (const faux of ['100m-inconnu', 'DROP TABLE', "x'; --", '../..', '<img src=x onerror=1>']) {
    const e = validerPrevue({ ...athle, discipline: faux });
    assert.equal(e.valeurs, null, faux);
    assert.ok(e.erreurs.discipline, faux);
  }
  // un autre sport ignore la discipline et n'envoie jamais la colonne
  const course = validerPrevue({ ...bon(), sport: 'Run', discipline: '400m' });
  assert.equal(course.valeurs.discipline, null);
  assert.equal(Object.hasOwn(versLigne(course.valeurs), 'discipline'), false);
  // relue depuis la base
  assert.equal(formulaireDepuisLigne({ sport: 'Athletics', discipline: 'hauteur', name: 'x', date: '2026-10-20' }).discipline, 'hauteur');
  assert.equal(formulaireDepuisLigne({ sport: 'Run', name: 'x', date: '2026-10-20' }).discipline, '');
});
