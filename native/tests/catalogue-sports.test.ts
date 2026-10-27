import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, couleurDuType, FAMILLES_PRINCIPALES, GROUPES_AUTRES, nomDuType, sportDuType } from '../src/data/catalogue-sports.ts';
import { familleSport } from '../src/data/familles.ts';
import { clair, sombre } from '../src/theme/couleurs.ts';

// Tous les types de sport de l'API Strava (sport_type) : aucun ne doit échapper au catalogue.
const TYPES_STRAVA = [
  'AlpineSki', 'BackcountrySki', 'Badminton', 'Canoeing', 'Crossfit', 'EBikeRide', 'Elliptical', 'EMountainBikeRide', 'Golf', 'GravelRide', 'Handcycle',
  'HighIntensityIntervalTraining', 'Hike', 'IceSkate', 'InlineSkate', 'Kayaking', 'Kitesurf', 'MountainBikeRide', 'NordicSki', 'Pickleball', 'Pilates',
  'Racquetball', 'Ride', 'RockClimbing', 'RollerSki', 'Rowing', 'Run', 'Sail', 'Skateboard', 'Snowboard', 'Snowshoe', 'Squash', 'StairStepper',
  'StandUpPaddling', 'Surfing', 'Swim', 'TableTennis', 'Tennis', 'TrailRun', 'Velomobile', 'VirtualRide', 'VirtualRow', 'VirtualRun', 'Walk',
  'WeightTraining', 'Wheelchair', 'Windsurf', 'Workout', 'Yoga',
];

test('catalogue : chaque type Strava a sa place dans le catalogue', () => {
  for (const t of TYPES_STRAVA) assert.ok(sportDuType(t), `${t} manque au catalogue`);
});

test('catalogue : les types propres à l\'app y sont aussi (Hyrox, Triathlon, Duathlon, Other)', () => {
  for (const t of ['Hyrox', 'Triathlon', 'Duathlon', 'Other']) assert.ok(sportDuType(t), t);
});

test('catalogue : un type n\'apparaît qu\'une fois, et chaque entrée est complète', () => {
  assert.equal(new Set(CATALOGUE.map((s) => s.type)).size, CATALOGUE.length);
  for (const s of CATALOGUE) {
    assert.ok(s.nom && s.court, s.type);
    assert.match(s.couleur.sombre, /^#[0-9a-f]{6}$/, s.type);
    assert.match(s.couleur.clair, /^#[0-9a-f]{6}$/, s.type);
  }
});

test('catalogue : une famille de la barre du haut, ou « autre » avec un groupe de la liste', () => {
  for (const s of CATALOGUE) {
    if (s.famille === 'autre') assert.ok(s.groupe && GROUPES_AUTRES.includes(s.groupe), `${s.type} : groupe`);
    else {
      assert.ok(FAMILLES_PRINCIPALES.includes(s.famille), `${s.type} : famille ${s.famille}`);
      assert.equal(s.groupe, null, s.type);
    }
  }
  for (const g of GROUPES_AUTRES) assert.ok(CATALOGUE.some((s) => s.groupe === g), `groupe vide : ${g}`);
});

test('familleSport suit le catalogue : le vélomobile est du vélo, les sous-sports sont dans « autre »', () => {
  assert.equal(familleSport('Velomobile'), 'velo');
  assert.equal(familleSport('Workout'), 'muscu');
  assert.equal(familleSport('Elliptical'), 'course');
  for (const s of CATALOGUE) assert.equal(familleSport(s.type), s.famille, s.type);
  for (const t of ['NordicSki', 'Rowing', 'Hike', 'Tennis', 'Other']) assert.equal(familleSport(t), 'autre', t);
});

test('catalogue : chaque sport a sa propre couleur, dans chaque thème', () => {
  for (const theme of ['sombre', 'clair'] as const) {
    const vues = new Map<string, string>();
    for (const s of CATALOGUE) {
      const c = s.couleur[theme];
      assert.ok(!vues.has(c), `${theme} : ${s.type} a la même couleur que ${vues.get(c)}`);
      vues.set(c, s.type);
    }
  }
});

test('catalogue : les 5 sports principaux gardent les couleurs de l\'app', () => {
  assert.equal(couleurDuType('Run', 'sombre'), sombre.sportCourse);
  assert.equal(couleurDuType('Ride', 'sombre'), sombre.sportVelo);
  assert.equal(couleurDuType('Swim', 'sombre'), sombre.sportNatation);
  assert.equal(couleurDuType('WeightTraining', 'clair'), clair.sportMuscu);
  assert.equal(couleurDuType('Hyrox', 'clair'), clair.sportHybride);
});

// Contraste WCAG d'une pastille de couleur sur le fond du thème (on exige 3:1, le minimum pour un élément d'interface)
const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('catalogue : chaque couleur se voit sur le fond de son thème (contraste d\'au moins 3:1)', () => {
  // Le jaune de Hyrox en thème clair est celui de l'app (theme/couleurs.ts) : il sert de pastille, le texte jaune a sa propre teinte (sportHybrideTexte)
  const echecs: string[] = [];
  for (const s of CATALOGUE) {
    const cs = contraste(s.couleur.sombre, sombre.surface);
    const cc = contraste(s.couleur.clair, clair.surface);
    if (cs < 3) echecs.push(`${s.type} sombre ${cs.toFixed(2)}`);
    if (cc < 3 && s.type !== 'Hyrox') echecs.push(`${s.type} clair ${cc.toFixed(2)}`);
  }
  assert.deepEqual(echecs, []);
});

test('nomDuType : le nom français, le type brut s\'il est inconnu, « Activité » s\'il n\'y a rien', () => {
  assert.equal(nomDuType('NordicSki'), 'Ski de fond');
  assert.equal(nomDuType('Workout'), 'Entraînement');
  assert.equal(nomDuType('Curling'), 'Curling');
  assert.equal(nomDuType(null), 'Activité');
  assert.equal(nomDuType(''), 'Activité');
});

test('couleurDuType : un type inconnu prend le gris neutre', () => {
  assert.equal(couleurDuType('Curling', 'sombre'), couleurDuType('Other', 'sombre'));
});

test('catalogue : le football existe (groupe « Raquettes et balles »), les autres sports collectifs (rugby, basket) restent « Autre sport » en gris', () => {
  assert.equal(sportDuType('Soccer')?.nom, 'Football');
  assert.equal(familleSport('Soccer'), 'autre');
  for (const t of ['Rugby', 'Basketball']) {
    assert.equal(sportDuType(t), null, t);
    assert.equal(couleurDuType(t, 'sombre'), couleurDuType('Other', 'sombre'), t);
    assert.equal(familleSport(t), 'autre', t);
  }
});
