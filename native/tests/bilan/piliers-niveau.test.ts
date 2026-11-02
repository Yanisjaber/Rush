import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PointNiveau, SerieNiveau } from '../../src/data/bilan/niveau-annees.ts';
import { ecartsPiliers, niveauGlobal, recordsDeMesures, type MesuresAnnee } from '../../src/data/bilan/piliers-niveau.ts';

const mesure = (an: number, extra: Partial<MesuresAnnee> = {}): MesuresAnnee => ({
  an, w5: null, w300: null, w1200: null, w3600: null, late300: null, late1200: null, nLongues: 0, repRatio: null, repN: 0, ctlMax: null, nCourbes: 50, w7200: null, w10800: null, deriveMed: null, nDerive: 0, heuresLongues: 0, ...extra,
});
/** Une série d'endurance réduite aux années et à leur score. */
const endurance = (scores: Record<number, number>): SerieNiveau => {
  const annuel = Object.entries(scores).map(([an, score]): PointNiveau => ({ cle: an, an: Number(an), tranche: 0, niveau: 150, demi: 3, n: 40, score, bas: score - 3, haut: score + 3 }));
  return { fcReference: 149, tranchesParAn: 1, annuel, tranches: [], meilleur: annuel[0], actuel: annuel[annuel.length - 1] };
};

// Les vraies mesures du compte de test, 2022 à 2026 (l'endurance : 2 h, 3 h, dérive et volume inventés, plausibles)
const REEL: MesuresAnnee[] = [
  mesure(2022, { w5: 939, w300: 265, w1200: 224, w3600: 171, late300: 198, late1200: 162, nLongues: 10, repRatio: 0.907, repN: 2, ctlMax: 52, w7200: 160, w10800: 140, deriveMed: 8, nDerive: 30, heuresLongues: 140 }),
  mesure(2023, { w5: 1118, w300: 289, w1200: 227, w3600: 201, late300: 255, late1200: 222, nLongues: 46, repRatio: 0.929, repN: 16, ctlMax: 79.6, w7200: 185, w10800: 165, deriveMed: 6, nDerive: 60, heuresLongues: 220 }),
  mesure(2024, { w5: 1157, w300: 293, w1200: 252, w3600: 201, late300: 254, late1200: 240, nLongues: 57, repRatio: 0.925, repN: 37, ctlMax: 91, w7200: 195, w10800: 175, deriveMed: 5, nDerive: 70, heuresLongues: 250 }),
  mesure(2025, { w5: 1071, w300: 285, w1200: 259, w3600: 206, late300: 261, late1200: 237, nLongues: 40, repRatio: 0.935, repN: 26, ctlMax: 90.3, w7200: 200, w10800: 180, deriveMed: 4.5, nDerive: 40, heuresLongues: 150 }),
  mesure(2026, { w5: 1103, w300: 271, w1200: 223, w3600: 194, late300: 242, late1200: 180, nLongues: 6, repRatio: 0.915, repN: 20, ctlMax: 69.6, w7200: 190, w10800: 170, deriveMed: 6, nDerive: 8, heuresLongues: 25 }),
];

test('niveauGlobal : les cinq piliers de chaque année et leur moyenne (vraies mesures)', () => {
  const g = niveauGlobal(REEL);
  assert.ok(g);
  assert.deepEqual(g.annees.map((a) => a.an), [2022, 2023, 2024, 2025, 2026]);
  // Le score global d'une année est la moyenne de ses piliers mesurés
  const par = Object.fromEntries(g.annees.map((a) => [a.an, a]));
  assert.ok(Math.abs(par[2025].global! - 83) <= 2, `2025 : ${par[2025].global}`);
  assert.ok(Math.abs(par[2024].global! - 85) <= 3, `2024 : ${par[2024].global}`);
  assert.ok(Math.abs(par[2026].global! - 54) <= 3, `2026 : ${par[2026].global}`);
  assert.ok(par[2022].global! < par[2023].global!);
  assert.equal(par[2025].nbPiliers, 5);
  // 2022 n'a que 2 sorties à trois vrais efforts : la répétabilité n'est pas jugée
  assert.equal(par[2022].piliers.repetabilite, null);
  assert.equal(par[2022].nbPiliers, 4);
});

test('niveauGlobal : l\'année actuelle, l\'année d\'avant, le meilleur, le point fort et le point faible', () => {
  const g = niveauGlobal(REEL)!;
  assert.equal(g.actuel.an, 2026);
  assert.equal(g.precedent!.an, 2025);
  assert.ok(g.meilleur.an === 2025 || g.meilleur.an === 2024);
  assert.equal(g.fort, 'puissance');
  assert.equal(g.faible, 'charge'); // CTL max 69,6 contre 91 : le plus bas des cinq en 2026
});

test('niveauGlobal : les notes des piliers sont ce qu\'on attend', () => {
  const p = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.piliers;
  // Durabilité 2025 : 261/285 = 91,6 % et 237/259 = 91,5 % → ratio moyen 0,916 → (0,916 − 0,7) / 0,3 = 72
  assert.ok(Math.abs(p.durabilite! - 72) < 1.5, `${p.durabilite}`);
  // Répétabilité 2025 : 0,935 → 78
  assert.ok(Math.abs(p.repetabilite! - 78.3) < 1, `${p.repetabilite}`);
  // Charge 2025 : 90,3 / 91 = 99,2 % → 97,5
  assert.ok(Math.abs(p.charge! - 97.4) < 1, `${p.charge}`);
  // Puissance : la meilleure durée de chaque année vaut 100 pour son année record ; 2025 : sprint 1071/1157, 5 min 285/293, 20 min 100 %, 60 min 100 %
  assert.ok(p.puissance! > 85 && p.puissance! < 96, `${p.puissance}`);
  // Endurance 2025 : 2 h et 3 h sont les meilleurs de toujours (100), dérive 4,5 % → 70, volume 150 h sur 250 h → 60 : moyenne 76,7
  const e = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.endurance;
  assert.equal(e.puissanceLongue, 100);
  assert.ok(Math.abs(e.derive! - 70) < 1e-9, `${e.derive}`);
  assert.equal(e.volume, 60);
  assert.ok(Math.abs(p.endurance! - 76.67) < 0.01, `${p.endurance}`);
});

test('niveauGlobal : une année à moins de 2 piliers n\'a pas de score ; sans aucune année à 2 piliers, pas de niveau global', () => {
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000 })]), null);
  const g = niveauGlobal([mesure(2024, { w5: 1000 }), mesure(2025, { w5: 1100, w300: 310, ctlMax: 85 })])!;
  // 2024 : puissance seule = 1 pilier : pas de score ; 2025 : puissance et charge = 2 piliers
  assert.deepEqual(g.annees.map((a) => a.an), [2025]);
  assert.equal(g.annees[0].nbPiliers, 2);
  assert.equal(g.precedent, null);
});

test('niveauGlobal : la durabilité demande 3 sorties longues', () => {
  const peu = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, late300: 270, late1200: 225, nLongues: 2, ctlMax: 80 })])!;
  assert.equal(peu.actuel.piliers.durabilite, null);
  const assez = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, late300: 270, late1200: 225, nLongues: 3, ctlMax: 80 })])!;
  assert.equal(Math.round(assez.actuel.piliers.durabilite!), 67); // ratio 0,9 des deux : (0,9 − 0,7) / 0,3
});

test('niveauGlobal : une durabilité au-dessus de 100 % est plafonnée à 100', () => {
  const g = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, late300: 320, late1200: 260, nLongues: 5, ctlMax: 80 })])!;
  assert.equal(g.actuel.piliers.durabilite, 100);
});

test('ecartsPiliers : ce qui a bougé depuis l\'année d\'avant, seulement pour les piliers mesurés les deux années', () => {
  const g = niveauGlobal(REEL)!;
  const e = ecartsPiliers(g);
  assert.deepEqual(e.map((x) => x.cle), ['puissance', 'endurance', 'durabilite', 'repetabilite', 'charge']);
  const charge = e.find((x) => x.cle === 'charge')!;
  assert.ok(charge.ecart < -60, `charge ${charge.ecart}`); // CTL max 90 → 70 : le plus gros recul
  assert.equal(e.find((x) => x.cle === 'endurance')!.ecart, 51 - 77); // volume 2026 : 25 h seulement
  assert.ok(e.every((x) => x.maintenant - x.avant === x.ecart));
  // Sans année d'avant : rien à comparer
  const seul = niveauGlobal([REEL[3]])!;
  assert.deepEqual(ecartsPiliers(seul), []);
});

test('recordsDeMesures : les durées absentes ou nulles deviennent undefined', () => {
  assert.deepEqual(recordsDeMesures([mesure(2025, { w5: 1000, w300: 0, w1200: 250 })]), [{ an: 2025, w5: 1000, w300: undefined, w1200: 250, w3600: undefined }]);
});

test('niveauGlobal : une année à moins de 3 sorties avec capteur n\'a pas de note de puissance (cas du compte de test : 2013, un capteur en panne)', () => {
  // 2013 : une seule sortie avec capteur, absurde (1 W sur une heure), et une petite charge : avant, puissance 0 + charge 0 = niveau global 0
  const mesures = [
    mesure(2013, { w5: 103, w300: 16, w1200: 4, w3600: 1, ctlMax: 55, nCourbes: 1 }),
    ...REEL,
  ];
  const g = niveauGlobal(mesures)!;
  assert.deepEqual(g.annees.map((a) => a.an), [2022, 2023, 2024, 2025, 2026]); // 2013 n'a plus qu'un pilier : pas de score
  // Les notes des autres années ne bougent pas
  const sans = niveauGlobal(REEL)!;
  assert.deepEqual(g.annees.map((a) => a.global), sans.annees.map((a) => a.global));
  // Une pointe absurde dans une année à 2 sorties ne devient pas « ton meilleur »
  const pointe = niveauGlobal([mesure(2021, { w5: 3000, w300: 900, ctlMax: 40, nCourbes: 2 }), ...REEL])!;
  assert.deepEqual(pointe.annees.map((a) => a.global), sans.annees.map((a) => a.global));
});

test('recordsDeMesures : sans les années à moins de 3 sorties avec capteur', () => {
  assert.deepEqual(recordsDeMesures([mesure(2013, { w5: 103, nCourbes: 1 }), mesure(2025, { w5: 1000, nCourbes: 3 })]).map((r) => r.an), [2025]);
});

test('niveauGlobal : l\'endurance demande 2 de ses 3 notes ; la dérive demande 3 sorties ; une dérive de 15 % ou plus vaut 0', () => {
  // Volume seul (pas de capteur, pas de dérive) : pas de note d'endurance
  const seul = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100 })])!;
  assert.equal(seul.actuel.piliers.endurance, null);
  assert.equal(seul.actuel.endurance.volume, 100);
  // 2 sorties avec dérive : pas assez pour la juger ; 3 : jugée
  const deux = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100, deriveMed: 3, nDerive: 2 })])!;
  assert.equal(deux.actuel.endurance.derive, null);
  const trois = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100, deriveMed: 3, nDerive: 3 })])!;
  assert.ok(Math.abs(trois.actuel.endurance.derive! - 80) < 1e-9);
  assert.ok(Math.abs(trois.actuel.piliers.endurance! - 90) < 1e-9); // (80 + 100) / 2
  // Dérive de 20 % : 0 ; dérive négative (2e moitié plus efficace) : plafonnée à 100
  const forte = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, heuresLongues: 100, deriveMed: 20, nDerive: 5 })])!;
  assert.equal(forte.actuel.endurance.derive, 0);
  const negative = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, heuresLongues: 100, deriveMed: -2, nDerive: 5 })])!;
  assert.equal(negative.actuel.endurance.derive, 100);
  // Une année à moins de 3 sorties avec capteur n'a pas de puissance longue (comme la puissance)
  const capteur = niveauGlobal([mesure(2025, { w7200: 200, ctlMax: 80, nCourbes: 2, heuresLongues: 100, deriveMed: 3, nDerive: 3 })])!;
  assert.equal(capteur.actuel.endurance.puissanceLongue, null);
});
