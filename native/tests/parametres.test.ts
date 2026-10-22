import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resumeParametres } from '../src/data/parametres.ts';

const ligne = { weight: 72.5, ftp: 250, hr_max: 196, lthr: null, extras: { first_name: 'Yanis', birth_date: '2000-01-01', sex: 'M', height: 180, vma: 17.5, threshold_speed: 15 } };

test('resumeParametres : un profil bien rempli donne âge, taille, poids, FC max, FTP et trois modèles de zones', () => {
  const r = resumeParametres({ ligne, nbSports: 3, nomsSports: ['Course à pied', 'Cyclisme', 'Hyrox'], strava: { last_sync_status: 'ok', athlete_name: 'Yanis J' } });
  assert.equal(r.prenom, 'Yanis');
  assert.equal(r.profil.unite, 'ans');
  assert.ok(Number(r.profil.valeur) >= 25);
  assert.equal(r.profil.note, '180 cm · 72,5 kg');
  assert.deepEqual([r.profil.remplis, r.profil.total], [5, 5]);
  assert.equal(r.physiologie.valeur, '196');
  assert.equal(r.physiologie.note, 'FTP 250 W · VMA 17,5');
  assert.deepEqual([r.physiologie.remplis, r.physiologie.total], [3, 5]); // FC max, FTP, VMA ; pas de FC repos ni de seuil
  assert.equal(r.zones.valeur, '3/3'); // la FC au seuil est estimée depuis la FC max
  assert.equal(r.zones.note, 'Puissance · Cardio · Allure');
  assert.equal(r.sports.valeur, '3');
  assert.equal(r.sports.note, 'Course à pied · Cyclisme …');
  assert.deepEqual(r.connexions, { etat: 'connecte', note: 'Strava · Yanis J' });
});

test('resumeParametres : un profil vide ne montre que des tirets et des jauges vides, sans planter', () => {
  const r = resumeParametres({ ligne: null, nbSports: 0, strava: null });
  assert.equal(r.prenom, '');
  assert.equal(r.profil.valeur, '—');
  assert.equal(r.physiologie.valeur, '—');
  assert.equal(r.zones.valeur, '—');
  assert.equal(r.sports.valeur, '—');
  assert.equal(r.profil.remplis, 0);
  assert.equal(r.connexions.etat, 'absente');
});

test('resumeParametres : sans date de naissance on montre le prénom ; un sport au singulier ; une erreur de synchro Strava', () => {
  const r = resumeParametres({ ligne: { extras: { first_name: 'Léa' } }, nbSports: 1, strava: { last_sync_status: 'error', athlete_name: null } });
  assert.equal(r.profil.valeur, 'Léa');
  assert.equal(r.profil.unite, undefined);
  assert.equal(r.sports.unite, 'sport');
  assert.equal(r.connexions.etat, 'erreur');
});
