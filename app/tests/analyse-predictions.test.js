import test from 'node:test';
import assert from 'node:assert/strict';
import { vdotPerformance, tempsPourVdot, vitessePourVo2, allures, effortsCourse, niveauA, majorationMarathon, kmParSemaine, analyserPredictions } from '../src/lib/analyse/predictions.js';
import { decalerJour } from '../src/lib/analyse/maths.js';

const AUJ = new Date(2026, 9, 14, 12);
const ISO = '2026-10-14';
const proche = (a, b, tolPct) => Math.abs(a - b) / b <= tolPct / 100;

test('VDOT : les tables de Daniels (VDOT 50 : 5 km 19:57, 10 km 41:21, semi 1:31:35, marathon 3:10:49)', () => {
  assert.ok(proche(tempsPourVdot(50, 5000), 19 * 60 + 57, 1), `5k ${tempsPourVdot(50, 5000)}`);
  assert.ok(proche(tempsPourVdot(50, 10000), 41 * 60 + 21, 1));
  assert.ok(proche(tempsPourVdot(50, 21097.5), 91 * 60 + 35, 1.2));
  assert.ok(proche(tempsPourVdot(50, 42195), 3 * 3600 + 10 * 60 + 49, 1.5));
});

test('VDOT : aller-retour performance ↔ temps', () => {
  for (const v of [35, 45, 55, 65]) {
    const t = tempsPourVdot(v, 10000);
    assert.ok(Math.abs(vdotPerformance(10000, t) - v) < 0.01);
  }
  // 5 km en 25:00 est moins bon que 22:00
  assert.ok(vdotPerformance(5000, 1500) < vdotPerformance(5000, 1320));
});

test('allures : l\'ordre facile < marathon < seuil < intervalles (en vitesse), seuil VDOT 50 ≈ 4:15/km', () => {
  const t = tempsPourVdot(50, 42195);
  const a = allures(50, t / 42.195);
  assert.ok(a.facile.a > a.facile.de);
  assert.ok(a.facile.de > a.marathon);
  assert.ok(a.marathon > a.seuil);
  assert.ok(a.seuil > a.intervalles);
  assert.ok(Math.abs(a.seuil - 255) < 4, `seuil ${a.seuil}`);
  assert.ok(Math.abs(a.intervalles - 234) < 4, `intervalles ${a.intervalles}`);
  assert.ok(vitessePourVo2(50) > vitessePourVo2(40));
});

function course(joursAvant, km, minutes, extra = {}) {
  return { id: `c${joursAvant}`, sport: 'Run', name: `Sortie ${joursAvant}`, start_date_local: `${decalerJour(ISO, -joursAvant)}T09:00:00`, distance_km: km, moving_time: minutes * 60, avg_heartrate: 150, ...extra };
}

test('effortsCourse : seulement la course, ≥ 3 km, dans la fenêtre', () => {
  const e = effortsCourse([course(2, 10, 50), course(3, 2, 12), { ...course(4, 40, 90), sport: 'Ride' }, course(500, 10, 50)], 190, AUJ);
  assert.equal(e.length, 1);
  assert.ok(e[0].vdot > 30 && e[0].vdot < 60);
  assert.ok(Math.abs(e[0].hr - 150 / 190) < 1e-9);
});

test('niveauA : au moins 2 efforts de 5 km ; p90 ; confiance selon le cardio', () => {
  assert.equal(niveauA(effortsCourse([course(5, 10, 50)], 190, AUJ), ISO), null);
  const efforts = effortsCourse([course(5, 10, 52), course(12, 8, 44), course(20, 10, 48, { avg_heartrate: 175 })], 190, AUJ);
  const n = niveauA(efforts, ISO);
  assert.equal(n.confiance, 'haute'); // 175/190 = 92 %
  assert.equal(n.nbEfforts, 3);
  const meilleur = Math.max(...efforts.map((x) => x.vdot));
  assert.ok(Math.abs(n.vdot - meilleur) < 1e-9); // avec 3 efforts, le p90 est le meilleur
  const tranquilles = effortsCourse([course(5, 10, 55, { avg_heartrate: 130 }), course(12, 8, 47, { avg_heartrate: 128 })], 190, AUJ);
  assert.equal(niveauA(tranquilles, ISO).confiance, 'faible');
});

test('marathon : majoration selon le volume', () => {
  assert.equal(majorationMarathon(60), 0);
  assert.equal(majorationMarathon(45), 0.025);
  assert.equal(majorationMarathon(30), 0.05);
  assert.equal(majorationMarathon(10), 0.09);
  assert.equal(kmParSemaine([course(3, 16, 80)], AUJ), 2);
});

test('analyserPredictions : pas assez de sorties', () => {
  const a = analyserPredictions({ seances: [course(3, 10, 50)], aujourdhui: AUJ });
  assert.equal(a.insuffisant, true);
});

function coureur() {
  // un coureur qui s'améliore doucement sur 8 mois : un 10 km de plus en plus rapide toutes les deux semaines
  const s = [];
  for (let i = 0; i < 17; i++) s.push(course(i * 14 + 2, 10, 48 + i * 0.6, { avg_heartrate: 168 }));
  for (let i = 0; i < 40; i++) s.push(course(i * 6 + 1, 6, 36, { avg_heartrate: 138 }));
  return s;
}

test('analyserPredictions : coureur qui progresse → verdict, prédictions cohérentes, progression positive', () => {
  const a = analyserPredictions({ seances: coureur(), hrMax: 190, aujourdhui: AUJ });
  assert.equal(a.insuffisant, false);
  const [c5, c10, semi, marathon] = a.brut.predictions;
  assert.ok(c5.secondes < c10.secondes && c10.secondes < semi.secondes && semi.secondes < marathon.secondes);
  assert.ok(c10.secondes / c5.secondes > 2.0 && c10.secondes / c5.secondes < 2.3);
  assert.ok(a.brut.penteRelative > 0, `pente ${a.brut.penteRelative}`);
  assert.equal(a.verdict.titre, 'Tu progresses');
  assert.equal(a.graphiques.filter((g) => g.type === 'tableau').length >= 2, true);
  assert.ok(a.graphiques.some((g) => g.type === 'lignes'));
  assert.ok(a.conseils.some((c) => /séances clés/i.test(c.titre)));
  assert.ok(a.brut.marathon === undefined); // pas d'interface cachée
});

test('analyserPredictions : objectif trop ambitieux vs réaliste vs déjà atteint', () => {
  const base = { seances: coureur(), hrMax: 190, aujourdhui: AUJ };
  const niveau = analyserPredictions(base).brut.actuel.vdot;
  const t10 = tempsPourVdot(niveau, 10000) / 60; // minutes
  const mk = (facteur, jours) => analyserPredictions({ ...base, objectifs: [{ name: 'Mon 10 km', date: decalerJour(ISO, jours), sport: 'Run', km: 10, duration: t10 * facteur }] });
  const facile = mk(1.1, 60).brut.objectif;
  assert.ok(facile.ecartPct < 0);
  assert.ok(mk(1.1, 60).conseils.some((c) => /déjà à ta portée/.test(c.titre)));
  const trop = mk(0.8, 20);
  assert.ok(trop.brut.objectif.ecartPct > 5);
  assert.ok(trop.conseils.some((c) => /trop loin|ambitieux/.test(c.titre)));
  assert.equal(trop.conseils[0].priorite, 'haute');
  // objectif sans durée ou d'un autre sport : ignoré
  assert.equal(analyserPredictions({ ...base, objectifs: [{ name: 'Vélo', date: decalerJour(ISO, 30), sport: 'Ride', km: 100, duration: 200 }] }).brut.objectif, null);
});

test('analyserPredictions : sorties toutes tranquilles → confiance faible et conseil de test', () => {
  const s = Array.from({ length: 12 }, (_, i) => course(i * 6 + 2, 8, 50, { avg_heartrate: 130 }));
  const a = analyserPredictions({ seances: s, hrMax: 190, aujourdhui: AUJ });
  assert.equal(a.brut.actuel.confiance, 'faible');
  assert.ok(a.conseils.some((c) => /test/i.test(c.titre)));
});
