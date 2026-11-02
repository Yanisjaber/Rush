// Le niveau global de l'athlète à vélo : cinq piliers, chacun noté de 0 à 100, et leur moyenne. Calculs purs, testés dans tests/bilan/piliers-niveau.test.ts.
//   puissance    : la force de pointe, moyenne des notes de ton meilleur sprint (5 s), 5, 20 et 60 minutes de l'année (100 = ton meilleur de chaque durée) ;
//   endurance    : tenir longtemps, moyenne de trois notes (deux demandées ; une seule = la moitié de la note) :
//                    - puissance longue : meilleurs 2 h et 3 h de l'année contre tes meilleurs de toujours (même échelle que la puissance) ;
//                    - dérive cardiaque : médiane de l'année (sorties de 2 h et plus) ; 0 % = 100, 15 % ou plus = 0 ;
//                    - volume long : heures en sorties de 2 h et plus, contre ta meilleure année (en proportion : la moitié = 50) ;
//                  (les watts à cardio égal, l'ancien pilier « Endurance », sont devenus la Forme : voir niveau-annees.ts et forme-saison.ts) ;
//   durabilité   : garder sa puissance fatigué : meilleur 5 et 20 min après 2 h 30 de sortie, divisé par le meilleur à froid (100 = aucune perte, 0 = 30 % de perte) ;
//   répétabilité : reproduire les efforts : dans une sortie, le 3e effort de 5 min divisé par le 1er (même échelle). Un « vrai effort » vaut au moins 50 % de ton meilleur 5 min
//                  de TOUS LES TEMPS (calculé côté base) : répéter des efforts faciles ne donne pas de note ;
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
  { cle: 'endurance', nom: 'Endurance', court: 'Endurance', explication: 'Puissance 2-3 h, dérive cardiaque, sorties longues' },
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
  repN: number;
  ctlMax: number | null;
  /** Combien de sorties de l'année ont une courbe de puissance (un capteur). */
  nCourbes: number;
  /** Meilleures puissances sur 2 h et 3 h de l'année. */
  w7200: number | null;
  w10800: number | null;
  /** Médiane de la dérive cardiaque des sorties de 2 h et plus (en %), et le nombre de sorties mesurées. */
  deriveMed: number | null;
  nDerive: number;
  /** Heures passées dans des sorties de 2 h et plus. */
  heuresLongues: number;
}

/** Les trois notes qui font l'endurance d'une année (null quand elle n'est pas mesurable ; le volume existe toujours). */
export interface DetailEndurance {
  puissanceLongue: number | null;
  derive: number | null;
  volume: number;
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
/** La dérive cardiaque d'une année se juge sur 3 sorties de 2 h et plus ; à 15 % de dérive (ou plus), la note est 0. */
export const SORTIES_MINI_DERIVE = 3;
export const DERIVE_ZERO = 15;
/** L'endurance d'une année demande 2 de ses 3 notes (le volume est toujours là : les 2 autres viennent des capteurs). */
export const NOTES_MINI_ENDURANCE = 2;

const moyenne = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
/** Les puissances d'une année sont fiables seulement avec assez de sorties avec capteur. */
const puissanceFiable = (m: MesuresAnnee): boolean => m.nCourbes >= SORTIES_MINI_PUISSANCE;
const meilleurDe = (valeurs: (number | null)[]): number => Math.max(0, ...valeurs.filter((v): v is number => v !== null));
/** La charge est notée de 0 (40 % de ta meilleure année ou moins) à 100 (ta meilleure année) : plus douce que `noteDe` (0 à 70 %), voir l'en-tête. */
export const CHARGE_ZERO = 0.4;
export const noteChargeDe = (rapport: number): number => Math.max(0, Math.min(100, ((rapport - CHARGE_ZERO) / (1 - CHARGE_ZERO)) * 100));

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
    w7200: meilleurDe(reference.map((m) => m.w7200)),
    w10800: meilleurDe(reference.map((m) => m.w10800)),
    ctl: meilleurDe(mesures.map((m) => m.ctlMax)),
    heures: meilleurDe(mesures.map((m) => m.heuresLongues)),
  };
  const parAn = new Map<number, MesuresAnnee>(mesures.map((m) => [m.an, m]));
  const annees = [...parAn.keys()].sort((a, b) => a - b);

  const resultat: NiveauGlobalAnnee[] = [];
  for (const an of annees) {
    const m = parAn.get(an)!;
    const preuvePuissance = preuveDe(m.nCourbes, SORTIES_MINI_PUISSANCE);

    const durees = [['w5', m.w5], ['w300', m.w300], ['w1200', m.w1200], ['w3600', m.w3600]] as const;
    const notesPuissance = durees.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => noteDe((v as number) / meilleurs[cle]));
    const puissance = (moyenne(notesPuissance) ?? 0) * preuvePuissance;

    const ratiosDurabilite = [m.late300 && m.w300 ? m.late300 / m.w300 : null, m.late1200 && m.w1200 ? m.late1200 / m.w1200 : null].filter((r): r is number => r !== null);
    const preuveDurabilite = preuveDe(m.nLongues, SORTIES_MINI_DURABILITE);
    const durabilite = ratiosDurabilite.length ? noteDe(Math.min(1, moyenne(ratiosDurabilite)!)) * preuveDurabilite : 0;

    const preuveRepetabilite = preuveDe(m.repN, SORTIES_MINI_REPETABILITE);
    const repetabilite = m.repRatio !== null ? noteDe(Math.min(1, m.repRatio)) * preuveRepetabilite : 0;

    const longues = [['w7200', m.w7200], ['w10800', m.w10800]] as const;
    const notesLongues = longues.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => noteDe((v as number) / meilleurs[cle]));
    const endurance: DetailEndurance = {
      puissanceLongue: notesLongues.length ? moyenne(notesLongues)! * preuvePuissance : null,
      derive: m.deriveMed !== null && m.nDerive > 0 ? Math.max(0, Math.min(100, (1 - m.deriveMed / DERIVE_ZERO) * 100)) * preuveDe(m.nDerive, SORTIES_MINI_DERIVE) : null,
      volume: meilleurs.heures > 0 ? (100 * m.heuresLongues) / meilleurs.heures : 0,
    };
    const notesEndurance = [endurance.puissanceLongue, endurance.derive, endurance.volume].filter((v): v is number => v !== null);
    const preuveEndurance = preuveDe(notesEndurance.length, NOTES_MINI_ENDURANCE);

    const charge = m.ctlMax !== null && meilleurs.ctl > 0 ? noteChargeDe(m.ctlMax / meilleurs.ctl) : 0;

    const piliers: NotesPiliers = { puissance, endurance: (moyenne(notesEndurance) ?? 0) * preuveEndurance, durabilite, repetabilite, charge };
    const preuves: PreuvesPiliers = { puissance: preuvePuissance, endurance: preuveEndurance, durabilite: preuveDurabilite, repetabilite: preuveRepetabilite, charge: m.ctlMax !== null ? 1 : 0 };
    const complets = PILIERS.filter((p) => preuves[p.cle] >= 1).length;
    resultat.push({ an, piliers, preuves, global: Math.round(moyenne(PILIERS.map((p) => piliers[p.cle]))!), nbPiliers: complets, endurance });
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
