// Le niveau global de l'athlète à vélo : cinq piliers, chacun noté de 0 à 100, et leur moyenne. Calculs purs, testés dans tests/bilan/piliers-niveau.test.ts.
//   puissance    : la force de pointe, moyenne des notes de ton meilleur sprint (5 s), 5, 20 et 60 minutes de l'année (100 = ton meilleur de chaque durée, 0 = 20 % en dessous ; les autres piliers gardent 30 %) ;
//   endurance    : tenir longtemps (formule de Yanis, 3 nov. 2026), note = 100 × (0,20 D + 0,35 R + 0,45 C), chaque lettre remise entre 0 et 1 :
//                    - D fatigue : meilleur 20 min APRÈS 30 kJ/kg de travail cumulé ÷ meilleur 20 min frais de l'année ; 0 à 85 %, 1 à 97 % ;
//                    - R longue durée : meilleur 2 h 30 de l'année ÷ FTP de l'année (95 % de son meilleur 20 min) ; 0 à 65 %, 1 à 85 % ;
//                    - C découplage : médiane des 10 dernières sorties Z2 (55 à 75 % de la FTP) de 90 min et plus, EF = puissance normalisée / FC, 1re contre 2e moitié ; 12 % = 0, 2 % = 1 ;
//                  chaque lettre est multipliée par sa preuve (3 sorties demandées) ; une lettre sans mesure vaut 0 ;
//                  (les watts à cardio égal, l'ancien pilier « Endurance », sont devenus la Forme : voir niveau-annees.ts et forme-saison.ts) ;
//   durabilité   : garder sa puissance fatigué : meilleur 5 et 20 min après 2 h 30 de sortie, divisé par le meilleur à froid (100 = aucune perte, 0 = 30 % de perte) ;
//   répétabilité : reproduire les efforts, moyenne de deux notes (2 nov. 2026) :
//                    - régularité : dans une sortie, le 3e effort de 5 min divisé par le 1er (100 = aucune perte, 0 = 30 % de perte) ;
//                    - hauteur : le 3e effort (médiane de l'année) divisé par ton meilleur 5 min de TOUS LES TEMPS (0 à 50 %, 100 à 100 %) : répéter des efforts
//                      plus forts compte plus que répéter des efforts faciles. Un « vrai effort » vaut au moins 50 % de ce record (calculé côté base) ;
//   charge       : encaisser et enchaîner l'entraînement : la charge chronique (CTL) maximale de l'année (100 = ta meilleure année, 0 à 40 % de ta meilleure année :
//                  une échelle plus douce que les autres piliers, car la charge est une quantité d'entraînement, pas un niveau de performance : passer de 52 à 91 est presque doubler).
// Une note existe toujours (2 nov. 2026) : quand il manque des sorties pour la juger, la note est calculée avec ce qu'il y a puis RÉDUITE de la part qui manque
// (2 sorties sur les 3 demandées = 2/3 de la note ; aucune = 0). Chaque note a sa « preuve » (de 0 à 1) : 1 = toutes les sorties demandées sont là. L'écran marque
// les notes à preuve incomplète. Le score global est la moyenne des 5 notes, preuve incomplète comprise.
// La récupération physiologique (HRV, FC au repos) n'est pas dans le score : elle demande des mois de mesures. La capacité de charge est ce qu'on peut dire de l'entraînement encaissé.
import { noteDe } from './niveau-annees.ts';

export type PilierCle = 'puissance' | 'endurance' | 'durabilite' | 'repetabilite' | 'charge';
export const PILIERS: readonly { cle: PilierCle; nom: string; court: string; explication: string }[] = [
  { cle: 'puissance', nom: 'Puissance', court: 'Puissance', explication: 'Sprint, 5, 20 et 60 min' },
  { cle: 'endurance', nom: 'Endurance', court: 'Endurance', explication: 'Puissance après fatigue, 2 h 30 contre ta FTP, découplage cardiaque' },
  { cle: 'durabilite', nom: 'Durabilité', court: 'Durabilité', explication: 'Puissance gardée après 2 h 30' },
  { cle: 'repetabilite', nom: 'Répétabilité', court: 'Répétabilité', explication: '3e effort contre le 1er' },
  { cle: 'charge', nom: 'Capacité de charge', court: 'Charge', explication: 'Charge chronique maximale' },
];

/** Ce que rpc_piliers_annuels renvoie pour une année (les watts en entiers, null quand la mesure n'existe pas). */
export interface MesuresAnnee {
  an: number;
  w5: number | null;
  w300: number | null;
  w1200: number | null;
  w3600: number | null;
  late300: number | null;
  late1200: number | null;
  nLongues: number;
  repRatio: number | null;
  /** Médiane (en watts) du 3e effort de 5 min des sorties valides : la hauteur des efforts répétés. */
  repW3: number | null;
  repN: number;
  ctlMax: number | null;
  /** Combien de sorties de l'année ont une courbe de puissance (un capteur). */
  nCourbes: number;
  /** Meilleure puissance sur 2 h 30 de l'année. */
  w9000: number | null;
  /** Meilleur 20 min APRÈS fatigue (30 kJ/kg de travail déjà fait) de l'année, et le nombre de sorties qui en ont un. */
  fat20: number | null;
  nFat: number;
  /** Médiane du découplage cardiaque (en %) des 10 dernières sorties Z2 de 90 min et plus de l'année, et le nombre de sorties qui ont compté. */
  driftMed: number | null;
  nDrift: number;
}

/** Les trois notes (0 à 100, avant leur poids et leur preuve) qui font l'endurance d'une année ; null quand la mesure manque. */
export interface DetailEndurance {
  /** D : meilleur 20 min après fatigue ÷ meilleur 20 min frais. */
  fatigue: number | null;
  /** R : meilleur 2 h 30 ÷ FTP de l'année. */
  longue: number | null;
  /** C : découplage cardiaque en Z2. */
  decouplage: number | null;
}

/** Les deux notes qui font la répétabilité d'une année (null quand la mesure manque ; avant la hauteur, la régularité faisait seule la note). */
export interface DetailRepetabilite {
  regularite: number | null;
  hauteur: number | null;
}

/** Une note de 0 à 100 par pilier : jamais vide. */
export type NotesPiliers = Record<PilierCle, number>;
/** La part de preuve de chaque note, de 0 (rien de mesuré) à 1 (toutes les sorties demandées sont là). */
export type PreuvesPiliers = Record<PilierCle, number>;

export interface NiveauGlobalAnnee {
  an: number;
  piliers: NotesPiliers;
  /** À quel point chaque note est appuyée par des mesures (1 = toutes les sorties demandées). */
  preuves: PreuvesPiliers;
  /** La moyenne des 5 piliers, arrondie. */
  global: number;
  /** Combien de piliers sur 5 ont toutes leurs preuves cette année-là. */
  nbPiliers: number;
  /** Le détail de la note d'endurance. */
  endurance: DetailEndurance;
  /** Le détail de la note de répétabilité. */
  detailRepetabilite: DetailRepetabilite;
}

export interface NiveauGlobal {
  annees: NiveauGlobalAnnee[];
  /** La dernière année. */
  actuel: NiveauGlobalAnnee;
  /** L'année d'avant, s'il y en a une. */
  precedent: NiveauGlobalAnnee | null;
  /** L'année qui a le plus haut score global. */
  meilleur: NiveauGlobalAnnee;
  /** Le pilier le plus haut et le plus bas de l'année actuelle. */
  fort: PilierCle;
  faible: PilierCle;
}

/** Les sorties demandées pour une note complète : 3 sorties longues pour la durabilité, 3 sorties à trois vrais efforts pour la répétabilité,
 *  3 sorties avec capteur pour la puissance (une seule sortie, souvent un capteur en panne, ne fixe jamais ton « meilleur »). Avec moins, la note est réduite. */
export const SORTIES_MINI_PUISSANCE = 3;
export const SORTIES_MINI_DURABILITE = 3;
export const SORTIES_MINI_REPETABILITE = 3;
/** L'endurance (formule de Yanis, 3 nov. 2026) : 20 % la fatigue (D), 35 % la longue durée (R), 45 % le découplage (C). Chaque note est un rapport remis entre 0 et 1 ; sa preuve
 *  demande 3 sorties (3 sorties après fatigue, 3 sorties Z2, 3 sorties avec capteur pour la FTP de l'année) : avec moins, la note est réduite d'autant. */
export const SORTIES_MINI_FATIGUE = 3;
export const SORTIES_MINI_DECOUPLAGE = 3;
export const POIDS_ENDURANCE = { fatigue: 0.2, longue: 0.35, decouplage: 0.45 } as const;
/** D : le 20 min après fatigue vaut 0 à 85 % du 20 min frais (ou moins), 100 à 97 % (ou plus). */
export const FATIGUE_ZERO = 0.85;
export const FATIGUE_CENT = 0.97;
/** R : le meilleur 2 h 30 vaut 0 à 65 % de la FTP (ou moins), 100 à 85 % (ou plus). */
export const LONGUE_ZERO = 0.65;
export const LONGUE_CENT = 0.85;
/** C : un découplage de 12 % (ou plus) vaut 0, 2 % (ou moins) vaut 100. */
export const DECOUPLAGE_ZERO = 12;
export const DECOUPLAGE_CENT = 2;
/** Une note linéaire entre `zero` (note 0) et `cent` (note 100), bornée ; marche dans les deux sens (le découplage : plus c'est bas, mieux c'est). */
export const noteLineaire = (x: number, zero: number, cent: number): number => Math.max(0, Math.min(100, ((x - zero) / (cent - zero)) * 100));

const moyenne = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
/** Les puissances d'une année sont fiables seulement avec assez de sorties avec capteur. */
const puissanceFiable = (m: MesuresAnnee): boolean => m.nCourbes >= SORTIES_MINI_PUISSANCE;
const meilleurDe = (valeurs: (number | null)[]): number => Math.max(0, ...valeurs.filter((v): v is number => v !== null));
/** La hauteur des efforts répétés est notée de 0 (3e effort à 50 % de ton meilleur 5 min de tous les temps, la barre d'un « vrai effort ») à 100 (3e effort égal à ton record). */
export const HAUTEUR_ZERO = 0.5;
export const noteHauteurDe = (rapport: number): number => Math.max(0, Math.min(100, ((rapport - HAUTEUR_ZERO) / (1 - HAUTEUR_ZERO)) * 100));

/** La charge est notée de 0 (40 % de ta meilleure année ou moins) à 100 (ta meilleure année) : plus douce que `noteDe` (0 à 70 %), voir l'en-tête. */
export const CHARGE_ZERO = 0.4;
export const noteChargeDe = (rapport: number): number => Math.max(0, Math.min(100, ((rapport - CHARGE_ZERO) / (1 - CHARGE_ZERO)) * 100));

/** La puissance est notée de 0 (20 % sous ton meilleur de toujours ou moins) à 100 (ton meilleur) : plus exigeante que `noteDe` (0 à 30 % sous), qui reste l'échelle des autres piliers. */
export const PUISSANCE_ZERO = 0.8;
export const notePuissanceDe = (rapport: number): number => Math.max(0, Math.min(100, ((rapport - PUISSANCE_ZERO) / (1 - PUISSANCE_ZERO)) * 100));

/** La part de preuve : `n` sorties sur les `requis` demandées, entre 0 et 1. */
export const preuveDe = (n: number, requis: number): number => Math.max(0, Math.min(1, n / requis));

/**
 * Les notes de chaque pilier pour chaque année, et le score global (moyenne des 5 notes). Une note est toujours là : calculée avec ce qui est mesuré,
 * puis multipliée par sa preuve (voir l'en-tête). Null s'il n'y a aucune année.
 */
export function niveauGlobal(mesures: readonly MesuresAnnee[]): NiveauGlobal | null {
  if (!mesures.length) return null;
  const fiables = mesures.filter(puissanceFiable);
  // Ton « meilleur de toujours » se lit sur les années fiables ; sans aucune, sur celles qui ont au moins une sortie avec capteur
  const reference = fiables.length ? fiables : mesures.filter((m) => m.nCourbes > 0);
  const meilleurs = {
    w5: meilleurDe(reference.map((m) => m.w5)),
    w300: meilleurDe(reference.map((m) => m.w300)),
    w1200: meilleurDe(reference.map((m) => m.w1200)),
    w3600: meilleurDe(reference.map((m) => m.w3600)),
    ctl: meilleurDe(mesures.map((m) => m.ctlMax)),
  };
  const parAn = new Map<number, MesuresAnnee>(mesures.map((m) => [m.an, m]));
  const annees = [...parAn.keys()].sort((a, b) => a - b);

  const resultat: NiveauGlobalAnnee[] = [];
  for (const an of annees) {
    const m = parAn.get(an)!;
    const preuvePuissance = preuveDe(m.nCourbes, SORTIES_MINI_PUISSANCE);

    const durees = [['w5', m.w5], ['w300', m.w300], ['w1200', m.w1200], ['w3600', m.w3600]] as const;
    const notesPuissance = durees.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => notePuissanceDe((v as number) / meilleurs[cle]));
    const puissance = (moyenne(notesPuissance) ?? 0) * preuvePuissance;

    const ratiosDurabilite = [m.late300 && m.w300 ? m.late300 / m.w300 : null, m.late1200 && m.w1200 ? m.late1200 / m.w1200 : null].filter((r): r is number => r !== null);
    const preuveDurabilite = preuveDe(m.nLongues, SORTIES_MINI_DURABILITE);
    const durabilite = ratiosDurabilite.length ? noteDe(Math.min(1, moyenne(ratiosDurabilite)!)) * preuveDurabilite : 0;

    const preuveRepetabilite = preuveDe(m.repN, SORTIES_MINI_REPETABILITE);
    const detailRepetabilite: DetailRepetabilite = {
      regularite: m.repRatio !== null ? noteDe(Math.min(1, m.repRatio)) : null,
      hauteur: m.repW3 !== null && meilleurs.w300 > 0 ? noteHauteurDe(m.repW3 / meilleurs.w300) : null,
    };
    // Sans la hauteur (une ancienne version de la base ne la rend pas), la régularité fait seule la note
    const repetabilite = (moyenne([detailRepetabilite.regularite, detailRepetabilite.hauteur].filter((v): v is number => v !== null)) ?? 0) * preuveRepetabilite;

    // Endurance : D (fatigue), R (longue durée), C (découplage). La FTP de l'année = 95 % de son meilleur 20 min.
    const ftpAnnee = m.w1200 !== null && m.w1200 > 0 ? 0.95 * m.w1200 : null;
    const endurance: DetailEndurance = {
      fatigue: m.fat20 !== null && m.w1200 !== null && m.w1200 > 0 ? noteLineaire(m.fat20 / m.w1200, FATIGUE_ZERO, FATIGUE_CENT) : null,
      longue: m.w9000 !== null && ftpAnnee !== null ? noteLineaire(m.w9000 / ftpAnnee, LONGUE_ZERO, LONGUE_CENT) : null,
      decouplage: m.driftMed !== null && m.nDrift > 0 ? noteLineaire(m.driftMed, DECOUPLAGE_ZERO, DECOUPLAGE_CENT) : null,
    };
    // Chaque note compte pour son poids, multipliée par sa preuve ; une note qui manque vaut 0 et sa part de preuve aussi
    const preuveFatigue = endurance.fatigue !== null ? preuveDe(m.nFat, SORTIES_MINI_FATIGUE) : 0;
    const preuveLongue = endurance.longue !== null ? preuvePuissance : 0;
    const preuveDecouplage = endurance.decouplage !== null ? preuveDe(m.nDrift, SORTIES_MINI_DECOUPLAGE) : 0;
    const noteEndurance = POIDS_ENDURANCE.fatigue * (endurance.fatigue ?? 0) * preuveFatigue
      + POIDS_ENDURANCE.longue * (endurance.longue ?? 0) * preuveLongue
      + POIDS_ENDURANCE.decouplage * (endurance.decouplage ?? 0) * preuveDecouplage;
    const preuveEndurance = POIDS_ENDURANCE.fatigue * preuveFatigue + POIDS_ENDURANCE.longue * preuveLongue + POIDS_ENDURANCE.decouplage * preuveDecouplage;

    const charge = m.ctlMax !== null && meilleurs.ctl > 0 ? noteChargeDe(m.ctlMax / meilleurs.ctl) : 0;

    const piliers: NotesPiliers = { puissance, endurance: noteEndurance, durabilite, repetabilite, charge };
    const preuves: PreuvesPiliers = { puissance: preuvePuissance, endurance: preuveEndurance, durabilite: preuveDurabilite, repetabilite: preuveRepetabilite, charge: m.ctlMax !== null ? 1 : 0 };
    const complets = PILIERS.filter((p) => preuves[p.cle] >= 1).length;
    resultat.push({ an, piliers, preuves, global: Math.round(moyenne(PILIERS.map((p) => piliers[p.cle]))!), nbPiliers: complets, endurance, detailRepetabilite });
  }
  const actuel = resultat[resultat.length - 1];
  const meilleur = resultat.reduce((m, a) => (a.global > m.global ? a : m));
  // Le point fort et le point faible se disent sur les piliers qui ont toutes leurs preuves (sinon un « faible » viendrait d'une donnée absente) ; à défaut, sur tous
  const complets = PILIERS.filter((p) => actuel.preuves[p.cle] >= 1).map((p) => p.cle);
  const trie = [...(complets.length ? complets : PILIERS.map((p) => p.cle))].sort((a, b) => actuel.piliers[b] - actuel.piliers[a]);
  return {
    annees: resultat,
    actuel,
    precedent: resultat.length > 1 ? resultat[resultat.length - 2] : null,
    meilleur,
    fort: trie[0],
    faible: trie[trie.length - 1],
  };
}

/** De combien chaque pilier a bougé depuis l'année d'avant (points de score). Vide sans année d'avant. */
export function ecartsPiliers(g: NiveauGlobal): { cle: PilierCle; avant: number; maintenant: number; ecart: number }[] {
  if (!g.precedent) return [];
  const avant = g.precedent;
  return PILIERS.flatMap((p) => {
    const a = avant.piliers[p.cle];
    const b = g.actuel.piliers[p.cle];
    return [{ cle: p.cle, avant: Math.round(a), maintenant: Math.round(b), ecart: Math.round(b) - Math.round(a) }];
  });
}

/** Les mesures de l'API en records par année (sprint, 5, 20 et 60 minutes) pour le sélecteur de records du vélo (sans les années à moins de 3 sorties avec capteur). */
export function recordsDeMesures(mesures: readonly MesuresAnnee[]): { an: number; w5?: number; w300?: number; w1200?: number; w3600?: number }[] {
  const num = (v: number | null): number | undefined => (v !== null && v > 0 ? v : undefined);
  return mesures.filter(puissanceFiable).map((m) => ({ an: m.an, w5: num(m.w5), w300: num(m.w300), w1200: num(m.w1200), w3600: num(m.w3600) }));
}
