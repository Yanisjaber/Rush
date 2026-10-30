import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compterSortiesCourse, estimerCourse, sortiesCourse, statutCourse, type EstimationCourse, type SeanceCourse, type SortieCourse } from '../../src/data/bilan/progression-course.ts';
import { allureAuDenivele, cascadeCourse, geometrieNuageCourse, graduationsAllure } from '../../src/data/bilan/progression-course-affichage.ts';

const AUJOURDHUI = new Date(2026, 9, 28);
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Un bruit fixe (pas de hasard : le test doit toujours donner le même résultat), en secondes par km
const BRUIT = [-6, 3, -2, 5, 0, -4, 2, 4, -3, 1];
const sortie = (avant: number, allure: number, fc: number, denivele: number, tapis = false): SortieCourse => ({ date: `${jour(avant)}T08:00:00`, allure, fc, denivele, tapis });
const periodeActuelle = (d: string): boolean => d >= jour(28) && d <= `${jour(0)}T23:59:59`;
const periodeAvant = (d: string): boolean => d >= jour(56) && d < jour(28);
const JOURS_AVANT = [50, 47, 44, 41, 38, 35];
const JOURS_ACTUEL = [26, 22, 18, 14, 10, 5];

// La vraie loi du jeu du test : allure = 360 − 3,5 s/km par bpm au-dessus de 150 + 4 s/km par m/km de dénivelé au-dessus de 10 (+ progrès éventuel)
const allureTheorique = (fc: number, den: number, progres = 0, tapis = false): number => 360 - 3.5 * (fc - 150) + 4 * (den - 10) - progres + (tapis ? 12 : 0);

test('hausse nette : mêmes conditions, 5 % plus vite', () => {
  const fc = [148, 152, 150, 154, 146, 150];
  const den = [8, 12, 10, 9, 11, 10];
  const avant = JOURS_AVANT.map((j, i) => sortie(j, allureTheorique(fc[i], den[i]) + BRUIT[i], fc[i], den[i]));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, allureTheorique(fc[i], den[i], 18) + BRUIT[i + 3], fc[i], den[i]));
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct - 5) < 1.5, `variation ${e.variationPct}`);
  assert.ok(e.bas > 0, 'la fourchette exclut zéro');
  assert.equal(statutCourse(e), 'hausse');
});

test('un parcours plus vallonné ne passe pas pour un recul : écart ramené au même dénivelé', () => {
  // Avant : parcours plats (4 à 9 m/km) ; maintenant : parcours vallonnés (12 à 17 m/km). La forme n'a pas bougé.
  const fc = [148, 152, 150, 154, 146, 150];
  const denAvant = [4, 6, 8, 5, 7, 9];
  const denActuel = [14, 16, 12, 15, 13, 17];
  const avant = JOURS_AVANT.map((j, i) => sortie(j, allureTheorique(fc[i], denAvant[i]) + BRUIT[i], fc[i], denAvant[i]));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, allureTheorique(fc[i], denActuel[i]) + BRUIT[i + 2], fc[i], denActuel[i]));
  // L'allure moyenne brute se dégrade de ~30 s/km (+8 %) : une comparaison naïve crierait au recul
  const brut = actuel.reduce((s, x) => s + x.allure, 0) / 6 / (avant.reduce((s, x) => s + x.allure, 0) / 6) - 1;
  assert.ok(brut > 0.06);
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct) < 3, `variation ${e.variationPct}`);
  assert.notEqual(statutCourse(e), 'baisse');
  assert.ok(e.penteDenivele > 2 && e.penteDenivele < 6, `pente dénivelé ${e.penteDenivele}`);
});

test('un cardio plus haut ne passe pas pour un progrès : écart ramené au même cardio', () => {
  const fcAvant = [138, 142, 146, 140, 144, 141];
  const fcActuel = [158, 162, 166, 160, 164, 161];
  const den = [8, 12, 10, 9, 11, 10];
  const avant = JOURS_AVANT.map((j, i) => sortie(j, allureTheorique(fcAvant[i], den[i]) + BRUIT[i], fcAvant[i], den[i]));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, allureTheorique(fcActuel[i], den[i]) + BRUIT[i + 2], fcActuel[i], den[i]));
  const brut = avant.reduce((s, x) => s + x.allure, 0) / 6 / (actuel.reduce((s, x) => s + x.allure, 0) / 6) - 1;
  assert.ok(brut > 0.1, 'sans correction, ça ressemblerait à un gros progrès');
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct) < 3, `variation ${e.variationPct}`);
  assert.notEqual(statutCourse(e), 'hausse');
});

test('le tapis est compté à part : plus de courses sur tapis ne passe pas pour un recul', () => {
  const fc = [148, 152, 150, 154, 146, 150, 149, 151];
  const den = [8, 12, 10, 9, 11, 10, 9, 11];
  // Avant : surtout sur route (4 route, 2 tapis) ; maintenant : surtout sur tapis (2 route, 4 tapis). Le tapis est 12 s/km plus lent à cardio égal.
  const avant = JOURS_AVANT.map((j, i) => sortie(j, allureTheorique(fc[i], i < 4 ? den[i] : 0, 0, i >= 4) + BRUIT[i], fc[i], i < 4 ? den[i] : 0, i >= 4));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, allureTheorique(fc[i + 2], i < 2 ? den[i] : 0, 0, i >= 2) + BRUIT[i + 3], fc[i + 2], i < 2 ? den[i] : 0, i >= 2));
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.ok(Math.abs(e.variationPct) < 5, `variation ${e.variationPct}`);
  assert.ok(e.decalageTapis !== 0);
});

test('route d\'un côté, tapis de l\'autre : pas comparable', () => {
  const fc = [148, 152, 150, 154, 146, 150];
  const avant = JOURS_AVANT.map((j, i) => sortie(j, 360 + BRUIT[i], fc[i], 10));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, 372 + BRUIT[i], fc[i], 0, true));
  assert.equal(estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant), 'pas-comparable');
});

test('moins de 3 courses dans une période : pas assez', () => {
  const avant = [50, 46, 42].map((j, i) => sortie(j, 360 + BRUIT[i], 150, 10));
  const actuel = [20, 10].map((j, i) => sortie(j, 340 + BRUIT[i], 150, 10));
  assert.equal(estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant), 'pas-assez');
  assert.deepEqual(compterSortiesCourse([...avant, ...actuel], periodeActuelle, periodeAvant), { nbActuel: 2, nbAvant: 3 });
});

test('des courses qui varient trop : incertain plutôt qu\'un faux verdict', () => {
  const avant = [50, 46, 42, 38].map((j, i) => sortie(j, [320, 410, 350, 400][i], 150, 10));
  const actuel = [24, 20, 16, 12].map((j, i) => sortie(j, [405, 325, 395, 335][i], 150, 10));
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.equal(statutCourse(e), 'incertain');
  assert.ok(e.bas < 0 && e.haut > 0);
});

test('statutCourse : zéro dans la fourchette = stable si elle est étroite (± 5 %), incertain si elle est large ; hausse/baisse seulement si elle l\'exclut', () => {
  assert.equal(statutCourse({ variationPct: 2.1, bas: 0.4, haut: 3.8 }), 'hausse');
  assert.equal(statutCourse({ variationPct: -3, bas: -5.5, haut: -0.5 }), 'baisse');
  assert.equal(statutCourse({ variationPct: 0.6, bas: -4, haut: 5.2 }), 'stable');
  assert.equal(statutCourse({ variationPct: 3, bas: -8, haut: 14 }), 'incertain');
  assert.equal(statutCourse({ variationPct: 0.4, bas: 0.1, haut: 0.7 }), 'stable');
});

const seance = (avant: number, extra: Partial<SeanceCourse> = {}): SeanceCourse => ({
  sport: 'Run', start_date_local: `${jour(avant)}T08:00:00`, moving_time: 3600, distance_km: 10, total_elevation_gain: 100, avg_heartrate: 150, ...extra,
});

test('sortiesCourse : elliptique, trop court, cardio hors plage, données écartées, dénivelé inconnu = écartés ; le tapis garde un dénivelé de zéro', () => {
  const liste: SeanceCourse[] = [
    seance(1), // retenue : 360 s/km, 10 m/km
    seance(2, { sport: 'Elliptical' }),
    seance(3, { distance_km: 2 }),
    seance(4, { moving_time: 300 }),
    seance(5, { avg_heartrate: 90 }), // sous 50 % de 190 (95 bpm)
    seance(6, { avg_heartrate: 185 }), // au-dessus de 95 % de 190 (180,5 bpm)
    seance(7, { excl_hr: true }),
    seance(8, { excl_distance: true }),
    seance(9, { total_elevation_gain: null }), // dénivelé inconnu : l'allure ne se corrige pas
    seance(10, { sport: 'VirtualRun', total_elevation_gain: null }), // tapis : retenue, dénivelé zéro
    seance(11, { sport: 'TrailRun', total_elevation_gain: 400 }), // trail : retenue
  ];
  const r = sortiesCourse(liste, 190);
  assert.equal(r.length, 3);
  assert.equal(r[0].allure, 360);
  assert.equal(r[0].denivele, 10);
  assert.equal(r.find((s) => s.date.startsWith(jour(10)))!.tapis, true);
  assert.equal(r.find((s) => s.date.startsWith(jour(10)))!.denivele, 0);
  assert.equal(r.find((s) => s.date.startsWith(jour(11)))!.denivele, 40);
});

test('sortiesCourse : sans FC max connue, plage de 95 à 185 bpm', () => {
  const r = sortiesCourse([seance(1, { avg_heartrate: 94 }), seance(2, { avg_heartrate: 120 }), seance(3, { avg_heartrate: 186 })], null);
  assert.equal(r.length, 1);
});

function cas(): EstimationCourse {
  const fcAvant = [140, 144, 148, 142, 146, 143];
  const fcActuel = [156, 160, 164, 158, 162, 159];
  const denAvant = [4, 6, 8, 5, 7, 9];
  const denActuel = [14, 16, 12, 15, 13, 17];
  const avant = JOURS_AVANT.map((j, i) => sortie(j, allureTheorique(fcAvant[i], denAvant[i]) + BRUIT[i], fcAvant[i], denAvant[i]));
  const actuel = JOURS_ACTUEL.map((j, i) => sortie(j, allureTheorique(fcActuel[i], denActuel[i], 10, i >= 4) + BRUIT[i + 1], fcActuel[i], denActuel[i], i >= 4));
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  return e;
}

test('cascadeCourse : les écarts du brut, du cardio, du dénivelé et du tapis s\'additionnent exactement à l\'écart final', () => {
  const e = cas();
  const etapes = cascadeCourse(e);
  assert.equal(etapes[0].cle, 'brut');
  assert.equal(etapes[etapes.length - 1].cle, 'final');
  const somme = etapes.filter((s) => !s.total).reduce((t, s) => t + s.secondes, 0);
  const final = etapes[etapes.length - 1].secondes;
  assert.ok(Math.abs(somme - final) < 1e-6, `${somme} contre ${final}`);
  // La cascade enchaîne : chaque étape repart d'où la précédente s'arrête, et la dernière part de zéro
  assert.equal(etapes[0].de, 0);
  for (let i = 1; i < etapes.length - 1; i++) assert.ok(Math.abs(etapes[i].de - etapes[i - 1].a) < 1e-9);
  assert.equal(etapes[etapes.length - 1].de, 0);
  // Un cardio plus haut maintenant avait fait gagner des secondes au brut : on les retire
  assert.ok(etapes.find((s) => s.cle === 'cardio')!.secondes < 0);
});

test('cascadeCourse : sans courses assez variées en dénivelé ni tapis, seulement le brut, le cardio et le final', () => {
  const avant = [50, 46, 42, 38].map((j, i) => sortie(j, 360 + BRUIT[i], 140 + i, 10));
  const actuel = [24, 20, 16, 12].map((j, i) => sortie(j, 345 + BRUIT[i], 141 + i, 10));
  const e = estimerCourse([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.deepEqual(cascadeCourse(e).map((s) => s.cle), ['brut', 'cardio', 'final']);
});

test('geometrieNuageCourse : toutes les courses sont dans les axes, les droites sont parallèles et séparées de l\'écart', () => {
  const e = cas();
  const g = geometrieNuageCourse(e);
  for (const s of e.sorties) {
    assert.ok(s.fc >= g.x0 && s.fc <= g.x1, `cardio ${s.fc}`);
    const a = allureAuDenivele(e, s);
    assert.ok(a >= g.rapide && a <= g.lent, `allure ${a}`);
  }
  assert.ok(g.rapide < g.lent);
  const ecart = e.actuel - e.avant;
  assert.ok(Math.abs(g.droiteActuelle.de - g.droiteAvant.de - ecart) < 1e-9);
  assert.ok(Math.abs(g.droiteActuelle.a - g.droiteAvant.a - ecart) < 1e-9);
  assert.ok(Math.abs(g.auReference.actuel - g.auReference.avant - ecart) < 1e-9);
});

test('graduationsAllure : des repères ronds en secondes, pas plus que demandé', () => {
  assert.deepEqual(graduationsAllure(300, 420, 5), [300, 330, 360, 390, 420]);
  assert.ok(graduationsAllure(0, 3000, 5).length <= 5);
});
