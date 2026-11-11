import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flux1Hz } from '../../../src/data/calendrier/analyse/flux.ts';
import { alignementFiable, choisirPrevue, comparerGlobal, intentionDuPlan, mesurerSegments, resumerBlocs, segmentsPlan } from '../../../src/data/calendrier/analyse/plan.ts';
import type { PrevueAnalyse } from '../../../src/data/calendrier/analyse/plan.ts';

const prevue = (id: string, date: string, sport = 'Run', duration: number | null = 30, extra: Partial<PrevueAnalyse> = {}): PrevueAnalyse => ({ id, name: null, date, sport, duration, km: null, tss: null, category: 'entrainement', ...extra });
const seance = { sport: 'Run', start_date_local: '2026-11-10T20:21:00', moving_time: 2142 };

test('choisirPrevue : même jour et même famille, durée la plus proche', () => {
  const r = choisirPrevue(seance, [prevue('a', '2026-11-09'), prevue('b', '2026-11-10', 'Ride'), prevue('c', '2026-11-10', 'Run', 90), prevue('d', '2026-11-10', 'TrailRun', 40)]);
  assert.equal(r?.id, 'd'); // 36 min : 40 est plus proche que 90 ; le trail est de la course
  assert.equal(choisirPrevue(seance, [prevue('x', '2026-11-12')]), null);
});

test('choisirPrevue : une compétition passe après un entraînement du même jour', () => {
  const r = choisirPrevue(seance, [prevue('comp', '2026-11-10', 'Run', 36, { category: 'competition' }), prevue('ent', '2026-11-10', 'Run', 60)]);
  assert.equal(r?.id, 'ent');
});

const refs = { ftp: 250, hrMax: 200, allureBase: 300 }; // 100 % = 5'00"/km
// Un fractionné : échauffement 10 min zone 2, 3 x (4 min à 95-106 % de l'allure de base, 2 min de récup), retour au calme 5 min
const STRUCTURE = [
  { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'zone', work: { min: 10, int: 75, intHi: 85 } },
  { type: 'interval', name: '3 x 4 min seuil', reps: 3, metric: 'pace', unit: 'zone', work: { min: 4, int: 95, intHi: 106 }, rec: { min: 2, int: 60, intHi: 70 } },
  { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'pace', unit: 'zone', work: { min: 5, int: 70, intHi: null } },
];

test('segmentsPlan : les cibles en secondes par km (plus l\'intensité est haute, plus l\'allure est rapide)', () => {
  const s = segmentsPlan(STRUCTURE, refs, 'Run');
  assert.equal(s.length, 1 + 6 + 1);
  assert.deepEqual([s[0].debutS, s[0].dureeS], [0, 600]);
  const t1 = s[1]; // 1re répétition
  assert.equal(t1.role, 'travail');
  assert.equal(t1.debutS, 600);
  assert.ok(Math.abs(t1.bas! - 300 * 100 / 106) < 1e-9); // la plus rapide : 4'43"
  assert.ok(Math.abs(t1.haut! - 300 * 100 / 95) < 1e-9); // la plus lente : 5'16"
  assert.equal(s[2].role, 'recup');
});

test('segmentsPlan : sans référence, la cible est inconnue (jamais une valeur par défaut)', () => {
  const s = segmentsPlan(STRUCTURE, { ftp: null, hrMax: 200, allureBase: null }, 'Run');
  assert.equal(s[1].bas, null);
});

// Une course qui suit le plan : 10 min à 6'00", 3 x 4 min à 5'00" avec récup à 7'00", 5 min à 6'20"
function course(allures: { dureeS: number; allure: number }[]) {
  const v: number[] = [];
  for (const a of allures) for (let i = 0; i < a.dureeS; i++) v.push(1000 / a.allure);
  return { temps: v.map((_, i) => i), vitesse: v, fc: v.map(() => 150) };
}

test('mesurerSegments + resumerBlocs : trois répétitions tenues', () => {
  const f = flux1Hz(course([{ dureeS: 600, allure: 360 }, { dureeS: 240, allure: 300 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 300 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 300 }, { dureeS: 120, allure: 420 }, { dureeS: 300, allure: 380 }]))!;
  const segs = segmentsPlan(STRUCTURE, refs, 'Run');
  assert.equal(alignementFiable(f, segs), true);
  const bloc = resumerBlocs(mesurerSegments(f, segs));
  assert.equal(bloc.length, 1); // seul le bloc d'intervalles est jugé
  assert.equal(bloc[0].nbReps, 3);
  assert.equal(bloc[0].dans, 3);
  assert.equal(bloc[0].horsCible, null);
});

test('resumerBlocs : la dernière répétition s\'effondre, on le voit', () => {
  const f = flux1Hz(course([{ dureeS: 600, allure: 360 }, { dureeS: 240, allure: 300 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 305 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 335 }, { dureeS: 120, allure: 420 }, { dureeS: 300, allure: 380 }]))!;
  const b = resumerBlocs(mesurerSegments(f, segmentsPlan(STRUCTURE, refs, 'Run')))[0];
  assert.equal(b.dans, 2);
  assert.equal(b.horsCible, 'trop_lent');
  assert.ok(b.derniere! > b.premiere!);
});

test('mesurerSegments : trop vite est détecté avec l\'écart', () => {
  const f = flux1Hz(course([{ dureeS: 600, allure: 360 }, { dureeS: 240, allure: 270 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 270 }, { dureeS: 120, allure: 420 }, { dureeS: 240, allure: 270 }, { dureeS: 120, allure: 420 }, { dureeS: 300, allure: 380 }]))!;
  const r = mesurerSegments(f, segmentsPlan(STRUCTURE, refs, 'Run')).find((x) => x.seg.type === 'interval')!;
  assert.equal(r.statut, 'trop_vite');
  assert.ok(r.ecartPct! < -3);
});

test('alignementFiable : un chrono de la mauvaise durée ne tombe pas sur les blocs', () => {
  const f = flux1Hz(course([{ dureeS: 1500, allure: 330 }]))!;
  assert.equal(alignementFiable(f, segmentsPlan(STRUCTURE, refs, 'Run')), false);
});

test('comparerGlobal : durée, distance et charge, seulement quand on a les deux', () => {
  const g = comparerGlobal(prevue('p', '2026-11-10', 'Run', 30, { tss: 45 }), { moving_time: 2142, distance_km: 6.01, tss: 60 });
  assert.deepEqual(g.map((x) => x.cle), ['duree', 'charge']); // pas de km prévu
  assert.equal(g[0].ecartPct, 19); // 35,7 min pour 30
  assert.equal(g[1].ecartPct, 33.3);
});

test('intentionDuPlan : structure d\'abord, effort estimé ensuite, rien sans indice', () => {
  assert.equal(intentionDuPlan(prevue('a', 'd', 'Run', 30, { structure: [{ type: 'steady', name: 'EF', reps: 1, metric: 'pace', unit: 'zone', work: { min: 30, int: 75, intHi: 85 } }] })), 'facile');
  assert.equal(intentionDuPlan(prevue('b', 'd', 'Run', 30, { structure: STRUCTURE })), 'dur');
  assert.equal(intentionDuPlan(prevue('c', 'd', 'Run', 30, { rpe: 3 })), 'facile');
  assert.equal(intentionDuPlan(prevue('d', 'd', 'Run', 30, { rpe: 8 })), 'dur');
  assert.equal(intentionDuPlan(prevue('e', 'd', 'Run', 30)), null);
});
