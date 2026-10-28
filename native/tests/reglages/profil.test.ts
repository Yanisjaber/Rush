import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculerZones, sectionParId, validerSection, valeursDepuis, versPayload, estimerFtp, referenceCardio } from '../../src/data/reglages/profil.ts';

const physio = sectionParId('physiologie')!;
const identite = sectionParId('identite')!;

test('validerSection : bornes, virgule décimale, champ obligatoire', () => {
  assert.equal(validerSection(physio, { ftp: '700' }).erreurs.ftp, 'Entre 50 et 600 W.');
  assert.equal(validerSection(physio, { ftp: '250' }).propres.ftp, 250);
  assert.equal(validerSection(identite, { weight: '72,5', first_name: 'Yanis' }).propres.weight, 72.5);
  assert.ok(validerSection(identite, { first_name: '' }).erreurs.first_name);
  assert.ok(validerSection(physio, { pace_5k: '4h30' }).erreurs.pace_5k);
  assert.equal(validerSection(physio, { last_ftp_test: '2999-01-01' }).erreurs.last_ftp_test, 'Date invalide (format AAAA-MM-JJ, pas dans le futur).');
});

test('versPayload : colonnes séparées des extras, extras des autres sections conservés', () => {
  const { propres } = validerSection(physio, { ftp: '250', hr_max: '190', vma: '17' });
  const { colonnes, extras } = versPayload(physio, propres, { first_name: 'Yanis', ancien: 1 });
  assert.equal(colonnes.ftp, 250);
  assert.equal(colonnes.hr_max, 190);
  assert.equal(extras.vma, 17);
  assert.equal(extras.first_name, 'Yanis');
  assert.equal(extras.ancien, 1);
});

test('valeursDepuis relit colonnes et extras', () => {
  const v = valeursDepuis({ ftp: 250, extras: { vma: 17.5 } }, physio);
  assert.equal(v.ftp, '250');
  assert.equal(v.vma, '17.5');
  assert.equal(v.hr_max, '');
});

test('zones : calculées, jamais sans référence', () => {
  assert.equal(calculerZones('puissance', null), null);
  const z = calculerZones('puissance', 200)!;
  assert.equal(z[3].nom, 'Z4 Seuil');
  assert.equal(z[3].de, 182);
  assert.equal(z[3].a, 210);
  assert.deepEqual(referenceCardio({ hr_max: 200 }), { bpm: 184, estimee: true });
  assert.deepEqual(referenceCardio({ lthr: 170, hr_max: 200 }), { bpm: 170, estimee: false });
  assert.equal(estimerFtp([{ duration_s: 1200, watts_alltime: 300 }]), 285);
});
