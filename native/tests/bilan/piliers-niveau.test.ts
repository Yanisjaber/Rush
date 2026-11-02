import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PointNiveau, SerieNiveau } from '../../src/data/bilan/niveau-annees.ts';
import { CHARGE_ZERO, DECOUPLAGE_CENT, DECOUPLAGE_ZERO, ecartsPiliers, FATIGUE_CENT, FATIGUE_ZERO, LONGUE_CENT, LONGUE_ZERO, HAUTEUR_ZERO, niveauGlobal, noteChargeDe, noteHauteurDe, noteLineaire, notePuissanceDe, preuveDe, recordsDeMesures, type MesuresAnnee } from '../../src/data/bilan/piliers-niveau.ts';

const mesure = (an: number, extra: Partial<MesuresAnnee> = {}): MesuresAnnee => ({
  an, w5: null, w300: null, w1200: null, w3600: null, late300: null, late1200: null, nLongues: 0, repRatio: null, repW3: null, repN: 0, ctlMax: null, nCourbes: 50, w9000: null, fat20: null, nFat: 0, driftMed: null, nDrift: 0, ...extra,
});
/** Une série d'endurance réduite aux années et à leur score. */
const endurance = (scores: Record<number, number>): SerieNiveau => {
  const annuel = Object.entries(scores).map(([an, score]): PointNiveau => ({ cle: an, an: Number(an), tranche: 0, niveau: 150, demi: 3, n: 40, score, bas: score - 3, haut: score + 3 }));
  return { fcReference: 149, tranchesParAn: 1, annuel, tranches: [], meilleur: annuel[0], actuel: annuel[annuel.length - 1] };
};

// Les vraies mesures du compte de test, 2022 à 2026 (l'endurance : 2 h 30, après fatigue et découplage inventés, plausibles)
const REEL: MesuresAnnee[] = [
  mesure(2022, { w5: 939, w300: 265, w1200: 224, w3600: 171, late300: 198, late1200: 162, nLongues: 10, repRatio: 0.907, repW3: 200, repN: 2, ctlMax: 52, w9000: 140, fat20: 200, nFat: 8, driftMed: 8, nDrift: 6 }),
  mesure(2023, { w5: 1118, w300: 289, w1200: 227, w3600: 201, late300: 255, late1200: 222, nLongues: 46, repRatio: 0.929, repW3: 215, repN: 16, ctlMax: 79.6, w9000: 150, fat20: 210, nFat: 20, driftMed: 6, nDrift: 10 }),
  mesure(2024, { w5: 1157, w300: 293, w1200: 252, w3600: 201, late300: 254, late1200: 240, nLongues: 57, repRatio: 0.925, repW3: 220, repN: 37, ctlMax: 91, w9000: 175, fat20: 238, nFat: 30, driftMed: 5, nDrift: 10 }),
  mesure(2025, { w5: 1071, w300: 285, w1200: 259, w3600: 206, late300: 261, late1200: 237, nLongues: 40, repRatio: 0.935, repW3: 190, repN: 26, ctlMax: 90.3, w9000: 190, fat20: 245, nFat: 25, driftMed: 4.5, nDrift: 10 }),
  mesure(2026, { w5: 1103, w300: 271, w1200: 223, w3600: 194, late300: 242, late1200: 180, nLongues: 6, repRatio: 0.915, repW3: 205, repN: 20, ctlMax: 69.6, w9000: 150, fat20: 195, nFat: 3, driftMed: 6, nDrift: 3 }),
];

test('niveauGlobal : les cinq piliers de chaque année et leur moyenne (vraies mesures)', () => {
  const g = niveauGlobal(REEL);
  assert.ok(g);
  assert.deepEqual(g.annees.map((a) => a.an), [2022, 2023, 2024, 2025, 2026]);
  // Le score global d'une année est la moyenne de ses piliers mesurés
  const par = Object.fromEntries(g.annees.map((a) => [a.an, a]));
  assert.ok(Math.abs(par[2025].global! - 77) <= 2, `2025 : ${par[2025].global}`);
  assert.ok(Math.abs(par[2024].global! - 77) <= 2, `2024 : ${par[2024].global}`);
  assert.ok(Math.abs(par[2026].global! - 54) <= 2, `2026 : ${par[2026].global}`);
  assert.ok(par[2022].global! < par[2023].global!);
  assert.equal(par[2025].nbPiliers, 5);
  // 2022 n'a que 2 sorties à trois vrais efforts : la répétabilité est notée, mais aux 2/3 :
  // régularité (0,907 − 0,7) / 0,3 = 69 ; hauteur : 200 W sur un record de 293 W = 68,3 % → (0,683 − 0,5) / 0,5 = 36,5 ; moyenne 52,8 ; × 2/3 = 35,2
  assert.ok(Math.abs(par[2022].piliers.repetabilite - 35.2) < 0.5, `${par[2022].piliers.repetabilite}`);
  assert.ok(Math.abs(par[2022].preuves.repetabilite - 2 / 3) < 1e-9);
  assert.equal(par[2022].nbPiliers, 4); // les quatre autres ont toutes leurs preuves
});

test('niveauGlobal : l\'année actuelle, l\'année d\'avant, le meilleur, le point fort et le point faible', () => {
  const g = niveauGlobal(REEL)!;
  assert.equal(g.actuel.an, 2026);
  assert.equal(g.precedent!.an, 2025);
  assert.ok(g.meilleur.an === 2025 || g.meilleur.an === 2024);
  assert.equal(g.fort, 'charge'); // la puissance 2026 (≈ 60 avec l'échelle 0 à 20 % sous le record) passe juste sous la charge (61)
  assert.equal(g.faible, 'endurance'); // 2026 : l'endurance (41 : 2 h 30 à 150 W, découplage 6 %, seulement 3 sorties Z2 et 3 sorties après fatigue) est le plus bas des cinq ; la durabilité est à 50
});

test('niveauGlobal : les notes des piliers sont ce qu\'on attend', () => {
  const p = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.piliers;
  // Durabilité 2025 : 261/285 = 91,6 % et 237/259 = 91,5 % → ratio moyen 0,916 → (0,916 − 0,7) / 0,3 = 72
  assert.ok(Math.abs(p.durabilite! - 72) < 1.5, `${p.durabilite}`);
  // Répétabilité 2025 : régularité 0,935 → 78,3 ; hauteur 190 W sur 293 W = 64,8 % → 29,7 ; moyenne des deux : 54,0
  assert.ok(Math.abs(p.repetabilite - 54) < 0.5, `${p.repetabilite}`);
  const d = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.detailRepetabilite;
  assert.ok(Math.abs(d.regularite! - 78.33) < 0.01 && Math.abs(d.hauteur! - 29.69) < 0.01, `${d.regularite} ${d.hauteur}`);
  // Charge 2025 : 90,3 / 91 = 99,2 % → (0,992 − 0,4) / 0,6 = 98,7
  assert.ok(Math.abs(p.charge - 98.72) < 0.1, `${p.charge}`);
  // Puissance : la meilleure durée de chaque année vaut 100 pour son année record ; 2025 : sprint 1071/1157, 5 min 285/293, 20 min 100 %, 60 min 100 %
  assert.ok(p.puissance! > 85 && p.puissance! < 96, `${p.puissance}`);
  // Endurance 2025 : D = 245 / 259 = 94,6 % → (0,946 − 0,85) / 0,12 = 80 ; R = 190 / (0,95 × 259) = 77,2 % → (0,772 − 0,65) / 0,2 = 61,1 ; C = (12 − 4,5) / 10 = 75
  // note = 0,20 × 80 + 0,35 × 61,1 + 0,45 × 75 = 71,1
  const e = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.endurance;
  assert.ok(Math.abs(e.fatigue! - 79.96) < 0.01, `${e.fatigue}`);
  assert.ok(Math.abs(e.longue! - 61.1) < 0.05, `${e.longue}`);
  assert.equal(e.decouplage, 75);
  assert.ok(Math.abs(p.endurance! - 71.13) < 0.05, `${p.endurance}`);
});

test('niveauGlobal : chaque année a une note à chaque pilier, même sans mesure (0 quand rien n\'est mesuré)', () => {
  assert.equal(niveauGlobal([]), null);
  // Une année avec un seul sprint : la puissance vaut 100 (c'est son meilleur), tout le reste 0, soit un score de 100 / 5 = 20
  const seul = niveauGlobal([mesure(2025, { w5: 1000 })])!;
  assert.deepEqual(seul.actuel.piliers, { puissance: 100, endurance: 0, durabilite: 0, repetabilite: 0, charge: 0 });
  assert.equal(seul.actuel.global, 20);
  assert.equal(seul.actuel.nbPiliers, 1); // seule la puissance a toutes ses preuves
  // Deux années : toutes les deux ont un score, comme avant seulement la 2e
  const g = niveauGlobal([mesure(2024, { w5: 1000 }), mesure(2025, { w5: 1100, w300: 310, ctlMax: 85 })])!;
  assert.deepEqual(g.annees.map((a) => a.an), [2024, 2025]);
  assert.equal(g.precedent!.an, 2024);
});

test('preuveDe : la part de sorties demandées, entre 0 et 1', () => {
  assert.equal(preuveDe(0, 3), 0);
  assert.equal(preuveDe(1, 3), 1 / 3);
  assert.equal(preuveDe(3, 3), 1);
  assert.equal(preuveDe(40, 3), 1);
  assert.equal(preuveDe(-2, 3), 0);
});

test('niveauGlobal : la durabilité demande 3 sorties longues : avec moins, la note est réduite ; sans aucune, 0', () => {
  const peu = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, late300: 270, late1200: 225, nLongues: 2, ctlMax: 80 })])!;
  assert.ok(Math.abs(peu.actuel.piliers.durabilite - 44.44) < 0.01, `${peu.actuel.piliers.durabilite}`); // 66,7 × 2/3
  assert.ok(Math.abs(peu.actuel.preuves.durabilite - 2 / 3) < 1e-9);
  const aucune = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, ctlMax: 80 })])!;
  assert.equal(aucune.actuel.piliers.durabilite, 0);
  assert.equal(aucune.actuel.preuves.durabilite, 0);
  const assez = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 250, late300: 270, late1200: 225, nLongues: 3, ctlMax: 80 })])!;
  assert.equal(Math.round(assez.actuel.piliers.durabilite), 67); // ratio 0,9 des deux : (0,9 − 0,7) / 0,3
  assert.equal(assez.actuel.preuves.durabilite, 1);
});

test('niveauGlobal : la répétabilité aussi : 3 sorties = note complète, 1 sortie = le tiers, aucune = 0', () => {
  const note = (repN: number, repRatio: number | null) => niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, repN, repRatio })])!.actuel.piliers.repetabilite;
  assert.ok(Math.abs(note(3, 0.9) - 66.67) < 0.01);
  assert.ok(Math.abs(note(1, 0.9) - 22.22) < 0.01);
  assert.equal(note(0, null), 0);
  assert.equal(note(5, 1.2), 100); // plafonnée
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
  assert.ok(charge.ecart < -35, `charge ${charge.ecart}`); // CTL max 90 → 70 : le plus gros recul (99 → 61)
  assert.equal(e.find((x) => x.cle === 'endurance')!.ecart, 41 - 71); // 2026 : 2 h 30 à 150 W, fatigue moins bien tenue, 3 sorties seulement
  assert.ok(e.every((x) => x.maintenant - x.avant === x.ecart));
  // Sans année d'avant : rien à comparer
  const seul = niveauGlobal([REEL[3]])!;
  assert.deepEqual(ecartsPiliers(seul), []);
});

test('recordsDeMesures : les durées absentes ou nulles deviennent undefined', () => {
  assert.deepEqual(recordsDeMesures([mesure(2025, { w5: 1000, w300: 0, w1200: 250 })]), [{ an: 2025, w5: 1000, w300: undefined, w1200: 250, w3600: undefined }]);
});

test('niveauGlobal : une année à moins de 3 sorties avec capteur ne fixe jamais ton « meilleur » et sa puissance est réduite (cas du compte de test : 2013, un capteur en panne)', () => {
  // 2013 : une seule sortie avec capteur, absurde (1 W sur une heure), et une petite charge
  const mesures = [
    mesure(2013, { w5: 103, w300: 16, w1200: 4, w3600: 1, ctlMax: 55, nCourbes: 1 }),
    ...REEL,
  ];
  const g = niveauGlobal(mesures)!;
  assert.deepEqual(g.annees.map((a) => a.an), [2013, 2022, 2023, 2024, 2025, 2026]);
  // 2013 a un score, mais tout en bas (puissance et charge sous 70 % du meilleur : 0), et sa puissance repose sur 1 sortie sur 3
  assert.equal(g.annees[0].global, 7); // charge 55/91 = 60 % → 34 sur l'échelle douce, le reste 0 : 34 / 5 = 7
  assert.ok(Math.abs(g.annees[0].preuves.puissance - 1 / 3) < 1e-9);
  // Les notes des autres années ne bougent pas
  const sans = niveauGlobal(REEL)!;
  assert.deepEqual(g.annees.slice(1).map((a) => a.global), sans.annees.map((a) => a.global));
  // Une pointe absurde dans une année à 2 sorties ne devient pas « ton meilleur » : les autres notes ne bougent pas, la sienne est plafonnée aux 2/3
  const pointe = niveauGlobal([mesure(2021, { w5: 3000, w300: 900, ctlMax: 40, nCourbes: 2 }), ...REEL])!;
  assert.deepEqual(pointe.annees.slice(1).map((a) => a.global), sans.annees.map((a) => a.global));
  assert.ok(pointe.annees[0].piliers.puissance < 66.7, `${pointe.annees[0].piliers.puissance}`);
});

test('niveauGlobal : sans aucune année fiable, le meilleur de toujours se lit sur les années qui ont au moins une sortie avec capteur', () => {
  const g = niveauGlobal([mesure(2024, { w5: 900, nCourbes: 2 }), mesure(2025, { w5: 1000, nCourbes: 2 })])!;
  // 2025 est le meilleur sprint (1000) : 100 × 2/3 ; 2024 : 900/1000 = 90 % → (0,9 − 0,8) / 0,2 = 50 × 2/3
  assert.ok(Math.abs(g.annees[1].piliers.puissance - 66.67) < 0.01);
  assert.ok(Math.abs(g.annees[0].piliers.puissance - 33.33) < 0.01);
});

test('recordsDeMesures : sans les années à moins de 3 sorties avec capteur', () => {
  assert.deepEqual(recordsDeMesures([mesure(2013, { w5: 103, nCourbes: 1 }), mesure(2025, { w5: 1000, nCourbes: 3 })]).map((r) => r.an), [2025]);
});

test('noteLineaire : les bornes de la formule d\'endurance (D 85 → 97 %, R 65 → 85 %, C 12 → 2 %)', () => {
  assert.equal(noteLineaire(0.85, FATIGUE_ZERO, FATIGUE_CENT), 0);
  assert.equal(noteLineaire(0.97, FATIGUE_ZERO, FATIGUE_CENT), 100);
  assert.ok(Math.abs(noteLineaire(0.91, FATIGUE_ZERO, FATIGUE_CENT) - 50) < 1e-9);
  assert.equal(noteLineaire(0.5, LONGUE_ZERO, LONGUE_CENT), 0);
  assert.equal(noteLineaire(0.95, LONGUE_ZERO, LONGUE_CENT), 100);
  assert.ok(Math.abs(noteLineaire(0.75, LONGUE_ZERO, LONGUE_CENT) - 50) < 1e-9);
  assert.equal(noteLineaire(12, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 0);
  assert.equal(noteLineaire(20, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 0); // 20 % : tout en bas
  assert.equal(noteLineaire(2, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 100);
  assert.equal(noteLineaire(-3, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 100); // 2e moitié plus efficace : plafonné
  assert.ok(Math.abs(noteLineaire(7, DECOUPLAGE_ZERO, DECOUPLAGE_CENT) - 50) < 1e-9);
});

test('niveauGlobal : endurance = 100 × (0,20 D + 0,35 R + 0,45 C), chaque lettre aux 3 sorties de preuve ; une lettre sans mesure vaut 0', () => {
  // Tout au maximum : D 100 (97 % ou plus), R 100 (85 % de la FTP ou plus), C 100 (2 % ou moins) → 100
  const plein = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 300, w9000: 255, fat20: 291, nFat: 5, driftMed: 2, nDrift: 5, ctlMax: 80 })])!;
  assert.ok(Math.abs(plein.actuel.piliers.endurance - 100) < 1e-9, `${plein.actuel.piliers.endurance}`);
  assert.equal(plein.actuel.preuves.endurance, 1);
  // Rien de mesuré : 0, sans preuve
  const rien = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80 })])!;
  assert.equal(rien.actuel.piliers.endurance, 0);
  assert.equal(rien.actuel.preuves.endurance, 0);
  assert.deepEqual(rien.actuel.endurance, { fatigue: null, longue: null, decouplage: null });
  // Le découplage seul (C = 100, poids 45 %) : 45, preuve 0,45
  const seulC = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 2, nDrift: 3 })])!;
  assert.ok(Math.abs(seulC.actuel.piliers.endurance - 45) < 1e-9);
  assert.ok(Math.abs(seulC.actuel.preuves.endurance - 0.45) < 1e-9);
  // 2 sorties Z2 sur 3 : le découplage est aux 2/3 (45 × 2/3 = 30)
  const deux = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 2, nDrift: 2 })])!;
  assert.ok(Math.abs(deux.actuel.piliers.endurance - 30) < 1e-9);
  // Un découplage de 20 % vaut 0 ; une 2e moitié plus efficace (négatif) est plafonnée à 100
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 20, nDrift: 5 })])!.actuel.endurance.decouplage, 0);
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: -2, nDrift: 5 })])!.actuel.endurance.decouplage, 100);
  // R juge le 2 h 30 contre la FTP de l'année (95 % du 20 min) : 2 sorties avec capteur seulement → aux 2/3 de la puissance
  const capteur = niveauGlobal([mesure(2025, { w1200: 300, w9000: 255, nCourbes: 2, ctlMax: 80 })])!;
  assert.equal(capteur.actuel.endurance.longue, 100);
  assert.ok(Math.abs(capteur.actuel.piliers.endurance - 0.35 * 100 * (2 / 3)) < 1e-9);
  // D : un 20 min après fatigue à 91 % du frais vaut 50 (poids 20 % → 10), preuve de 3 sorties
  const fatigue = niveauGlobal([mesure(2025, { w1200: 300, fat20: 273, nFat: 3, ctlMax: 80 })])!;
  assert.ok(Math.abs(fatigue.actuel.endurance.fatigue! - 50) < 1e-9);
  assert.ok(Math.abs(fatigue.actuel.piliers.endurance - 10) < 1e-9);
});

test('notePuissanceDe : 100 au meilleur, 0 à 20 % en dessous, en ligne droite (plus exigeante que les autres piliers : 0 à 30 %)', () => {
  assert.equal(notePuissanceDe(1), 100);
  assert.ok(Math.abs(notePuissanceDe(0.9) - 50) < 1e-9);
  assert.equal(notePuissanceDe(0.8), 0);
  assert.equal(notePuissanceDe(0.5), 0);
  assert.equal(notePuissanceDe(1.1), 100);
});

test('noteChargeDe : 100 au meilleur, 0 à 40 % du meilleur, en ligne droite (plus douce que les autres piliers : 0 à 70 %)', () => {
  assert.equal(CHARGE_ZERO, 0.4);
  assert.equal(noteChargeDe(1), 100);
  assert.equal(noteChargeDe(1.3), 100); // plafonnée
  assert.equal(noteChargeDe(0.4), 0);
  assert.equal(noteChargeDe(0.1), 0); // plancher
  assert.ok(Math.abs(noteChargeDe(0.7) - 50) < 1e-9);
  // Le cas de 2022 : CTL 52 contre 91 = 57 % : 28,6 au lieu de 0 sur l'échelle des autres piliers
  assert.ok(Math.abs(noteChargeDe(52 / 91) - 28.57) < 0.01);
  const g = niveauGlobal([mesure(2024, { ctlMax: 91 }), mesure(2022, { ctlMax: 52 })])!;
  assert.ok(Math.abs(g.annees[0].piliers.charge - 28.57) < 0.01, `${g.annees[0].piliers.charge}`);
});

test('noteHauteurDe : 0 à 50 % de ton meilleur 5 min de tous les temps, 100 à ton record', () => {
  assert.equal(HAUTEUR_ZERO, 0.5);
  assert.equal(noteHauteurDe(0.5), 0);
  assert.equal(noteHauteurDe(0.3), 0);
  assert.ok(Math.abs(noteHauteurDe(0.75) - 50) < 1e-9);
  assert.equal(noteHauteurDe(1), 100);
  assert.equal(noteHauteurDe(1.2), 100);
});

test('niveauGlobal : la répétabilité combine la régularité et la hauteur (le cas 2021 contre 2025)', () => {
  // 2021 : 3e effort médian 170 W, perte de 8 % (0,917) ; 2025 : 190 W, perte de 12 % (0,883) ; record de 5 min : 293 W (2024)
  const g = niveauGlobal([
    mesure(2021, { w300: 232, repRatio: 0.917, repW3: 170, repN: 22 }),
    mesure(2024, { w300: 293, repRatio: 0.902, repW3: 215, repN: 168 }),
    mesure(2025, { w300: 285, repRatio: 0.883, repW3: 190, repN: 94 }),
  ])!;
  const par = Object.fromEntries(g.annees.map((a) => [a.an, a]));
  // Régularité seule : 2021 (72,3) battait 2025 (61,0) ; avec la hauteur, 2025 passe devant
  assert.ok(Math.abs(par[2021].detailRepetabilite.regularite! - 72.33) < 0.01);
  assert.ok(Math.abs(par[2025].detailRepetabilite.regularite! - 61) < 0.01);
  assert.ok(Math.abs(par[2021].detailRepetabilite.hauteur! - 16.04) < 0.01, `${par[2021].detailRepetabilite.hauteur}`);
  assert.ok(Math.abs(par[2025].detailRepetabilite.hauteur! - 29.69) < 0.01, `${par[2025].detailRepetabilite.hauteur}`);
  assert.ok(Math.abs(par[2021].piliers.repetabilite - 44.19) < 0.05, `${par[2021].piliers.repetabilite}`);
  assert.ok(Math.abs(par[2025].piliers.repetabilite - 45.35) < 0.05, `${par[2025].piliers.repetabilite}`);
  assert.ok(par[2025].piliers.repetabilite > par[2021].piliers.repetabilite);
});

test('niveauGlobal : sans la hauteur (base pas à jour) la régularité fait seule la note ; sans rien, 0', () => {
  const sans = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, repN: 3, repRatio: 0.9 })])!;
  assert.equal(sans.actuel.detailRepetabilite.hauteur, null);
  assert.ok(Math.abs(sans.actuel.piliers.repetabilite - 66.67) < 0.01);
  // Une hauteur sans record de 5 min à comparer : la régularité seule
  const sansRecord = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, repN: 3, repRatio: 0.9, repW3: 200 })])!;
  assert.equal(sansRecord.actuel.detailRepetabilite.hauteur, null);
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80 })])!.actuel.piliers.repetabilite, 0);
  // La hauteur compte aussi aux 2/3 avec 2 sorties
  const deux = niveauGlobal([mesure(2025, { w300: 300, repN: 2, repRatio: 1, repW3: 300 })])!;
  assert.ok(Math.abs(deux.actuel.piliers.repetabilite - 66.67) < 0.01); // (100 + 100) / 2 × 2/3
});
