import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelesDemo } from '../../src/data/demo/demo-modeles.ts';
import { blocsDuModele, cleDuModele, filtrerModeles, lignePrevueDepuisModele, resumeModele, sportsDesModeles, type Modele } from '../../src/data/calendrier/modeles.ts';

const demo = modelesDemo();
const parNom = (n: string) => demo.find((m) => m.name === n) as Modele;

test('cleDuModele : le type brut d\'abord, sinon la catégorie', () => {
  assert.equal(cleDuModele(parNom('Seuil 5 × 4 min')), 'velo');
  assert.equal(cleDuModele({ sport: 'musculation', sport_raw: null }), 'muscu');
  assert.equal(cleDuModele({ sport: 'vtt', sport_raw: 'MountainBikeRide' }), 'velo'); // un ancien modèle de VTT : du vélo
  assert.equal(cleDuModele({ sport: 'inconnu', sport_raw: null }), 'autre');
});

test('filtrerModeles : par sport et par recherche (sans accent ni majuscule), triés par nom', () => {
  assert.deepEqual(filtrerModeles(demo, '', 'velo').map((m) => m.name), ['Endurance longue', 'Seuil 5 × 4 min']);
  assert.deepEqual(filtrerModeles(demo, 'PYRAMIDE').map((m) => m.name), ['Pyramide 10 km']);
  assert.deepEqual(filtrerModeles(demo, 'educatifs').map((m) => m.name), ['Natation technique']); // trouve « Éducatifs » dans la description
  assert.equal(filtrerModeles(demo, 'zzz').length, 0);
  assert.equal(filtrerModeles(demo, '', 'tous').length, demo.length);
});

test('sportsDesModeles : seulement ceux qui ont un modèle, dans l\'ordre de l\'app', () => {
  assert.deepEqual(sportsDesModeles(demo), ['course', 'velo', 'natation', 'muscu']);
});

test('resumeModele : durée, charge, distance, blocs', () => {
  assert.equal(resumeModele(parNom('Seuil 5 × 4 min')), '50 min · 55 pts · par blocs');
  assert.equal(resumeModele(parNom('Endurance longue')), '150 min · 110 pts · 70 km · par blocs');
  assert.equal(resumeModele(parNom('Haut du corps')), '60 min · 45 pts');
});

test('lignePrevueDepuisModele : un modèle à blocs prend sa durée et sa charge des blocs', () => {
  const l = lignePrevueDepuisModele(parNom('Seuil 5 × 4 min'), '2026-10-24', '18:00', { ftp: 250 });
  assert.equal(l.category, 'entrainement');
  assert.equal(l.sport, 'Ride');
  assert.equal(l.start_date_local, '2026-10-24T18:00:00');
  assert.equal(l.duration, 50); // 10 + 5 × (4 + 2) + 10
  assert.ok(Array.isArray(l.structure) && l.structure.length === 3);
  assert.ok((l.tss ?? 0) > 30);
  assert.ok((l.est_watts ?? 0) > 100);
});

test('lignePrevueDepuisModele : sans blocs, la durée et la charge du modèle ; sans rien, 60 minutes estimées', () => {
  const force = lignePrevueDepuisModele(parNom('Haut du corps'), '2026-10-24');
  assert.equal(force.duration, 60);
  assert.equal(force.tss, 45);
  assert.equal(force.structure, null);
  assert.equal(force.start_date_local, '2026-10-24T12:00:00');
  const vide = lignePrevueDepuisModele({ id: 'x', sport: 'autre', sport_raw: 'Piratage', name: '', duration_min: null, tss: null, description: null, rpe: null, distance_km: null, dplus: null, structure: 'pas un tableau' }, '2026-10-24');
  assert.equal(vide.sport, 'Other');
  assert.equal(vide.name, 'Séance');
  assert.equal(vide.duration, 60);
  assert.ok((vide.tss ?? 0) > 0);
  assert.equal(vide.structure, null);
});

test('blocsDuModele : une structure absurde donne des blocs propres ou une liste vide', () => {
  assert.equal(blocsDuModele({ structure: null, sport: 'cyclisme', sport_raw: 'Ride' }).length, 0);
  assert.equal(blocsDuModele({ structure: [{ type: 'x', work: { min: -4, int: 'a' } }], sport: 'cyclisme', sport_raw: 'Ride' })[0].type, 'steady');
});
