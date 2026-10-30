import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compterSortiesVelo, estimerVelo, type EstimationVelo, type SortieVelo } from '../../src/data/bilan/progression-velo.ts';
import { cascadeVelo, echelleFourchette, geometrieNuage, graduations } from '../../src/data/bilan/progression-velo-affichage.ts';
import { progressionSport } from '../../src/data/bilan/progression.ts';
import type { Seance } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 28);
const jour = (avant: number): string => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - avant);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const BRUIT = [-6, 3, -2, 5, 0, -4, 2, 4, -3, 1];
const sortie = (avant: number, watts: number, fc: number, interieur = false): SortieVelo => ({ date: `${jour(avant)}T08:00:00`, watts, fc, interieur });
const periodeActuelle = (d: string): boolean => d >= jour(28) && d <= `${jour(0)}T23:59:59`;
const periodeAvant = (d: string): boolean => d >= jour(56) && d < jour(28);

// Un cas qui a un peu de tout : cardio plus haut maintenant, plus de sorties en salle, et un vrai recul
function cas(): EstimationVelo {
  const fcAvant = [128, 133, 138, 130, 135, 132, 136];
  const fcActuel = [148, 153, 158, 150, 155, 152, 156];
  const avant = [50, 47, 44, 41, 38, 35, 32].map((j, i) => sortie(j, 160 + 0.85 * (fcAvant[i] - 135) + BRUIT[i], fcAvant[i], i === 6));
  const actuel = [26, 23, 20, 16, 12, 8, 3].map((j, i) => sortie(j, 150 + 0.85 * (fcActuel[i] - 135) + BRUIT[i + 1] - (i >= 3 ? 14 : 0), fcActuel[i], i >= 3));
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  return e;
}

test('cascadeVelo : les écarts du brut, du cardio et du home-trainer s\'additionnent exactement à l\'écart à cardio égal', () => {
  const e = cas();
  const etapes = cascadeVelo(e);
  assert.deepEqual(etapes.map((s) => s.cle), ['brut', 'cardio', 'salle', 'final']);
  const somme = etapes.filter((s) => !s.total).reduce((t, s) => t + s.watts, 0);
  assert.ok(Math.abs(somme - etapes[3].watts) < 1e-6, `${somme} contre ${etapes[3].watts}`);
  // La cascade enchaîne : chaque étape repart d'où la précédente s'arrête, et la dernière part de zéro
  assert.equal(etapes[0].de, 0);
  assert.ok(Math.abs(etapes[1].de - etapes[0].a) < 1e-9);
  assert.ok(Math.abs(etapes[2].de - etapes[1].a) < 1e-9);
  assert.equal(etapes[3].de, 0);
});

test('cascadeVelo : pas d\'étape home-trainer quand on ne l\'a pas mesuré', () => {
  const avant = [50, 46, 42, 38].map((j, i) => sortie(j, 150 + BRUIT[i], 140 + i));
  const actuel = [24, 20, 16, 12].map((j, i) => sortie(j, 160 + BRUIT[i], 141 + i));
  const e = estimerVelo([...avant, ...actuel], periodeActuelle, periodeAvant);
  assert.ok(typeof e !== 'string');
  assert.deepEqual(cascadeVelo(e).map((s) => s.cle), ['brut', 'cardio', 'final']);
});

test('cascadeVelo : un cardio plus haut maintenant retire des watts à l\'écart brut', () => {
  const etapes = cascadeVelo(cas());
  assert.ok(etapes[1].watts < 0, `cardio ${etapes[1].watts}`);
});

test('echelleFourchette : toute la fourchette tient, par pas de 5, entre 15 et 60', () => {
  assert.equal(echelleFourchette(-29.9, -13.3), 35);
  assert.equal(echelleFourchette(-2, 3), 15);
  assert.equal(echelleFourchette(-90, 40), 60);
  assert.equal(echelleFourchette(1.8, 18.3), 25);
});

test('graduations : des repères ronds, pas plus que demandé', () => {
  assert.deepEqual(graduations(125, 225, 5), [140, 160, 180, 200, 220]);
  assert.deepEqual(graduations(130, 175, 5), [130, 140, 150, 160, 170]);
  assert.ok(graduations(0, 1000, 5).length <= 5);
});

test('geometrieNuage : tous les points sont dans les axes et les deux droites sont parallèles, séparées de l\'écart', () => {
  const e = cas();
  const g = geometrieNuage(e);
  for (const s of e.sorties) {
    assert.ok(s.fc >= g.x0 && s.fc <= g.x1, `cardio ${s.fc}`);
    assert.ok(s.watts >= g.y0 && s.watts <= g.y1, `watts ${s.watts}`);
  }
  const ecart = e.actuel - e.avant;
  assert.ok(Math.abs(g.droiteActuelle.de - g.droiteAvant.de - ecart) < 1e-9);
  assert.ok(Math.abs(g.droiteActuelle.a - g.droiteAvant.a - ecart) < 1e-9);
  assert.ok(Math.abs(g.auReference.actuel - g.auReference.avant - ecart) < 1e-9);
  // La droite d'avant passe par (cardio de référence, watts d'avant)
  const pente = (g.droiteAvant.a - g.droiteAvant.de) / (g.x1 - g.x0);
  assert.ok(Math.abs(g.droiteAvant.de + pente * (e.fcReference - g.x0) - e.avant) < 1e-9);
});

test('estimerVelo : les sorties renvoyées sont triées, marquées par période et ramenées au cardio de référence', () => {
  const e = cas();
  assert.equal(e.sorties.length, 14);
  for (let i = 1; i < e.sorties.length; i++) assert.ok(e.sorties[i - 1].date <= e.sorties[i].date);
  assert.equal(e.sorties.filter((s) => s.actuelle).length, e.nbActuel);
  // Une sortie au cardio de référence, à l'extérieur, garde ses watts
  const [s] = e.sorties;
  assert.ok(Math.abs(e.ajuster({ ...s, fc: e.fcReference, interieur: false }) - s.watts) < 1e-9);
});

test('compterSortiesVelo : combien comptent dans chaque période', () => {
  const sorties = [sortie(50, 150, 140), sortie(46, 150, 140), sortie(20, 150, 140)];
  assert.deepEqual(compterSortiesVelo(sorties, periodeActuelle, periodeAvant), { nbActuel: 1, nbAvant: 2 });
});

test('progressionSport vélo : le détail du calcul accompagne le verdict ; sans assez de sorties, on a leur nombre', () => {
  const s = (avant: number, np: number): Seance => ({
    id: String(avant), name: null, sport: 'Ride', start_date_local: `${jour(avant)}T08:00:00`, moving_time: 5400, distance_km: 40, total_elevation_gain: null,
    avg_heartrate: 140, ftp_at_time: null, avg_watts: np - 10, np, tss: null, category: 'workout',
  });
  const assez = [50, 46, 42, 38].map((j, i) => s(j, 150 + BRUIT[i])).concat([24, 20, 16, 12].map((j, i) => s(j, 165 + BRUIT[i])));
  const p = progressionSport('velo', { seances: assez, series: [], hrMax: 190 }, 28, AUJOURDHUI)!;
  assert.ok(p.detailVelo);
  assert.equal(p.detailVelo.sorties.length, 8);
  const peu = [s(50, 150), s(46, 150), s(42, 150), s(20, 160)];
  const q = progressionSport('velo', { seances: peu, series: [], hrMax: 190 }, 28, AUJOURDHUI)!;
  assert.equal(q.statut, 'insuffisant');
  assert.equal(q.detailVelo, undefined);
  assert.equal(q.nbActuel, 1);
  assert.equal(q.nbAvant, 3);
});
