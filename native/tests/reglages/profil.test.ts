import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculerZones, sectionParId, validerSection, valeursDepuis, versPayload, estimerFtp, estimerFcMax, referenceCardio, persoValide, zonesDuProfil, zonesPersoDuProfil, bornesPourcent } from '../../src/data/reglages/profil.ts';

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
  // la forme récente (90 j) passe avant le record de tous les temps
  assert.equal(estimerFtp([{ duration_s: 1200, watts_90d: 246, watts_alltime: 300 }]), 234);
  assert.equal(estimerFtp([{ duration_s: 3600, watts_90d: 0, watts_alltime: 250 }]), 250);
  assert.equal(estimerFtp([]), null);
});

test('FC max estimée : les valeurs aberrantes sont ignorées', () => {
  const normales = Array.from({ length: 50 }, (_, i) => ({ max_heartrate: 180 + (i % 20) }));
  const avecParasite = [...normales, { max_heartrate: 233 }, { max_heartrate: 20 }];
  assert.equal(estimerFcMax(avecParasite), estimerFcMax(normales));
  assert.ok((estimerFcMax(avecParasite) as number) <= 200);
  assert.equal(estimerFcMax([{ max_heartrate: 190 }]), null);
});

test('cardio : 5 zones, avec la LTHR 189 de Yanis', () => {
  const z = calculerZones('cardio', 189)!;
  assert.equal(z.length, 5);
  assert.deepEqual(z.map((x) => x.nom.split(' ')[0]), ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  assert.equal(z[1].de, 153);
  assert.equal(z[4].de, 189);
});

test('zones perso : bornes en % de la référence, invalides ignorées', () => {
  assert.deepEqual(persoValide('cardio', [80, 90, 95, 100]), [80, 90, 95, 100]);
  assert.equal(persoValide('cardio', [80, 90, 95]), null); // pas le bon nombre
  assert.equal(persoValide('cardio', [80, 79, 95, 100]), null); // pas croissantes
  assert.equal(persoValide('cardio', [80, 90, 'x', 100]), null);
  const z = calculerZones('cardio', 200, [75, 85, 95, 105])!;
  assert.equal(z[1].de, 150);
  assert.equal(z[1].a, 168); // finit 1 point avant la zone suivante (85 % − 1)
  assert.equal(z[4].de, 210);
  // Sans perso valide, les zones par défaut
  assert.deepEqual(calculerZones('cardio', 200, [1, 2]), calculerZones('cardio', 200));
  assert.deepEqual(bornesPourcent('cardio', null), [0, 81, 90, 94, 100]);
});

test('zonesDuProfil : référence + perso du profil, FTP de la sortie à défaut', () => {
  const profil = { ftp: null, lthr: 189, hr_max: 200, extras: { threshold_speed: 11.5, zones_perso: { cardio: [80, 90, 95, 100], puissance: [1, 2] } } };
  assert.equal(zonesDuProfil('cardio', profil)![1].de, 151); // 80 % de 189
  assert.equal(zonesDuProfil('puissance', profil, 250)![1].de, 140); // perso de puissance invalide : défaut (56 % de 250)
  assert.equal(zonesDuProfil('puissance', profil), null); // pas de FTP du tout
  assert.equal(zonesDuProfil('allure', profil)![0].nom.startsWith('Z1'), true);
  assert.deepEqual(Object.keys(zonesPersoDuProfil(profil)), ['cardio']);
});
