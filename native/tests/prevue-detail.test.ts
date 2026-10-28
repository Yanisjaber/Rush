import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formulaireCompetitionVide, formulaireSeanceVide, prevueDepuisLigne, validerCompetition, validerSeance } from '../src/data/calendrier/ajouts.ts';
import { apercuDeGpx } from '../src/data/calendrier/apercu-import.ts';
import { chiffresPrevue } from '../src/data/calendrier/prevue-detail.ts';

const id = 'a1b2c3d4-0000-4000-8000-000000000001';
const libelles = (liste: { libelle: string }[]) => liste.map((c) => c.libelle);

test('chiffresPrevue : une séance donne sa durée, sa charge, sa distance et son allure prévue', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Run', duree: '75', distance: '13,5', dplus: '120', rpe: 7 }, '2026-10-29', 'Course à pied');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.deepEqual(libelles(c), ['Durée', 'Charge', 'Distance', 'Dénivelé +', 'Effort estimé', 'Allure prévue']);
  assert.equal(c[0].valeur, '1h15');
  assert.deepEqual([c[2].valeur, c[2].unite], ['13,5', 'km']);
});

test('chiffresPrevue : seuls les chiffres renseignés sont montrés, la natation est en mètres', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Swim', duree: '40', distance: '2400' }, '2026-10-29', 'Natation');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.ok(!libelles(c).includes('Dénivelé +'));
  assert.ok(!libelles(c).includes('Effort estimé'));
  const dist = c.find((x) => x.cle === 'distance');
  assert.deepEqual([dist?.valeur.replace(/\s/g, ' '), dist?.unite], ['2 400', 'm']); // l'espace des milliers est insécable
});

test('chiffresPrevue : une compétition donne son temps cible, son allure cible et ses infos d\'épreuve', () => {
  const r = validerCompetition({ ...formulaireCompetitionVide(), nom: 'Semi', type: 'Run', distance: '21,1', cible: '1h35', federation: 'FFA', niveau: 'Senior', tours: '1', rpe: 9, tss: '140' }, '2027-03-07');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.deepEqual(libelles(c), ['Temps cible', 'Distance', 'Allure cible', 'Fédération', 'Niveau', 'Tours', 'Charge estimée', 'Effort estimé']);
  assert.equal(c[0].valeur, '1h35');
});

test('chiffresPrevue : une ligne presque vide ne montre rien plutôt que des zéros', () => {
  const vide = prevueDepuisLigne(id, { category: 'entrainement', name: '', date: '2026-10-29', start_date_local: '', sport: 'Run', duration: null, tss: null, rpe: null, km: null, d_plus: null, notes: null });
  assert.deepEqual(chiffresPrevue(vide), []);
});

test('apercuDeGpx : la trace, la zone de carte et le profil d\'altitude d\'un parcours enregistré', () => {
  const gpx = '<gpx><trk><trkseg><trkpt lat="48.85" lon="2.35"><ele>40</ele></trkpt><trkpt lat="48.86" lon="2.36"><ele>60</ele></trkpt><trkpt lat="48.87" lon="2.37"><ele>50</ele></trkpt></trkseg></trk></gpx>';
  const a = apercuDeGpx(gpx);
  assert.ok(a);
  assert.equal(a?.trace.length, 3);
  assert.equal(a?.altitudeMin, 40);
  assert.equal(a?.altitudeMax, 60);
  assert.ok(a?.region && a.region.latitudeDelta > 0);
});

test('apercuDeGpx : un fichier vide ou à un seul point ne donne pas de carte', () => {
  assert.equal(apercuDeGpx(''), null);
  assert.equal(apercuDeGpx('<gpx><trk><trkseg><trkpt lat="48.85" lon="2.35"></trkpt></trkseg></trk></gpx>'), null);
});
