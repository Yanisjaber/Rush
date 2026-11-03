import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allure100DeSeance, niveauGlobalNatation, PILIERS_NATATION } from '../../src/data/bilan/piliers-natation.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';

const maintenant = new Date(2026, 5, 15, 12);
const nage = (iso: string, km: number, min: number, famille = 'natation'): ActiviteBilan => ({ id: `${iso}-${km}-${min}`, name: iso, iso, sport: 'natation', famille, duree_min: min, distance_km: km, d_plus: 0, tss: 0 });

/** Une année de séances : une par semaine (40 semaines), de `km` kilomètres à `min` minutes chacune. */
function annee(an: number, km: number, min: number, du = '01-05', semaines = 40): ActiviteBilan[] {
  const debut = Date.UTC(an, Number(du.slice(0, 2)) - 1, Number(du.slice(3)));
  return Array.from({ length: semaines }, (_, i) => nage(new Date(debut + i * 7 * 86400000).toISOString().slice(0, 10), km, min));
}

test('allure100DeSeance : secondes pour 100 m', () => {
  assert.equal(allure100DeSeance(nage('2026-01-01', 1.5, 45)), 180); // 3'00"/100 m
  assert.equal(allure100DeSeance(nage('2026-01-01', 2, 40)), 120);
});

test('niveauGlobalNatation : 4 piliers ; la vitesse et l\'endurance se jugent contre ta meilleure année, 100 pour la meilleure', () => {
  const g = niveauGlobalNatation([...annee(2024, 2, 40), ...annee(2025, 2, 50)], maintenant)!; // 2024 : 2'00"/100 m, 2025 : 2'30"/100 m
  assert.deepEqual(g.piliers.map((p) => p.cle), PILIERS_NATATION.map((p) => p.cle));
  const a24 = g.annees[0], a25 = g.annees[1];
  assert.equal(a24.piliers.vitesse, 100);
  assert.equal(a24.piliers.endurance, 100);
  // 2025 : 150 s contre 120 s : rapport 0,8 → (0,8 − 0,75) ÷ 0,25 = 20
  assert.ok(Math.abs(a25.piliers.vitesse - 20) < 1e-9, `${a25.piliers.vitesse}`);
  assert.ok(Math.abs(a25.piliers.endurance - 20) < 1e-9);
  assert.equal(a24.nbPiliers, 4);
  assert.ok(a24.global !== null && a25.global !== null && a24.global > a25.global);
  assert.equal(g.meilleur.an, 2024);
});

test('niveauGlobalNatation : l\'endurance ne regarde que les séances de 1,5 km ou plus ; la vitesse retient tes 3 meilleures allures', () => {
  const seances = [
    ...annee(2025, 1, 25), // des séances de 1 km à 2'30"
    nage('2025-12-01', 0.4, 6), nage('2025-12-02', 0.4, 6), nage('2025-12-03', 0.4, 6), // trois sprints de 400 m à 1'30"/100 m
  ];
  const g = niveauGlobalNatation(seances, maintenant)!;
  const a = g.actuel;
  assert.equal(a.preuves.endurance, 0); // aucune séance de 1,5 km : pas d'endurance
  assert.equal(a.piliers.endurance, 0);
  assert.equal(a.preuves.vitesse, 1); // 40 séances de 300 m ou plus
  assert.equal(a.piliers.vitesse, 100); // la seule année : ta meilleure
});

test('niveauGlobalNatation : une année à une seule séance n\'a ni vitesse prouvée ni score ; la meilleure année se cherche parmi celles qui ont un score', () => {
  const g = niveauGlobalNatation([...annee(2024, 2, 40), nage('2026-03-01', 2, 40)], maintenant)!;
  const a26 = g.annees.find((x) => x.an === 2026)!;
  assert.ok(Math.abs(a26.preuves.vitesse - 1 / 3) < 1e-9);
  assert.equal(a26.global, null);
  assert.equal(g.meilleur.an, 2024);
  assert.equal(niveauGlobalNatation([], maintenant), null);
  assert.equal(niveauGlobalNatation([nage('2026-01-01', 10, 120, 'velo')], maintenant), null); // pas de la natation
});

test('niveauGlobalNatation : le volume de l\'année en cours est annualisé, la régularité reflète les séances par semaine', () => {
  const g = niveauGlobalNatation([...annee(2025, 2, 40, '01-05', 40), ...annee(2026, 2, 40, '01-05', 20)], maintenant)!;
  const a26 = g.annees[1];
  // 2026 : 20 séances sur 166 jours : annualisées, plus que 2025 (40) : le volume ne s'effondre pas
  assert.ok(a26.piliers.volume > 90, `${a26.piliers.volume}`);
  // Une séance par semaine = la moitié de la note de séances par semaine (2 = 100), et presque toutes les semaines actives
  assert.ok(a26.piliers.regularite > 60 && a26.piliers.regularite < 90, `${a26.piliers.regularite}`);
});
