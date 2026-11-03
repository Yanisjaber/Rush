import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formeNatationParSemaine, pointsDeNatation } from '../../src/data/bilan/forme-natation.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';

const iso = (jour: number): string => new Date(jour * 86400000).toISOString().slice(0, 10);
const jourDe = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;
const nage = (date: string, km: number, min: number, famille = 'natation'): ActiviteBilan => ({ id: `${date}-${km}-${min}`, name: date, iso: date, sport: 'natation', famille, duree_min: min, distance_km: km, d_plus: 0, tss: 0 });

/** Une séance tous les `pas` jours entre deux dates, de 2 km, à l'allure donnée (minutes pour 2 km) par `minutes(jour)`. */
function seances(du: string, au: string, minutes: (jour: number) => number, pas = 3): ActiviteBilan[] {
  const out: ActiviteBilan[] = [];
  for (let j = jourDe(du); j <= jourDe(au); j += pas) out.push(nage(iso(j), 2, minutes(j)));
  return out;
}
const AUJ = new Date(2026, 5, 1, 12);

test('pointsDeNatation : l\'allure record ÷ l\'allure de la séance ; les séances de moins de 300 m et les autres sports ne comptent pas', () => {
  const p = pointsDeNatation([nage('2026-01-01', 2, 40), nage('2026-01-04', 2, 50), nage('2026-01-07', 0.2, 2), nage('2026-01-08', 20, 30, 'velo'), nage('2026-01-09', 2, 0)]);
  assert.equal(p.length, 2);
  assert.equal(Math.max(...p.map((x) => x.ratio)), 1); // le record
  assert.ok(Math.abs(Math.min(...p.map((x) => x.ratio)) - 0.8) < 1e-9); // 40 ÷ 50
  assert.deepEqual(pointsDeNatation([]), []);
});

test('formeNatationParSemaine : la forme suit l\'allure (100 = ta meilleure semaine) ; les barres sont des kilomètres', () => {
  const MI = jourDe('2025-07-01');
  const f = formeNatationParSemaine(seances('2025-01-01', '2025-12-31', (j) => (j < MI ? 50 : 40)), 2025, AUJ)!;
  assert.equal(f.unite, 'km');
  assert.equal(f.semaines.length, 52);
  const mars = f.semaines[10], dec = f.semaines[50];
  assert.ok(dec.score! > mars.score! + 20, `décembre ${dec.score}, mars ${mars.score}`); // nager plus vite : la note monte
  assert.ok(dec.score! > 90, `${dec.score}`);
  assert.ok(f.semaines[f.meilleure].score! >= dec.score! - 1e-9);
  // 1re semaine (1er au 7 janvier) : séances du 1er, 4 et 7 : 3 × 2 km = 6 km
  assert.ok(Math.abs(f.semaines[0].heures - 6) < 1e-9, `${f.semaines[0].heures}`);
});

test('formeNatationParSemaine : après plus de 2 semaines sans séance, la forme est estimée (elle baisse) ; trop peu de séances : rien', () => {
  const f = formeNatationParSemaine([...seances('2025-01-01', '2025-03-31', () => 40), ...seances('2025-07-01', '2025-12-31', () => 40)], 2025, AUJ)!;
  assert.equal(f.semaines[12].estimee, false);
  assert.equal(f.semaines[20].estimee, true);
  assert.ok(f.semaines[20].score! < f.semaines[12].score!);
  assert.equal(f.semaines[27].estimee, false); // la reprise
  assert.equal(formeNatationParSemaine([], 2025, AUJ), null);
  assert.equal(formeNatationParSemaine([nage('2025-01-01', 2, 40), nage('2025-01-04', 2, 40)], 2025, AUJ), null);
});
