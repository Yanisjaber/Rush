import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PointNiveau, SerieNiveau } from '../../src/data/bilan/niveau-annees.ts';
import { CHARGE_ZERO, ecartsPiliers, HAUTEUR_ZERO, niveauGlobal, noteChargeDe, noteHauteurDe, notePuissanceDe, preuveDe, recordsDeMesures, type MesuresAnnee } from '../../src/data/bilan/piliers-niveau.ts';

const mesure = (an: number, extra: Partial<MesuresAnnee> = {}): MesuresAnnee => ({
  an, w5: null, w300: null, w1200: null, w3600: null, late300: null, late1200: null, nLongues: 0, repRatio: null, repW3: null, repN: 0, ctlMax: null, nCourbes: 50, w7200: null, w10800: null, deriveMed: null, nDerive: 0, heuresLongues: 0, ...extra,
});
/** Une série d'endurance réduite aux années et à leur score. */
const endurance = (scores: Record<number, number>): SerieNiveau => {
  const annuel = Object.entries(scores).map(([an, score]): PointNiveau => ({ cle: an, an: Number(an), tranche: 0, niveau: 150, demi: 3, n: 40, score, bas: score - 3, haut: score + 3 }));
  return { fcReference: 149, tranchesParAn: 1, annuel, tranches: [], meilleur: annuel[0], actuel: annuel[annuel.length - 1] };
};

// Les vraies mesures du compte de test, 2022 à 2026 (l'endurance : 2 h, 3 h, dérive et volume inventés, plausibles)
const REEL: MesuresAnnee[] = [
  mesure(2022, { w5: 939, w300: 265, w1200: 224, w3600: 171, late300: 198, late1200: 162, nLongues: 10, repRatio: 0.907, repW3: 200, repN: 2, ctlMax: 52, w7200: 160, w10800: 140, deriveMed: 8, nDerive: 30, heuresLongues: 140 }),
  mesure(2023, { w5: 1118, w300: 289, w1200: 227, w3600: 201, late300: 255, late1200: 222, nLongues: 46, repRatio: 0.929, repW3: 215, repN: 16, ctlMax: 79.6, w7200: 185, w10800: 165, deriveMed: 6, nDerive: 60, heuresLongues: 220 }),
  mesure(2024, { w5: 1157, w300: 293, w1200: 252, w3600: 201, late300: 254, late1200: 240, nLongues: 57, repRatio: 0.925, repW3: 220, repN: 37, ctlMax: 91, w7200: 195, w10800: 175, deriveMed: 5, nDerive: 70, heuresLongues: 250 }),
  mesure(2025, { w5: 1071, w300: 285, w1200: 259, w3600: 206, late300: 261, late1200: 237, nLongues: 40, repRatio: 0.935, repW3: 190, repN: 26, ctlMax: 90.3, w7200: 200, w10800: 180, deriveMed: 4.5, nDerive: 40, heuresLongues: 150 }),
  mesure(2026, { w5: 1103, w300: 271, w1200: 223, w3600: 194, late300: 242, late1200: 180, nLongues: 6, repRatio: 0.915, repW3: 205, repN: 20, ctlMax: 69.6, w7200: 190, w10800: 170, deriveMed: 6, nDerive: 8, heuresLongues: 25 }),
];

test('niveauGlobal : les cinq piliers de chaque année et leur moyenne (vraies mesures)', () => {
  const g = niveauGlobal(REEL);
  assert.ok(g);
  assert.deepEqual(g.annees.map((a) => a.an), [2022, 2023, 2024, 2025, 2026]);
  // Le score global d'une année est la moyenne de ses piliers mesurés
  const par = Object.fromEntries(g.annees.map((a) => [a.an, a]));
  assert.ok(Math.abs(par[2025].global! - 79) <= 2, `2025 : ${par[2025].global}`);
  assert.ok(Math.abs(par[2024].global! - 82) <= 3, `2024 : ${par[2024].global}`);
  assert.ok(Math.abs(par[2026].global! - 58) <= 3, `2026 : ${par[2026].global}`);
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
  assert.equal(g.faible, 'durabilite'); // 2026 : 6 sorties longues seulement, la durabilité (50) est le plus bas des cinq ; la charge (CTL 69,6 contre 91) est à 61
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
  // Endurance 2025 : 2 h et 3 h sont les meilleurs de toujours (100), dérive 4,5 % → 70, volume 150 h sur 250 h → 60 : moyenne 76,7
  const e = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.endurance;
  assert.equal(e.puissanceLongue, 100);
  assert.ok(Math.abs(e.derive! - 70) < 1e-9, `${e.derive}`);
  assert.equal(e.volume, 60);
  assert.ok(Math.abs(p.endurance! - 76.67) < 0.01, `${p.endurance}`);
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
  assert.equal(e.find((x) => x.cle === 'endurance')!.ecart, 51 - 77); // volume 2026 : 25 h seulement
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

test('niveauGlobal : l\'endurance demande 2 de ses 3 notes ; la dérive demande 3 sorties ; une dérive de 15 % ou plus vaut 0', () => {
  // Volume seul (pas de capteur, pas de dérive) : une note sur deux demandées, donc la moitié de la note du volume
  const seul = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100 })])!;
  assert.equal(seul.actuel.piliers.endurance, 50);
  assert.equal(seul.actuel.preuves.endurance, 0.5);
  assert.equal(seul.actuel.endurance.volume, 100);
  // Aucune heure longue du tout : 0
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80 })])!.actuel.piliers.endurance, 0);
  // 2 sorties avec dérive : la dérive est notée aux 2/3 (80 × 2/3 = 53,3) ; avec le volume, deux notes : endurance complète
  const deux = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100, deriveMed: 3, nDerive: 2 })])!;
  assert.ok(Math.abs(deux.actuel.endurance.derive! - 53.33) < 0.01);
  assert.ok(Math.abs(deux.actuel.piliers.endurance - 76.67) < 0.01);
  assert.equal(deux.actuel.preuves.endurance, 1);
  const trois = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, heuresLongues: 100, deriveMed: 3, nDerive: 3 })])!;
  assert.ok(Math.abs(trois.actuel.endurance.derive! - 80) < 1e-9);
  assert.ok(Math.abs(trois.actuel.piliers.endurance! - 90) < 1e-9); // (80 + 100) / 2
  // Dérive de 20 % : 0 ; dérive négative (2e moitié plus efficace) : plafonnée à 100
  const forte = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, heuresLongues: 100, deriveMed: 20, nDerive: 5 })])!;
  assert.equal(forte.actuel.endurance.derive, 0);
  const negative = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, heuresLongues: 100, deriveMed: -2, nDerive: 5 })])!;
  assert.equal(negative.actuel.endurance.derive, 100);
  // Une année à 2 sorties avec capteur : la puissance longue compte, aux 2/3 (comme la puissance)
  const capteur = niveauGlobal([mesure(2025, { w7200: 200, ctlMax: 80, nCourbes: 2, heuresLongues: 100, deriveMed: 3, nDerive: 3 })])!;
  assert.ok(Math.abs(capteur.actuel.endurance.puissanceLongue! - 66.67) < 0.01);
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
