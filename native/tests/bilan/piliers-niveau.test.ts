import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PointNiveau, SerieNiveau } from '../../src/data/bilan/niveau-annees.ts';
import { CHARGE_ZERO, DECOUPLAGE_CENT, DECOUPLAGE_ZERO, ecartsPiliers, FACILITE_CENT, FACILITE_ZERO, HAUTEUR_ZERO, niveauGlobal, noteChargeDe, noteHauteurDe, noteLineaire, notePuissanceDe, PILIERS, POIDS_ENDURANCE, preuveDe, recordsDeMesures, type MesuresAnnee } from '../../src/data/bilan/piliers-niveau.ts';

const mesure = (an: number, extra: Partial<MesuresAnnee> = {}): MesuresAnnee => ({
  an, w5: null, w300: null, w1200: null, w3600: null, repRatio: null, repW3: null, repN: 0, ctlMax: null, nCourbes: 50, pRef: null, fcRef: null, nFc: 0, driftMed: null, nDrift: 0, ...extra,
  // la charge moyenne de l'année : par défaut la valeur de ctlMax donnée au test (la note de charge se fait sur la moyenne)
  ctlMoy: extra.ctlMoy !== undefined ? extra.ctlMoy : (extra.ctlMax ?? null),
});
/** Une série d'endurance réduite aux années et à leur score. */
const endurance = (scores: Record<number, number>): SerieNiveau => {
  const annuel = Object.entries(scores).map(([an, score]): PointNiveau => ({ cle: an, an: Number(an), tranche: 0, niveau: 150, demi: 3, n: 40, score, bas: score - 3, haut: score + 3 }));
  return { fcReference: 149, tranchesParAn: 1, annuel, tranches: [], meilleur: annuel[0], actuel: annuel[annuel.length - 1] };
};

// Les vraies mesures du compte de test, 2022 à 2026 (le découplage de l'endurance est inventé, plausible)
const REEL: MesuresAnnee[] = [
  mesure(2022, { w5: 939, w300: 265, w1200: 224, w3600: 171, repRatio: 0.907, repW3: 200, repN: 2, ctlMax: 52, pRef: 172, fcRef: 143, nFc: 5, driftMed: 8, nDrift: 6 }),
  mesure(2023, { w5: 1118, w300: 289, w1200: 227, w3600: 201, repRatio: 0.929, repW3: 215, repN: 16, ctlMax: 79.6, pRef: 172, fcRef: 140, nFc: 10, driftMed: 6, nDrift: 10 }),
  mesure(2024, { w5: 1157, w300: 293, w1200: 252, w3600: 201, repRatio: 0.925, repW3: 220, repN: 37, ctlMax: 91, pRef: 172, fcRef: 135, nFc: 10, driftMed: 5, nDrift: 10 }),
  mesure(2025, { w5: 1071, w300: 285, w1200: 259, w3600: 206, repRatio: 0.935, repW3: 190, repN: 26, ctlMax: 90.3, pRef: 172, fcRef: 132, nFc: 10, driftMed: 4.5, nDrift: 10 }),
  mesure(2026, { w5: 1103, w300: 271, w1200: 223, w3600: 194, repRatio: 0.915, repW3: 205, repN: 20, ctlMax: 69.6, pRef: 172, fcRef: 133, nFc: 3, driftMed: 6, nDrift: 3 }),
];

test('niveauGlobal : les quatre piliers de chaque année et leur moyenne (vraies mesures)', () => {
  const g = niveauGlobal(REEL);
  assert.ok(g);
  assert.deepEqual(g.annees.map((a) => a.an), [2022, 2023, 2024, 2025, 2026]);
  // Le score global d'une année est la moyenne de ses piliers mesurés
  const par = Object.fromEntries(g.annees.map((a) => [a.an, a]));
  assert.ok(Math.abs(par[2025].global! - 83) <= 1, `2025 : ${par[2025].global}`);
  assert.ok(Math.abs(par[2024].global! - 84) <= 1, `2024 : ${par[2024].global}`);
  assert.ok(Math.abs(par[2026].global! - 62) <= 1, `2026 : ${par[2026].global}`);
  assert.ok(par[2022].global! < par[2023].global!);
  assert.equal(par[2025].nbPiliers, 4);
  // 2022 n'a que 2 sorties à trois vrais efforts : la répétabilité est notée, mais aux 2/3 :
  // régularité (0,907 − 0,7) / 0,3 = 69 ; hauteur : 200 W sur un record de 293 W = 68,3 % → (0,683 − 0,5) / 0,5 = 36,5 ; moyenne 52,8 ; × 2/3 = 35,2
  assert.ok(Math.abs(par[2022].piliers.repetabilite - 35.2) < 0.5, `${par[2022].piliers.repetabilite}`);
  assert.ok(Math.abs(par[2022].preuves.repetabilite - 2 / 3) < 1e-9);
  assert.equal(par[2022].nbPiliers, 3); // les trois autres ont toutes leurs preuves
});

test('niveauGlobal : l\'année actuelle, l\'année d\'avant, le meilleur, le point fort et le point faible', () => {
  const g = niveauGlobal(REEL)!;
  assert.equal(g.actuel.an, 2026);
  assert.equal(g.precedent!.an, 2025);
  assert.ok(g.meilleur.an === 2025 || g.meilleur.an === 2024);
  assert.equal(g.fort, 'charge'); // 2026 : charge ≈ 67 (CTL moyen 69,6 contre une référence de 87), juste devant l'endurance (≈ 64) et la puissance (60)
  assert.equal(g.faible, 'repetabilite'); // la répétabilité (≈ 56) est le plus bas des quatre
});

test('niveauGlobal : les notes des piliers sont ce qu\'on attend', () => {
  const p = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.piliers;
  // Répétabilité 2025 : régularité 0,935 → 78,3 ; hauteur 190 W sur 293 W = 64,8 % → 29,7 ; moyenne des deux : 54,0
  assert.ok(Math.abs(p.repetabilite - 54) < 0.5, `${p.repetabilite}`);
  const d = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.detailRepetabilite;
  assert.ok(Math.abs(d.regularite! - 78.33) < 0.01 && Math.abs(d.hauteur! - 29.69) < 0.01, `${d.regularite} ${d.hauteur}`);
  // Charge 2025 : 90,3 / 91 = 99,2 % → (0,992 − 0,4) / 0,6 = 98,7
  // Charge 2025 : la référence est la moyenne des 3 meilleures années ((91 + 90,3 + 79,6) / 3 = 87) ; 90,3 est au-dessus → 100
  assert.equal(p.charge, 100);
  // Puissance : la meilleure durée de chaque année vaut 100 pour son année record ; 2025 : sprint 1071/1157, 5 min 285/293, 20 min 100 %, 60 min 100 %
  assert.ok(p.puissance! > 85 && p.puissance! < 96, `${p.puissance}`);
  // Endurance 2025 : F = 172 / (0,95 × 259) = 69,9 % de la FTP → 100 ; H = 132 bpm = ton meilleur → 100 ; C = (12 − 4,5) / 10 → 75
  // note = 0,35 × 100 + 0,30 × 100 + 0,35 × 75 = 91,25
  const e = niveauGlobal(REEL)!.annees.find((a) => a.an === 2025)!.endurance;
  assert.equal(e.facilite, 100);
  assert.equal(e.cardio, 100);
  assert.equal(e.decouplage, 75);
  assert.ok(Math.abs(p.endurance! - 91.25) < 1e-9, `${p.endurance}`);
});

test('niveauGlobal : chaque année a une note à chaque pilier, même sans mesure (0 quand rien n\'est mesuré)', () => {
  assert.equal(niveauGlobal([]), null);
  // Une année avec un seul sprint : la puissance vaut 100 (c'est son meilleur), tout le reste 0, soit un score de 100 / 4 = 25
  const seul = niveauGlobal([mesure(2025, { w5: 1000 })])!;
  assert.deepEqual(seul.actuel.piliers, { puissance: 100, endurance: 0, repetabilite: 0, charge: 0 });
  assert.equal(seul.actuel.global, 25);
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

test('niveauGlobal : la répétabilité aussi : 3 sorties = note complète, 1 sortie = le tiers, aucune = 0', () => {
  const note = (repN: number, repRatio: number | null) => niveauGlobal([mesure(2025, { w5: 1000, w300: 300, ctlMax: 80, repN, repRatio })])!.actuel.piliers.repetabilite;
  assert.ok(Math.abs(note(3, 0.9) - 66.67) < 0.01);
  assert.ok(Math.abs(note(1, 0.9) - 22.22) < 0.01);
  assert.equal(note(0, null), 0);
  assert.equal(note(5, 1.2), 100); // plafonnée
});

test('ecartsPiliers : ce qui a bougé depuis l\'année d\'avant, seulement pour les piliers mesurés les deux années', () => {
  const g = niveauGlobal(REEL)!;
  const e = ecartsPiliers(g);
  assert.deepEqual(e.map((x) => x.cle), ['puissance', 'endurance', 'repetabilite', 'charge']);
  const charge = e.find((x) => x.cle === 'charge')!;
  assert.ok(charge.ecart < -30, `charge ${charge.ecart}`); // CTL moyen 90 → 70 : le plus gros recul (100 → 67)
  assert.equal(e.find((x) => x.cle === 'endurance')!.ecart, -27); // 2026 (≈ 64) contre 2025 (≈ 91) : effort relatif de 81 % de la FTP au lieu de 70 %, découplage de 6 % au lieu de 4,5 %
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
  assert.equal(g.annees[0].global, 10); // charge 55 contre la référence de 87 (3 meilleures années) = 63 % → 39 sur l'échelle douce, le reste 0 : 39 / 4 = 9,7, arrondi à 10
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

test('noteLineaire : les bornes de la formule d\'endurance (F 90 → 70 % de la FTP, C 12 → 2 %)', () => {
  assert.equal(noteLineaire(0.9, FACILITE_ZERO, FACILITE_CENT), 0);
  assert.equal(noteLineaire(1.05, FACILITE_ZERO, FACILITE_CENT), 0); // une puissance au-dessus de la FTP : tout en bas
  assert.equal(noteLineaire(0.7, FACILITE_ZERO, FACILITE_CENT), 100);
  assert.equal(noteLineaire(0.6, FACILITE_ZERO, FACILITE_CENT), 100);
  assert.ok(Math.abs(noteLineaire(0.8, FACILITE_ZERO, FACILITE_CENT) - 50) < 1e-9);
  assert.equal(noteLineaire(12, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 0);
  assert.equal(noteLineaire(20, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 0); // 20 % : tout en bas
  assert.equal(noteLineaire(2, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 100);
  assert.equal(noteLineaire(-3, DECOUPLAGE_ZERO, DECOUPLAGE_CENT), 100); // 2e moitié plus efficace : plafonné
  assert.ok(Math.abs(noteLineaire(7, DECOUPLAGE_ZERO, DECOUPLAGE_CENT) - 50) < 1e-9);
});

test('niveauGlobal : endurance à puissance fixe : la même puissance de référence pour toutes les années (2019 contre 2026)', () => {
  // Référence = 200 W pour toutes les années. 2019 : meilleur 20 min 223 W → FTP 211,9 W → 200 W = 94 % de la FTP (très dur) ; 2026 : 300 W → FTP 285 W → 70 % (facile)
  const g = niveauGlobal([
    mesure(2019, { w1200: 223, pRef: 200, fcRef: 143, nFc: 7, driftMed: 1.6, nDrift: 7, ctlMax: 60 }),
    mesure(2026, { w1200: 300, pRef: 200, fcRef: 132, nFc: 10, driftMed: 3.1, nDrift: 10, ctlMax: 80 }),
  ])!;
  const a2019 = g.annees.find((a) => a.an === 2019)!;
  const a2026 = g.annees.find((a) => a.an === 2026)!;
  assert.equal(a2019.endurance.facilite, 0); // 94 % de la FTP : au-delà de 90 %
  assert.ok(Math.abs(a2026.endurance.facilite! - 99.1) < 0.1, `${a2026.endurance.facilite}`); // 70,2 %
  // Le cœur : ton meilleur (le plus bas) est 132 bpm (2026) ; 2019 est 11 bpm au-dessus → (147 − 143) / 15 = 26,7
  assert.ok(Math.abs(a2019.endurance.cardio! - 26.67) < 0.01, `${a2019.endurance.cardio}`);
  assert.equal(a2026.endurance.cardio, 100);
  // Le découplage seul dit l'inverse (2019 est à 1,6 %) : mais l'endurance de 2026 est bien plus haute, car elle voit « plus facile » et « cœur plus bas »
  assert.ok(a2019.endurance.decouplage! > a2026.endurance.decouplage!);
  assert.ok(a2026.piliers.endurance - a2019.piliers.endurance > 40, `${a2019.piliers.endurance} → ${a2026.piliers.endurance}`);
});

test('niveauGlobal : endurance = 100 × (0,35 F + 0,30 H + 0,35 C), chaque lettre aux 3 sorties de preuve ; une lettre sans mesure vaut 0', () => {
  // Tout au maximum : F 100 (199 W ≤ 70 % de la FTP de 285 W), H 100 (ton meilleur cœur), C 100 (2 % ou moins) → 100
  const plein = niveauGlobal([mesure(2025, { w5: 1000, w300: 300, w1200: 300, pRef: 199, fcRef: 120, nFc: 5, driftMed: 2, nDrift: 5, ctlMax: 80 })])!;
  assert.ok(Math.abs(plein.actuel.piliers.endurance - 100) < 1e-9, `${plein.actuel.piliers.endurance}`);
  assert.equal(plein.actuel.preuves.endurance, 1);
  // Rien de mesuré : 0, sans preuve
  const rien = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80 })])!;
  assert.equal(rien.actuel.piliers.endurance, 0);
  assert.equal(rien.actuel.preuves.endurance, 0);
  assert.deepEqual(rien.actuel.endurance, { facilite: null, cardio: null, decouplage: null });
  // Le découplage seul (C = 100, poids 35 %) : 35, preuve 0,35 ; avec 2 sorties sur 3 : aux 2/3 (23,33)
  const seulC = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 2, nDrift: 3 })])!;
  assert.ok(Math.abs(seulC.actuel.piliers.endurance - 35) < 1e-9);
  assert.ok(Math.abs(seulC.actuel.preuves.endurance - 0.35) < 1e-9);
  const deux = niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 2, nDrift: 2 })])!;
  assert.ok(Math.abs(deux.actuel.piliers.endurance - 23.33) < 0.01);
  // Un découplage de 20 % vaut 0 ; une 2e moitié plus efficace (négatif) est plafonnée à 100
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: 20, nDrift: 5 })])!.actuel.endurance.decouplage, 0);
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, driftMed: -2, nDrift: 5 })])!.actuel.endurance.decouplage, 100);
  // F : 228 W sur une FTP de 285 W = 80 % → 50 ; 2 sorties avec capteur seulement → aux 2/3 de la puissance (0,35 × 50 × 2/3 = 11,67)
  const facile = niveauGlobal([mesure(2025, { w1200: 300, pRef: 228, nCourbes: 2, ctlMax: 80 })])!;
  assert.ok(Math.abs(facile.actuel.endurance.facilite! - 50) < 1e-9);
  assert.ok(Math.abs(facile.actuel.piliers.endurance - 11.67) < 0.01);
  // H : ton meilleur cœur 125 bpm = 100 ; 132 bpm = (140 − 132) / 15 = 53,3 ; 140 bpm (15 de plus) = 0
  const coeurs = niveauGlobal([
    mesure(2019, { w1200: 300, fcRef: 140, nFc: 5 }),
    mesure(2022, { w1200: 300, fcRef: 132, nFc: 5 }),
    mesure(2026, { w1200: 300, fcRef: 125, nFc: 5 }),
  ])!;
  const parAn = Object.fromEntries(coeurs.annees.map((a) => [a.an, a.endurance.cardio]));
  assert.equal(parAn[2019], 0);
  assert.ok(Math.abs(parAn[2022]! - 53.33) < 0.01, `${parAn[2022]}`);
  assert.equal(parAn[2026], 100);
});

test('notePuissanceDe : 100 au meilleur, 0 à 20 % en dessous, en ligne droite (plus exigeante que les autres piliers : 0 à 30 %)', () => {
  assert.equal(notePuissanceDe(1), 100);
  assert.ok(Math.abs(notePuissanceDe(0.9) - 50) < 1e-9);
  assert.equal(notePuissanceDe(0.8), 0);
  assert.equal(notePuissanceDe(0.5), 0);
  assert.equal(notePuissanceDe(1.1), 100);
});

test('noteChargeDe : 100 à la référence, 0 à 40 % de la référence, en ligne droite (plus douce que les autres piliers : 0 à 70 %)', () => {
  assert.equal(CHARGE_ZERO, 0.4);
  assert.equal(noteChargeDe(1), 100);
  assert.equal(noteChargeDe(1.3), 100); // plafonnée
  assert.equal(noteChargeDe(0.4), 0);
  assert.equal(noteChargeDe(0.1), 0); // plancher
  assert.ok(Math.abs(noteChargeDe(0.7) - 50) < 1e-9);
  // Le cas de 2022 : CTL 52 contre 91 = 57 % : 28,6 au lieu de 0 sur l'échelle des autres piliers
  assert.ok(Math.abs(noteChargeDe(52 / 91) - 28.57) < 0.01);
  // Avec 2 années seulement, la référence est la moyenne des deux : (91 + 52) / 2 = 71,5 ; 52 / 71,5 = 72,7 % → 54,5
  const g = niveauGlobal([mesure(2024, { ctlMax: 91 }), mesure(2022, { ctlMax: 52 })])!;
  assert.ok(Math.abs(g.annees[0].piliers.charge - 54.55) < 0.01, `${g.annees[0].piliers.charge}`);
});

test('niveauGlobal : la charge se juge sur la charge MOYENNE de l\'année contre la moyenne des 3 meilleures années : une année gonflée ne fixe pas le « 100 »', () => {
  // 2022 : pic gonflé (FTP trop basse) ; les autres années sont stables. Référence = (150 + 64 + 62) / 3 = 92
  const g = niveauGlobal([
    mesure(2022, { ctlMax: 160, ctlMoy: 150 }),
    mesure(2023, { ctlMax: 70, ctlMoy: 62 }),
    mesure(2024, { ctlMax: 72, ctlMoy: 64 }),
    mesure(2025, { ctlMax: 70, ctlMoy: 60 }),
  ])!;
  const charge = Object.fromEntries(g.annees.map((a) => [a.an, a.piliers.charge]));
  assert.equal(charge[2022], 100); // au-dessus de la référence : plafonné
  assert.ok(Math.abs(charge[2024] - 49.28) < 0.01, `${charge[2024]}`); // 64 / 92 = 69,6 % → 49,3 (contre 4,5 si la meilleure année fixait le 100)
  // Seule la moyenne compte : un pic de 400 sur une année à CTL moyen de 62 ne change rien à sa note
  const pic = niveauGlobal([mesure(2023, { ctlMax: 400, ctlMoy: 62 }), mesure(2024, { ctlMax: 72, ctlMoy: 62 })])!;
  assert.equal(pic.annees[0].piliers.charge, pic.annees[1].piliers.charge);
  // Sans charge moyenne (base pas à jour) : la note de charge est 0, jamais d'erreur
  assert.equal(niveauGlobal([mesure(2025, { w5: 1000, ctlMax: 80, ctlMoy: null })])!.actuel.piliers.charge, 0);
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

test('piliers : la durabilité est retirée (quatre piliers) et les poids de l\'endurance font exactement 1', () => {
  assert.deepEqual(PILIERS.map((p) => p.cle), ['puissance', 'endurance', 'repetabilite', 'charge']);
  assert.ok(Math.abs(Object.values(POIDS_ENDURANCE).reduce((t, x) => t + x, 0) - 1) < 1e-9);
  assert.deepEqual(Object.keys(POIDS_ENDURANCE), ['facilite', 'cardio', 'decouplage']);
});
