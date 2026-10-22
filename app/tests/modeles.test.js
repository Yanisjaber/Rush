import test from 'node:test';
import assert from 'node:assert/strict';
import { categorieDe, formulaireDepuisModele, modeleDepuisValeurs, grouper, resume } from '../src/lib/data/modeles.js';
import { validerPrevue, formulaireVide } from '../src/lib/data/prevue.js';

const structure = [{ type: 'steady', name: 'Bloc', reps: 1, metric: 'power', unit: 'pct', work: { min: 60, int: 100, intHi: null } }];

test('catégorie : vélo (VTT compris), course (trail compris), natation, muscu, autre', () => {
  assert.equal(categorieDe('Ride'), 'cyclisme');
  assert.equal(categorieDe('MountainBikeRide'), 'cyclisme');
  assert.equal(categorieDe('Run'), 'course');
  assert.equal(categorieDe('TrailRun'), 'course');
  assert.equal(categorieDe('Swim'), 'natation');
  assert.equal(categorieDe('WeightTraining'), 'musculation');
  assert.equal(categorieDe('Yoga'), 'autre');
});

test('modèle → formulaire : champs repris, structure nettoyée, sport brut ou déduit de la catégorie', () => {
  const f = formulaireDepuisModele({ name: 'Seuil 2×20', sport: 'cyclisme', sport_raw: 'Ride', duration_min: 90, tss: 88, rpe: 7, distance_km: null, dplus: null, description: 'Sur home-trainer', structure: [...structure, { type: 'hack' }] }, '2026-10-20');
  assert.equal(f.nom, 'Seuil 2×20');
  assert.equal(f.date, '2026-10-20');
  assert.equal(f.sport, 'Ride');
  assert.equal(f.duree, '90');
  assert.equal(f.km, '');
  assert.equal(f.notes, 'Sur home-trainer');
  assert.equal(f.structure.length, 2);
  assert.equal(f.structure[1].type, 'steady'); // type inconnu ramené à un bloc continu : jamais de valeur dangereuse
  assert.equal(formulaireDepuisModele({ name: 'x', sport: 'course' }, '2026-10-20').sport, 'Run');
  assert.equal(formulaireDepuisModele({ name: 'x', sport: 'bizarre', sport_raw: 'Piratage' }, '2026-10-20').sport, 'Other');
});

test('formulaire → modèle : jamais de user_id, estimations copiées, structure vide = null', () => {
  const { valeurs } = validerPrevue({ ...formulaireVide('2026-10-20'), nom: 'Endurance', sport: 'Ride', structure }, { ftp: 250 });
  const m = modeleDepuisValeurs(valeurs);
  assert.equal(m.name, 'Endurance');
  assert.equal(m.sport, 'cyclisme');
  assert.equal(m.sport_raw, 'Ride');
  assert.equal(m.duration_min, 60);
  assert.equal(m.tss, 100);
  assert.equal(m.est_kj, 900);
  assert.equal(m.structure.length, 1);
  assert.ok(!('user_id' in m));
  const simple = modeleDepuisValeurs(validerPrevue({ ...formulaireVide('2026-10-20'), nom: 'Footing', sport: 'Run' }).valeurs);
  assert.equal(simple.structure, null);
  assert.equal(simple.est_kj, null);
});

test('regroupement : par catégorie, recherche sans accents, tri par nom, groupes vides masqués', () => {
  const liste = [
    { id: 1, name: 'Fractionné court', sport: 'course', description: null },
    { id: 2, name: 'Endurance', sport: 'course', description: 'Footing léger' },
    { id: 3, name: 'Sortie longue', sport: 'cyclisme', description: null },
    { id: 4, name: 'Étrange', sport: 'inconnue', description: null },
  ];
  const g = grouper(liste);
  assert.deepEqual(g.map((x) => x.nom), ['Autre', 'Course à pied', 'Cyclisme']);
  assert.deepEqual(g.find((x) => x.cle === 'course').modeles.map((m) => m.id), [2, 1]);
  assert.deepEqual(grouper(liste, 'FRACTIONNE').map((x) => x.cle), ['course']);
  assert.deepEqual(grouper(liste, 'leger').flatMap((x) => x.modeles.map((m) => m.id)), [2]); // cherche aussi dans la description
  assert.deepEqual(grouper([], 'x'), []);
  assert.deepEqual(grouper(null), []);
});

test('résumé d\'un modèle', () => {
  assert.equal(resume({ duration_min: 55, tss: 48, distance_km: 10.5, structure: structure }), '55 min · 48 TSS · 10,5 km · par blocs');
  assert.equal(resume({}), '');
});
