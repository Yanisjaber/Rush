// Le niveau global de l'athlète à vélo : cinq piliers, chacun noté de 0 à 100, et leur moyenne. Calculs purs, testés dans tests/bilan/piliers-niveau.test.ts.
//   puissance    : la force de pointe, moyenne des notes de ton meilleur sprint (5 s), 5, 20 et 60 minutes de l'année (100 = ton meilleur de chaque durée) ;
//   endurance    : tenir longtemps, moyenne de trois notes (au moins deux mesurées) :
//                    - puissance longue : meilleurs 2 h et 3 h de l'année contre tes meilleurs de toujours (même échelle que la puissance) ;
//                    - dérive cardiaque : médiane de l'année (sorties de 2 h et plus) ; 0 % = 100, 15 % ou plus = 0 ;
//                    - volume long : heures en sorties de 2 h et plus, contre ta meilleure année (en proportion : la moitié = 50) ;
//                  (les watts à cardio égal, l'ancien pilier « Endurance », sont devenus la Forme : voir niveau-annees.ts et forme-saison.ts) ;
//   durabilité   : garder sa puissance fatigué : meilleur 5 et 20 min après 2 h 30 de sortie, divisé par le meilleur à froid (100 = aucune perte, 0 = 30 % de perte) ;
//   répétabilité : reproduire les efforts : dans une sortie, le 3e effort de 5 min divisé par le 1er (même échelle) ;
//   charge       : encaisser et enchaîner l'entraînement : la charge chronique (CTL) maximale de l'année (100 = ta meilleure année).
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

/** Les trois notes qui font l'endurance d'une année (null quand elle n'est pas mesurable). */
export interface DetailEndurance {
  puissanceLongue: number | null;
  derive: number | null;
  volume: number | null;
}

export type NotesPiliers = Record<PilierCle, number | null>;

export interface NiveauGlobalAnnee {
  an: number;
  piliers: NotesPiliers;
  /** La moyenne des piliers mesurés, arrondie ; null s'il y en a moins de 3. */
  global: number | null;
  /** Combien de piliers sur 5 ont pu être mesurés cette année-là. */
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

/** Il faut au moins 3 sorties longues pour juger la durabilité d'une année, 3 sorties à trois vrais efforts pour la répétabilité,
 *  et 3 sorties avec capteur pour la puissance (une seule sortie, souvent un capteur en panne, donnait une note de 0). */
export const SORTIES_MINI_PUISSANCE = 3;
export const SORTIES_MINI_DURABILITE = 3;
export const SORTIES_MINI_REPETABILITE = 3;
/** Une année a un score global à partir de 2 piliers mesurés (l'écran dit alors « Calculé sur N piliers sur 5 »). */
export const PILIERS_MINI = 2;
/** La dérive cardiaque d'une année se juge sur au moins 3 sorties de 2 h et plus ; à 15 % de dérive (ou plus), la note est 0. */
export const SORTIES_MINI_DERIVE = 3;
export const DERIVE_ZERO = 15;
/** L'endurance d'une année demande au moins 2 de ses 3 notes. */
export const NOTES_MINI_ENDURANCE = 2;

const moyenne = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
/** Les puissances d'une année comptent seulement si elle a assez de sorties avec capteur. */
const puissanceFiable = (m: MesuresAnnee): boolean => m.nCourbes >= SORTIES_MINI_PUISSANCE;
const meilleurDe = (valeurs: (number | null)[]): number => Math.max(0, ...valeurs.filter((v): v is number => v !== null));

/** Les notes de chaque pilier pour chaque année, et le score global (moyenne des piliers mesurés). Null s'il n'y a aucune année avec 2 piliers. */
export function niveauGlobal(mesures: readonly MesuresAnnee[]): NiveauGlobal | null {
  const fiables = mesures.filter(puissanceFiable);
  const meilleurs = {
    w5: meilleurDe(fiables.map((m) => m.w5)),
    w300: meilleurDe(fiables.map((m) => m.w300)),
    w1200: meilleurDe(fiables.map((m) => m.w1200)),
    w3600: meilleurDe(fiables.map((m) => m.w3600)),
    w7200: meilleurDe(fiables.map((m) => m.w7200)),
    w10800: meilleurDe(fiables.map((m) => m.w10800)),
    ctl: meilleurDe(mesures.map((m) => m.ctlMax)),
    heures: meilleurDe(mesures.map((m) => m.heuresLongues)),
  };
  const parAn = new Map<number, MesuresAnnee>(mesures.map((m) => [m.an, m]));
  const annees = [...parAn.keys()].sort((a, b) => a - b);

  const resultat: NiveauGlobalAnnee[] = [];
  for (const an of annees) {
    const m = parAn.get(an);
    const durees = m && puissanceFiable(m) ? ([['w5', m.w5], ['w300', m.w300], ['w1200', m.w1200], ['w3600', m.w3600]] as const) : [];
    const notesPuissance = durees.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => noteDe((v as number) / meilleurs[cle]));
    const ratiosDurabilite = m && m.nLongues >= SORTIES_MINI_DURABILITE
      ? [m.late300 && m.w300 ? m.late300 / m.w300 : null, m.late1200 && m.w1200 ? m.late1200 / m.w1200 : null].filter((r): r is number => r !== null)
      : [];
    const longues = m && puissanceFiable(m) ? ([['w7200', m.w7200], ['w10800', m.w10800]] as const) : [];
    const notesLongues = longues.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => noteDe((v as number) / meilleurs[cle]));
    const endurance: DetailEndurance = {
      puissanceLongue: moyenne(notesLongues),
      derive: m && m.nDerive >= SORTIES_MINI_DERIVE && m.deriveMed !== null ? Math.max(0, Math.min(100, (1 - m.deriveMed / DERIVE_ZERO) * 100)) : null,
      volume: m && meilleurs.heures > 0 ? (100 * m.heuresLongues) / meilleurs.heures : null,
    };
    const notesEndurance = [endurance.puissanceLongue, endurance.derive, endurance.volume].filter((v): v is number => v !== null);
    const piliers: NotesPiliers = {
      puissance: moyenne(notesPuissance),
      endurance: notesEndurance.length >= NOTES_MINI_ENDURANCE ? moyenne(notesEndurance) : null,
      durabilite: ratiosDurabilite.length ? noteDe(Math.min(1, moyenne(ratiosDurabilite)!)) : null,
      repetabilite: m && m.repN >= SORTIES_MINI_REPETABILITE && m.repRatio !== null ? noteDe(Math.min(1, m.repRatio)) : null,
      charge: m && m.ctlMax !== null && meilleurs.ctl > 0 ? noteDe(m.ctlMax / meilleurs.ctl) : null,
    };
    const mesurees = PILIERS.map((p) => piliers[p.cle]).filter((v): v is number => v !== null);
    resultat.push({ an, piliers, global: mesurees.length >= PILIERS_MINI ? Math.round(moyenne(mesurees)!) : null, nbPiliers: mesurees.length, endurance });
  }
  const avecScore = resultat.filter((a) => a.global !== null);
  if (!avecScore.length) return null;
  const actuel = avecScore[avecScore.length - 1];
  const meilleur = avecScore.reduce((m, a) => (a.global! > m.global! ? a : m));
  const mesuresActuelles = PILIERS.filter((p) => actuel.piliers[p.cle] !== null).map((p) => p.cle);
  const trie = [...mesuresActuelles].sort((a, b) => actuel.piliers[b]! - actuel.piliers[a]!);
  return {
    annees: avecScore,
    actuel,
    precedent: avecScore.length > 1 ? avecScore[avecScore.length - 2] : null,
    meilleur,
    fort: trie[0],
    faible: trie[trie.length - 1],
  };
}

/** De combien chaque pilier a bougé depuis l'année d'avant (points de score), pour les piliers mesurés les deux années. Vide sans année d'avant. */
export function ecartsPiliers(g: NiveauGlobal): { cle: PilierCle; avant: number; maintenant: number; ecart: number }[] {
  if (!g.precedent) return [];
  const avant = g.precedent;
  return PILIERS.flatMap((p) => {
    const a = avant.piliers[p.cle];
    const b = g.actuel.piliers[p.cle];
    return a !== null && b !== null ? [{ cle: p.cle, avant: Math.round(a), maintenant: Math.round(b), ecart: Math.round(b) - Math.round(a) }] : [];
  });
}

/** Les mesures de l'API en records par année (sprint, 5, 20 et 60 minutes) pour le sélecteur de records du vélo (sans les années à moins de 3 sorties avec capteur). */
export function recordsDeMesures(mesures: readonly MesuresAnnee[]): { an: number; w5?: number; w300?: number; w1200?: number; w3600?: number }[] {
  const num = (v: number | null): number | undefined => (v !== null && v > 0 ? v : undefined);
  return mesures.filter(puissanceFiable).map((m) => ({ an: m.an, w5: num(m.w5), w300: num(m.w300), w1200: num(m.w1200), w3600: num(m.w3600) }));
}
