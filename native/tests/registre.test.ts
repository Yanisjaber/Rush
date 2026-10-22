import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositionAuto, compositionSport, composerOnglet, estPertinent, existe, normaliserListe, LISTES_PAR_DEFAUT, ONGLETS_PERSONNALISABLES, ORDRE_ONGLET, TAILLES, TAILLES_ONGLET, WIDGETS } from '../src/data/registre.ts';
import { construireContexte } from '../src/data/contexte.ts';
import { donneesDemoAccueil } from '../src/data/accueil.ts';

test('existe : seuls les vrais widgets, pas les propriétés héritées', () => {
  assert.equal(existe('objectif'), true);
  assert.equal(existe('constructor'), false);
  assert.equal(existe('__proto__'), false);
  assert.equal(existe(null), false);
  assert.equal(existe(42), false);
});

test('registre : 38 widgets, chacun avec une taille par défaut permise', () => {
  const ids = Object.keys(WIDGETS);
  assert.equal(ids.length, 38);
  for (const id of ids) {
    const d = (WIDGETS as Record<string, { tailles: readonly string[]; taille: string }>)[id];
    assert.ok(d.tailles.includes(d.taille), id);
  }
});

test('estPertinent : un widget « tous sports » l\'est toujours, un widget de sport seulement pour ce sport', () => {
  assert.equal(estPertinent('forme', []), true);
  assert.equal(estPertinent('predictions', ['course']), true);
  assert.equal(estPertinent('predictions', ['velo']), false);
  assert.equal(estPertinent('inconnu', ['course']), false);
});

const ids = (familles: string[]) => compositionSport(familles).map((w) => w.id);
const nbTuiles = (familles: string[]) => compositionSport(familles).filter((w) => w.taille === 's').length;

test('compositionAuto : l\'écran « Tous » est le même pour tout le monde, quels que soient les sports', () => {
  const attendu = [['semaine', 'm'], ['aujourdhui', 'xs'], ['objectif', 's'], ['charge', 's'], ['forme', 'xs'], ['dernieres', 'xs'], ['regularite', 'm']];
  for (const familles of [[], ['course'], ['velo', 'natation'], ['muscu', 'hyrox'], ['aviron']]) {
    assert.deepEqual(compositionAuto(familles).map((w) => [w.id, w.taille]), attendu, familles.join());
  }
  for (const w of compositionAuto()) assert.ok((WIDGETS as Record<string, { tailles: readonly string[] }>)[w.id].tailles.includes(w.taille), w.id);
});

test('compositionAuto : chaque appel renvoie une copie (modifier l\'écran ne change pas la base)', () => {
  compositionAuto()[0].taille = 'l';
  assert.equal(compositionAuto()[0].taille, 'm');
});

test('compositionSport : la semaine en héros en premier, les dernières séances en dernier, jamais de doublon', () => {
  for (const familles of [[], ['course'], ['velo'], ['natation'], ['muscu'], ['course', 'natation'], ['course', 'velo', 'muscu', 'hyrox', 'natation'], ['triathlon']]) {
    const liste = ids(familles);
    assert.equal(liste[0], 'semaine', familles.join());
    assert.equal(liste.at(-1), 'dernieres', familles.join());
    assert.equal(new Set(liste).size, liste.length, `doublon pour ${familles.join()}`);
    assert.equal(nbTuiles(familles) % 2, 0, `une tuile seule sur sa ligne pour ${familles.join()}`);
  }
});

test('compositionSport : un coureur qui nage voit ses widgets de course et de natation, ni puissance ni muscu', () => {
  const liste = ids(['course', 'natation']);
  for (const voulu of ['predictions', 'efficacite', 'natvolume', 'natallure', 'volume']) assert.ok(liste.includes(voulu), voulu);
  for (const interdit of ['puissance', 'tonnage', 'records', 'seancedujour', 'hyroxallure']) assert.equal(liste.includes(interdit), false, interdit);
});

test('compositionSport : un cycliste n\'a ni prédiction de course ni natation', () => {
  const liste = ids(['velo']);
  assert.ok(liste.includes('puissance'));
  for (const interdit of ['predictions', 'efficacite', 'meilleures', 'natvolume', 'tonnage']) assert.equal(liste.includes(interdit), false, interdit);
});

test('compositionSport : la muscu seule a sa séance du jour, son tonnage, sa charge de muscu et pas de « À venir » en double', () => {
  const liste = ids(['muscu']);
  for (const voulu of ['seancedujour', 'tonnage', 'records', 'groupes', 'chargemuscu']) assert.ok(liste.includes(voulu), voulu);
  assert.equal(liste.includes('charge'), false);
  assert.equal(liste.includes('avenir'), false);
});

test('compositionSport : un seul sport a toute la place, trois sports ou plus n\'en ont qu\'un widget chacun', () => {
  assert.ok(ids(['course']).includes('meilleures'));
  const multi = ids(['course', 'natation', 'velo']);
  assert.ok(multi.includes('predictions') && multi.includes('natvolume') && multi.includes('puissance'));
  assert.equal(multi.includes('efficacite'), false);
  assert.equal(multi.includes('natallure'), false);
});

test('compositionSport : trail et VTT comptent comme course et vélo, triathlon donne course, vélo et natation', () => {
  assert.ok(ids(['trail']).includes('predictions'));
  assert.ok(ids(['vtt']).includes('puissance'));
  const tri = ids(['triathlon']);
  assert.ok(tri.includes('predictions') && tri.includes('puissance') && tri.includes('natvolume'));
});

test('compositionSport : un sport sans widget propre (aviron, ski…) reçoit le socle', () => {
  assert.deepEqual(ids(['aviron']), ids([]));
  assert.deepEqual(ids([]).slice(0, 3), ['semaine', 'avenir', 'objectif']);
});

test('compositionSport : chaque taille donnée est permise pour le widget', () => {
  for (const familles of [['course', 'muscu'], ['hyrox'], ['natation', 'velo']]) {
    for (const w of compositionSport(familles)) assert.ok((WIDGETS as Record<string, { tailles: readonly string[] }>)[w.id].tailles.includes(w.taille), `${w.id} ${w.taille}`);
  }
});

test('composerOnglet : Muscu et Hyrox ont leur composition fixe, en gardant la taille choisie', () => {
  const auto = compositionAuto(['muscu', 'hyrox']);
  assert.deepEqual(composerOnglet(auto, 'muscu').map((w) => w.id), [...ORDRE_ONGLET.muscu]);
  // Muscu : les tailles par défaut sont celles de TAILLES_ONGLET, même si « Tous » en a d'autres
  assert.deepEqual(composerOnglet(auto, 'muscu').map((w) => w.taille), ORDRE_ONGLET.muscu.map((id) => TAILLES_ONGLET.muscu[id]));
  assert.deepEqual(composerOnglet(auto, 'hyrox').map((w) => w.id), [...ORDRE_ONGLET.hyrox]);
});

test('composerOnglet : un sport sans onglet à lui (trail) met l\'objectif en premier, puis les widgets de ce sport', () => {
  const ids = composerOnglet(compositionSport(['course', 'velo']), 'trail').map((w) => w.id);
  assert.equal(ids[0], 'objectif');
  assert.ok(ids.indexOf('predictions') < ids.indexOf('forme'), 'les widgets de course passent avant les universels');
  assert.equal(ids.includes('puissance'), false);
});

test('composerOnglet : Course, Vélo et Natation ont leur propre liste, sinon leur composition automatique', () => {
  const tout = compositionAuto(['course']); // l'onglet « Tous » ne compte pas
  for (const sport of ['course', 'velo', 'natation']) {
    assert.deepEqual(composerOnglet(tout, sport), LISTES_PAR_DEFAUT[sport] ?? compositionSport([sport]));
    assert.ok(ONGLETS_PERSONNALISABLES.includes(sport));
  }
  const perso = { course: [{ id: 'kmhebdo', taille: 'm' as const }] };
  assert.deepEqual(composerOnglet(tout, 'course', perso), [{ id: 'kmhebdo', taille: 'm' }]);
  assert.deepEqual(composerOnglet(tout, 'velo', perso), LISTES_PAR_DEFAUT.velo); // la liste de la course ne touche pas au vélo
});

test('LISTES_PAR_DEFAUT : chaque liste ne contient que des widgets du sport ou pour tous, des tailles permises, sans doublon', () => {
  for (const [sport, liste] of Object.entries(LISTES_PAR_DEFAUT)) {
    assert.equal(new Set(liste.map((w) => w.id)).size, liste.length, sport);
    for (const w of liste) {
      assert.ok(estPertinent(w.id, [sport]), `${sport} : ${w.id}`);
      assert.ok((WIDGETS as Record<string, { tailles: readonly string[] }>)[w.id].tailles.includes(w.taille), `${sport} : ${w.id} ${w.taille}`);
    }
  }
  // Une copie à chaque appel : modifier le résultat ne change pas la liste par défaut
  composerOnglet([], 'course')[0].taille = 'xs';
  assert.equal(LISTES_PAR_DEFAUT.course[0].taille, 'm');
});

test('construireContexte : « Tous » ne filtre rien, un sport filtre séances et séances prévues', () => {
  const donnees = donneesDemoAccueil(new Date(2026, 9, 19));
  const tout = construireContexte(donnees, 'tout');
  assert.equal(tout.seances.length, donnees.seances.length);
  const course = construireContexte(donnees, 'course');
  assert.ok(course.seances.length > 0 && course.seances.length < donnees.seances.length);
  assert.ok(course.seances.every((s) => s.sport === 'Run'));
  assert.equal(course.toutesSeances.length, donnees.seances.length); // les calculs globaux gardent tout
  assert.ok(course.planifiees.every((p) => p.sport === 'Run'));
  assert.equal(course.hrMax, 196);
  assert.equal(course.filtre, 'course');
  assert.equal(course.hyrox.tests.length, 3);
  assert.equal(course.force.programmes.length, 3);
});

test('tailles : chaque widget a les quatre tailles, et chaque taille a sa hauteur fixe', async () => {
  const { HAUTEURS } = await import('../src/components/taille.ts');
  for (const [id, d] of Object.entries(WIDGETS)) assert.deepEqual([...(d as { tailles: readonly string[] }).tailles], ['xs', 's', 'm', 'l'], id);
  assert.deepEqual(Object.keys(TAILLES), ['xs', 's', 'm', 'l']);
  assert.deepEqual(Object.keys(HAUTEURS), ['xs', 's', 'm', 'l']);
  assert.ok(HAUTEURS.xs < HAUTEURS.s && HAUTEURS.s <= HAUTEURS.m && HAUTEURS.m < HAUTEURS.l);
});

test("normaliserListe : l'ancienne taille xl devient l, une taille inconnue revient à celle par défaut", () => {
  const r = normaliserListe([{ id: 'charge', taille: 'xl' }, { id: 'forme', taille: 'geant' }, { id: 'volume', taille: 'xs' }]);
  assert.deepEqual(r, [{ id: 'charge', taille: 'l' }, { id: 'forme', taille: WIDGETS.forme.taille }, { id: 'volume', taille: 'xs' }]);
});
