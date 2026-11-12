import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bilanAthlete } from '../../src/data/reglages/bilan-athlete.ts';
import { ageDepuis, cartesDe, cartesIdentite, cartesPhysio, indexCarte, niveauDeNote, wattsParKilo, zonesProfil } from '../../src/data/profil/ecran-profil.ts';

const profil = { ftp: 285, hr_max: 192, lthr: 171, weight: 72, extras: { first_name: 'Yanis', last_name: 'J', birth_date: '2005-03-10', height: 181, sex: 'M', city: 'Toulouse', country: 'France', rhr: 48, vma: 17.5 } };
const jour = new Date(2026, 10, 13);

test('niveauDeNote : seuils 70 et 50, null = inconnu', () => {
  assert.equal(niveauDeNote(70), 'bon');
  assert.equal(niveauDeNote(69), 'moyen');
  assert.equal(niveauDeNote(50), 'moyen');
  assert.equal(niveauDeNote(49), 'bas');
  assert.equal(niveauDeNote(null), 'inconnu');
});

test('ageDepuis : anniversaire pas encore passé, date invalide, futur', () => {
  assert.equal(ageDepuis('2005-03-10', jour), 21);
  assert.equal(ageDepuis('2005-12-10', jour), 20);
  assert.equal(ageDepuis('2005-02-30', jour), null);
  assert.equal(ageDepuis('pas une date', jour), null);
  assert.equal(ageDepuis('2999-01-01', jour), null);
  assert.equal(ageDepuis(undefined, jour), null);
});

test('wattsParKilo : null si FTP ou poids manquent', () => {
  assert.equal(wattsParKilo({ ...profil, ftp: null }), null);
  assert.equal(wattsParKilo({ ...profil, weight: null }), null);
  assert.ok(Math.abs((wattsParKilo(profil) ?? 0) - 3.958) < 0.01);
});

test('zonesProfil : 4 zones, toutes avec une note quand le profil est rempli', () => {
  const bilan = bilanAthlete({ profil, aujourdhui: jour });
  const zones = zonesProfil(bilan, profil);
  assert.deepEqual(zones.map((z) => z.cle), ['coeur', 'torse', 'tete', 'jambes']);
  for (const z of zones) assert.ok(z.note !== null && z.note >= 0 && z.note <= 100, z.cle);
  assert.equal(zones.find((z) => z.cle === 'jambes')?.valeur, '3,96 W/kg');
  assert.equal(zones.find((z) => z.cle === 'coeur')?.valeur, 'FC max 192');
});

test('zonesProfil : sans aucune donnée, pas de note inventée', () => {
  const bilan = bilanAthlete({ profil: null, aujourdhui: jour });
  const zones = zonesProfil(bilan, null);
  for (const z of zones) {
    assert.equal(z.note, null);
    assert.equal(z.niveau, 'inconnu');
  }
});

test('cartesIdentite : âge, IMC, lieu ; champs vides = tirets', () => {
  const [moi, corps] = cartesIdentite(profil, jour);
  assert.equal(moi.chiffre, 'Yanis J');
  assert.equal(moi.lignes[0].valeur, '21 ans');
  assert.equal(moi.lignes[2].valeur, 'Toulouse, France');
  assert.equal(corps.chiffre, '72,0 kg');
  assert.equal(corps.lignes[1].valeur, '22,0');
  const vide = cartesIdentite(null, jour);
  assert.equal(vide[0].chiffre, 'Prénom à saisir');
  assert.equal(vide[1].chiffre, '—');
});

test('cartesPhysio : valeurs saisies, tirets sinon', () => {
  const [coeur, velo, course] = cartesPhysio(profil);
  assert.equal(coeur.lignes[1].valeur, '48 bpm');
  assert.equal(velo.chiffre, '285 W');
  assert.equal(course.chiffre, '17,5 km/h');
  assert.equal(cartesPhysio(null)[1].lignes[2].valeur, '—');
});

test('indexCarte : retrouve la carte d\'une zone, 0 si inconnue', () => {
  const bilan = bilanAthlete({ profil, aujourdhui: jour });
  assert.equal(indexCarte('physio', 'velo', bilan, profil), 1);
  assert.equal(indexCarte('physio', 'inconnue', bilan, profil), 0);
  assert.equal(cartesDe('niveau', bilan, profil).length, 2);
});
