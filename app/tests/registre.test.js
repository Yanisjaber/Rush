import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDGETS, ORDRE_ONGLET, existe, estPertinent, compositionAuto, composerOnglet, normaliser, disponibles, disponiblesOnglet, ONGLETS_PERSONNALISABLES } from '../src/lib/widgets/registre.js';

test("existe : seuls les vrais widgets sont reconnus (pas les propriétés héritées d'un objet)", () => {
  assert.equal(existe('objectif'), true);
  for (const piege of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'inconnu', null, undefined, 42, {}]) {
    assert.equal(existe(piege), false, `devrait refuser : ${String(piege)}`);
  }
});

test("compositionAuto : l'objectif en premier, widgets universels présents, automatique", () => {
  const c = compositionAuto(['course', 'velo']);
  assert.equal(c.auto, true);
  assert.equal(c.widgets[0].id, 'objectif');
  assert.ok(c.widgets.some((w) => w.id === 'charge'));
  // tailles par défaut respectées
  for (const w of c.widgets) assert.equal(w.taille, WIDGETS[w.id].taille);
});

test('estPertinent : un widget « tous sports » est toujours pertinent', () => {
  assert.equal(estPertinent('charge', []), true);
  assert.equal(estPertinent('inconnu', ['course']), false);
});

test('normaliser : retire les identifiants inconnus, les doublons et corrige les tailles', () => {
  const n = normaliser({
    auto: false,
    widgets: [
      { id: 'charge', taille: 'xl' },
      { id: 'charge', taille: 's' }, // doublon
      { id: 'forme', taille: 'xl' }, // taille interdite pour ce widget → taille par défaut
      { id: 'constructor', taille: 'm' }, // faux identifiant
      { id: '__proto__' },
      { id: 'objectif', taille: 'l' },
      null,
      'texte',
    ],
  });
  assert.deepEqual(n.widgets, [
    { id: 'charge', taille: 'xl' },
    { id: 'forme', taille: WIDGETS.forme.taille },
    { id: 'objectif', taille: 'l' },
  ]);
  assert.equal(n.auto, false);
});

test('normaliser : une disposition inutilisable devient null', () => {
  assert.equal(normaliser(null), null);
  assert.equal(normaliser('x'), null);
  assert.equal(normaliser({ widgets: 'pas un tableau' }), null);
  assert.equal(normaliser({}), null);
});

test('normaliser : plafonne le nombre de widgets lus', () => {
  const beaucoup = Array.from({ length: 500 }, () => ({ id: 'charge' }));
  assert.equal(normaliser({ widgets: beaucoup }).widgets.length, 1); // doublons retirés
});

test('disponibles : exclut les widgets déjà présents', () => {
  const d = compositionAuto([]);
  assert.deepEqual(disponibles({ widgets: [] }, []).sort(), Object.keys(WIDGETS).sort());
  const restants = disponibles({ widgets: [{ id: 'charge', taille: 'l' }] }, []);
  assert.equal(restants.includes('charge'), false);
  // Sans sport pratiqué, l'accueil automatique ne contient que les widgets universels : les widgets propres
  // à un sport restent disponibles dans la bibliothèque, mais pas composés d'office.
  const sportifs = disponibles(d, []).sort();
  assert.deepEqual(sportifs, [
    'chargeforce', 'chargemuscu', 'efficacite', 'groupes', 'hyroxallure', 'hyroxdossard', 'hyroxgains', 'hyroxtest',
    'meilleures', 'predictions', 'puissance', 'records', 'seancedujour', 'tonnage',
  ]);
  // Un coureur qui fait aussi du vélo voit ses widgets de course et de vélo composés automatiquement
  const coureur = compositionAuto(['course', 'velo']).widgets.map((w) => w.id);
  for (const id of ['predictions', 'efficacite', 'meilleures', 'puissance']) assert.ok(coureur.includes(id), id);
});

test("onglets riches : muscu et Hyrox ont leur composition, absente de l'onglet « Tout »", () => {
  const general = compositionAuto(['muscu', 'hyrox']).widgets.map((w) => w.id);
  for (const id of ['seancedujour', 'tonnage', 'chargemuscu', 'records', 'groupes', 'hyroxdossard', 'hyroxtest', 'hyroxallure', 'hyroxgains', 'chargeforce']) {
    assert.equal(general.includes(id), false, id);
    assert.ok(existe(id) && estPertinent(id, id.startsWith('hyrox') || id === 'chargeforce' ? ['hyrox'] : ['muscu']), id);
  }
  for (const sport of Object.keys(ORDRE_ONGLET)) {
    const onglet = composerOnglet(compositionAuto([sport]).widgets, sport);
    assert.deepEqual(onglet.map((w) => w.id), ORDRE_ONGLET[sport]);
    for (const w of onglet) assert.ok(WIDGETS[w.id].tailles.includes(w.taille), w.id);
  }
  assert.equal(composerOnglet([], 'muscu')[0].id, 'seancedujour'); // même sans disposition
});

test('onglet : la taille choisie est gardée, une taille invalide revient à celle par défaut', () => {
  const o = composerOnglet([{ id: 'tonnage', taille: 'l' }, { id: 'records', taille: 'zzz' }], 'muscu');
  assert.equal(o.find((w) => w.id === 'tonnage').taille, 'l');
  assert.equal(o.find((w) => w.id === 'records').taille, WIDGETS.records.taille);
});

test('onglet d\'un autre sport : widgets du sport d\'abord, puis ceux valables pour tous', () => {
  const o = composerOnglet(compositionAuto(['course', 'velo']).widgets, 'course').map((w) => w.id);
  assert.ok(o.includes('predictions'));
  assert.equal(o.includes('puissance'), false); // vélo seulement
  assert.ok(o.indexOf('predictions') < o.indexOf('charge'));
});

test("onglets personnalisables : Muscu et Hyrox ont leur propre composition, normalisée comme le reste", () => {
  assert.deepEqual([...ONGLETS_PERSONNALISABLES].sort(), ['hyrox', 'muscu']);
  const brut = {
    v: 1, auto: false, widgets: [{ id: 'charge', taille: 'l' }],
    onglets: {
      muscu: [{ id: 'tonnage', taille: 'l' }, { id: 'inconnu', taille: 'm' }, { id: 'tonnage', taille: 'm' }, { id: 'records', taille: 'zzz' }],
      course: [{ id: 'forme', taille: 's' }], // onglet sans composition propre : ignoré
      hyrox: 'pas une liste', // invalide : ignoré
    },
  };
  const n = normaliser(brut);
  assert.deepEqual(n.onglets.muscu, [{ id: 'tonnage', taille: 'l' }, { id: 'records', taille: WIDGETS.records.taille }]); // inconnu et doublon retirés, taille invalide remise par défaut
  assert.ok(!('course' in n.onglets) && !('hyrox' in n.onglets));
  assert.equal(normaliser({ v: 1, auto: true, widgets: [] }).onglets, undefined); // pas d'onglets enregistrés : rien d'inventé
});

test("composerOnglet : la composition personnalisée prime, sinon la composition par défaut", () => {
  const widgets = compositionAuto(['muscu']).widgets;
  const defaut = composerOnglet(widgets, 'muscu').map((w) => w.id);
  assert.deepEqual(defaut, ORDRE_ONGLET.muscu);
  const perso = { muscu: [{ id: 'records', taille: 'l' }, { id: 'tonnage', taille: 'm' }] };
  assert.deepEqual(composerOnglet(widgets, 'muscu', perso), perso.muscu);
  assert.notEqual(composerOnglet(widgets, 'muscu', perso)[0], perso.muscu[0]); // une copie : modifier le résultat ne modifie pas la source
  assert.deepEqual(composerOnglet(widgets, 'muscu', { muscu: null }).map((w) => w.id), ORDRE_ONGLET.muscu);
  assert.deepEqual(composerOnglet(widgets, 'hyrox', perso).map((w) => w.id), ORDRE_ONGLET.hyrox); // la composition d'un autre onglet ne le touche pas
});

test("disponiblesOnglet : seulement les widgets du sport (ou de tous les sports) qui ne sont pas déjà là", () => {
  // Hyrox : ses widgets et ceux de tous les sports. (L'onglet Muscu, lui, est limité à ses 7 widgets : voir le test dédié plus bas.)
  const dispo = disponiblesOnglet([{ id: 'hyroxtest', taille: 'l' }, { id: 'semaine', taille: 'l' }], 'hyrox');
  assert.ok(dispo.includes('hyroxdossard') && dispo.includes('avenir') && dispo.includes('dernieres')); // hyrox + tous sports
  assert.ok(!dispo.includes('hyroxtest') && !dispo.includes('semaine')); // déjà présents
  assert.ok(!dispo.includes('records') && !dispo.includes('predictions')); // d'autres sports
});

test("onglet d'un sport : le dossard d'objectif reste en premier, puis les widgets du sport, puis les autres", () => {
  const widgets = compositionAuto(['course']).widgets;
  const ids = composerOnglet(widgets, 'course').map((w) => w.id);
  assert.equal(ids[0], 'objectif');
  const iPred = ids.indexOf('predictions');
  const iCharge = ids.indexOf('charge');
  assert.ok(iPred > 0 && iPred < iCharge, 'les widgets de course passent avant les widgets généraux');
  assert.deepEqual([...ids].sort(), widgets.map((w) => w.id).sort()); // rien d'oublié ni ajouté
});

test('muscu : exactement les 7 widgets de la maquette, dans cet ordre, et rien d\'autre dans sa bibliothèque', () => {
  const sept = ['seancedujour', 'tonnage', 'dernieres', 'records', 'groupes', 'regularite', 'chargemuscu'];
  assert.deepEqual(ORDRE_ONGLET.muscu, sept);
  assert.equal(existe('programme'), false); // « Au programme » et « Séances de force » n'existent plus
  assert.equal(existe('force'), false);
  assert.deepEqual(composerOnglet([], 'muscu').map((w) => w.id), sept);
  // Bibliothèque de l'onglet Muscu : seulement ses propres widgets retirés (jamais Objectif, Charge, Forme, Volume…)
  assert.deepEqual(disponiblesOnglet([], 'muscu').sort(), [...sept].sort());
  assert.deepEqual(disponiblesOnglet(sept.slice(0, 5).map((id) => ({ id })), 'muscu').sort(), ['chargemuscu', 'regularite']);
  // Les autres onglets gardent leur bibliothèque habituelle
  assert.ok(disponiblesOnglet([], 'hyrox').includes('objectif'));
});
