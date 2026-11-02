// Le niveau global de l'athlète à vélo : quatre piliers, chacun noté de 0 à 100, et leur moyenne. Calculs purs, testés dans tests/bilan/piliers-niveau.test.ts.
//   puissance    : la force de pointe, moyenne des notes de ton meilleur sprint (5 s), 5, 20 et 60 minutes de l'année (100 = ton meilleur de chaque durée, 0 = 20 % en dessous ; les autres piliers gardent 30 %) ;
//   endurance    : tenir longtemps, à PUISSANCE FIXE (formule de Yanis, 3 nov. 2026) : en 2026, tenir 175 W pendant 3 h est beaucoup plus facile qu'en 2019. La puissance de référence
//                  est la même pour toutes les années : 70 % de ta FTP de TOUS LES TEMPS (95 % de ton meilleur 20 min de toujours). Note = 100 × (0,35 F + 0,30 H + 0,35 C) :
//                    - F facilité : puissance de référence ÷ FTP de l'année (la FTP de l'année = 95 % de son meilleur 20 min) ; 100 à 70 % de la FTP (ou moins), 0 à 90 % (ou plus) ;
//                    - H coût cardio : FC moyenne médiane des sorties de plus de 2 h à la puissance de référence (±10 %, les 10 plus récentes de l'année) contre ton meilleur (le plus bas) de toujours ;
//                      100 au meilleur, 0 à 15 battements de plus ;
//                    - C fraîcheur à 2 h 30 : découplage cardiaque médian de ces mêmes sorties (EF = puissance normalisée / FC, 1re contre 2e moitié) ; 12 % = 0, 2 % = 100 ;
//                  chaque lettre est multipliée par sa preuve (3 sorties demandées) ; une lettre sans mesure vaut 0 ;
//                  (les watts à cardio égal, l'ancien pilier « Endurance », sont devenus la Forme : voir niveau-annees.ts et forme-saison.ts) ;
//   répétabilité : reproduire les efforts, moyenne de deux notes (2 nov. 2026), jugées sur les 10 MEILLEURES sorties de l'année (celles où le 3e effort est le plus fort : sur une sortie
//                  facile, les « 3 meilleurs efforts » ne sont que trois morceaux un peu plus appuyés, et la médiane de toutes les sorties les tirait vers le bas, 3 nov. 2026) :
//                    - régularité : dans une sortie, le 3e effort de 5 min divisé par le 1er (médiane des 10 ; 100 = aucune perte, 0 = 30 % de perte) ;
//                    - hauteur : le 3e effort (médiane des 10) divisé par ton meilleur 5 min de TOUS LES TEMPS (0 à 50 %, 100 à 100 %) : répéter des efforts
//                      plus forts compte plus que répéter des efforts faciles. Un « vrai effort » vaut au moins 50 % de ce record (calculé côté base) ;
//   charge       : encaisser et enchaîner l'entraînement : la charge chronique (CTL) maximale de l'année (100 = ta meilleure année, 0 à 40 % de ta meilleure année :
//                  une échelle plus douce que les autres piliers, car la charge est une quantité d'entraînement, pas un niveau de performance : passer de 52 à 91 est presque doubler).
// Une note existe toujours (2 nov. 2026) : quand il manque des sorties pour la juger, la note est calculée avec ce qu'il y a puis RÉDUITE de la part qui manque
// (2 sorties sur les 3 demandées = 2/3 de la note ; aucune = 0). Chaque note a sa « preuve » (de 0 à 1) : 1 = toutes les sorties demandées sont là. L'écran marque
// les notes à preuve incomplète. Le score global est la moyenne des 4 notes, preuve incomplète comprise.
// La durabilité (puissance gardée après 2 h 30 ou après 30 kJ/kg) a été retirée en nov. 2026 : en sorties libres, elle dépend trop de ce que tu as osé faire en fin de sortie, donc une note basse ne prouvait rien.
// La récupération physiologique (HRV, FC au repos) n'est pas dans le score : elle demande des mois de mesures. La capacité de charge est ce qu'on peut dire de l'entraînement encaissé.
import { noteDe } from './niveau-annees.ts';

export type PilierCle = 'puissance' | 'endurance' | 'repetabilite' | 'charge';
export const PILIERS: readonly { cle: PilierCle; nom: string; court: string; explication: string }[] = [
  { cle: 'puissance', nom: 'Puissance', court: 'Puissance', explication: 'Sprint, 5, 20 et 60 min' },
  { cle: 'endurance', nom: 'Endurance', court: 'Endurance', explication: 'Effort et cœur à puissance fixe, fraîcheur à 2 h 30' },
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
  repRatio: number | null;
  /** Médiane (en watts) du 3e effort de 5 min des sorties valides : la hauteur des efforts répétés. */
  repW3: number | null;
  repN: number;
  ctlMax: number | null;
  /** Combien de sorties de l'année ont une courbe de puissance (un capteur). */
  nCourbes: number;
  /** Meilleure puissance sur 2 h 30 de l'année. */
  /** La puissance de référence (W) : 70 % de la FTP de tous les temps, la même pour toutes les années. Null sans courbe de puissance. */
  pRef: number | null;
  /** FC moyenne médiane (bpm) des 10 plus récentes sorties de plus de 2 h à la puissance de référence (±10 %), et le nombre de sorties. */
  fcRef: number | null;
  nFc: number;
  /** Médiane du découplage cardiaque (en %) des mêmes sorties à la puissance de référence, et le nombre de sorties qui ont compté. */
  driftMed: number | null;
  nDrift: number;
}

/** Les trois notes (0 à 100, avant leur poids et leur preuve) qui font l'endurance d'une année ; null quand la mesure manque. */
export interface DetailEndurance {
  /** F : la puissance de référence ÷ la FTP de l'année (à puissance égale, plus c'est facile, plus la note est haute). */
  facilite: number | null;
  /** H : la FC moyenne à la puissance de référence, contre ton meilleur de toujours. */
  cardio: number | null;
  /** C : le découplage cardiaque à la puissance de référence (fraîcheur à 2 h 30). */
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
  /** La moyenne des 4 piliers, arrondie. */
  global: number;
  /** Combien de piliers sur 4 ont toutes leurs preuves cette année-là. */
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

/** Les sorties demandées pour une note complète : 3 sorties à trois vrais efforts pour la répétabilité,
 *  3 sorties avec capteur pour la puissance (une seule sortie, souvent un capteur en panne, ne fixe jamais ton « meilleur »). Avec moins, la note est réduite. */
export const SORTIES_MINI_PUISSANCE = 3;
export const SORTIES_MINI_REPETABILITE = 3;
/** L'endurance (formule de Yanis, 3 nov. 2026, sans la fatigue depuis le retrait de la durabilité) : 35 % la facilité (F), 30 % le coût cardio (H), 35 % la fraîcheur à 2 h 30 (C). Chaque note va de 0 à 100 ; sa preuve
 *  demande 3 sorties (3 sorties à la puissance de référence avec FC, 3 avec découplage, 3 avec capteur pour F) : avec moins, la note est réduite d'autant. */
export const SORTIES_MINI_DECOUPLAGE = 3;
export const SORTIES_MINI_CARDIO = 3;
export const POIDS_ENDURANCE = { facilite: 0.35, cardio: 0.3, decouplage: 0.35 } as const;
/** F : la puissance de référence vaut 70 % de la FTP de l'année (ou moins) = 100, 90 % (ou plus) = 0. */
export const FACILITE_CENT = 0.7;
export const FACILITE_ZERO = 0.9;
/** H : 15 battements de plus que ton meilleur (le plus bas) = 0. */
export const CARDIO_ECART_BPM = 15;
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
  // Ton meilleur (le plus bas) cœur à la puissance de référence : sur les années à au moins 3 sorties de référence avec FC, sinon sur celles qui en ont au moins une
  const cardios = mesures.filter((m) => m.fcRef !== null && m.fcRef > 0);
  const cardiosFiables = cardios.filter((m) => m.nFc >= SORTIES_MINI_CARDIO);
  const meilleurFc = Math.min(...(cardiosFiables.length ? cardiosFiables : cardios).map((m) => m.fcRef as number), Infinity);
  const parAn = new Map<number, MesuresAnnee>(mesures.map((m) => [m.an, m]));
  const annees = [...parAn.keys()].sort((a, b) => a - b);

  const resultat: NiveauGlobalAnnee[] = [];
  for (const an of annees) {
    const m = parAn.get(an)!;
    const preuvePuissance = preuveDe(m.nCourbes, SORTIES_MINI_PUISSANCE);

    const durees = [['w5', m.w5], ['w300', m.w300], ['w1200', m.w1200], ['w3600', m.w3600]] as const;
    const notesPuissance = durees.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => notePuissanceDe((v as number) / meilleurs[cle]));
    const puissance = (moyenne(notesPuissance) ?? 0) * preuvePuissance;

    const preuveRepetabilite = preuveDe(m.repN, SORTIES_MINI_REPETABILITE);
    const detailRepetabilite: DetailRepetabilite = {
      regularite: m.repRatio !== null ? noteDe(Math.min(1, m.repRatio)) : null,
      hauteur: m.repW3 !== null && meilleurs.w300 > 0 ? noteHauteurDe(m.repW3 / meilleurs.w300) : null,
    };
    // Sans la hauteur (une ancienne version de la base ne la rend pas), la régularité fait seule la note
    const repetabilite = (moyenne([detailRepetabilite.regularite, detailRepetabilite.hauteur].filter((v): v is number => v !== null)) ?? 0) * preuveRepetabilite;

    // Endurance à PUISSANCE FIXE (voir l'en-tête) : la même puissance de référence pour toutes les années, jugée en effort relatif (F), en cœur (H) et en fraîcheur à 2 h 30 (C).
    const ftpAnnee = m.w1200 !== null && m.w1200 > 0 ? 0.95 * m.w1200 : null;
    const endurance: DetailEndurance = {
      facilite: m.pRef !== null && m.pRef > 0 && ftpAnnee !== null ? noteLineaire(m.pRef / ftpAnnee, FACILITE_ZERO, FACILITE_CENT) : null,
      cardio: m.fcRef !== null && m.fcRef > 0 && m.nFc > 0 && Number.isFinite(meilleurFc) ? noteLineaire(m.fcRef, meilleurFc + CARDIO_ECART_BPM, meilleurFc) : null,
      decouplage: m.driftMed !== null && m.nDrift > 0 ? noteLineaire(m.driftMed, DECOUPLAGE_ZERO, DECOUPLAGE_CENT) : null,
    };
    // Chaque note compte pour son poids, multipliée par sa preuve ; une note qui manque vaut 0 et sa part de preuve aussi
    const preuveFacilite = endurance.facilite !== null ? preuvePuissance : 0; // la FTP de l'année demande 3 sorties avec capteur
    const preuveCardio = endurance.cardio !== null ? preuveDe(m.nFc, SORTIES_MINI_CARDIO) : 0;
    const preuveDecouplage = endurance.decouplage !== null ? preuveDe(m.nDrift, SORTIES_MINI_DECOUPLAGE) : 0;
    const noteEndurance = POIDS_ENDURANCE.facilite * (endurance.facilite ?? 0) * preuveFacilite
      + POIDS_ENDURANCE.cardio * (endurance.cardio ?? 0) * preuveCardio
      + POIDS_ENDURANCE.decouplage * (endurance.decouplage ?? 0) * preuveDecouplage;
    // Arrondie au milliardième : 0,35 + 0,30 + 0,35 donne 0,9999999999999999 en flottant, et une preuve « complète » doit valoir exactement 1
    const preuveEndurance = Math.round((POIDS_ENDURANCE.facilite * preuveFacilite + POIDS_ENDURANCE.cardio * preuveCardio
      + POIDS_ENDURANCE.decouplage * preuveDecouplage) * 1e9) / 1e9;

    const charge = m.ctlMax !== null && meilleurs.ctl > 0 ? noteChargeDe(m.ctlMax / meilleurs.ctl) : 0;

    const piliers: NotesPiliers = { puissance, endurance: noteEndurance, repetabilite, charge };
    const preuves: PreuvesPiliers = { puissance: preuvePuissance, endurance: preuveEndurance, repetabilite: preuveRepetabilite, charge: m.ctlMax !== null ? 1 : 0 };
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
