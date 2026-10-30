// Le niveau global de l'athlète à vélo : cinq piliers, chacun noté de 0 à 100, et leur moyenne. Calculs purs, testés dans tests/bilan/piliers-niveau.test.ts.
//   puissance    : la force de pointe, moyenne des notes de ton meilleur sprint (5 s), 5, 20 et 60 minutes de l'année (100 = ton meilleur de chaque durée) ;
//   endurance    : le niveau à cardio égal de l'année (voir niveau-annees.ts) ;
//   durabilité   : garder sa puissance fatigué : meilleur 5 et 20 min après 2 h 30 de sortie, divisé par le meilleur à froid (100 = aucune perte, 0 = 30 % de perte) ;
//   répétabilité : reproduire les efforts : dans une sortie, le 3e effort de 5 min divisé par le 1er (même échelle) ;
//   charge       : encaisser et enchaîner l'entraînement : la charge chronique (CTL) maximale de l'année (100 = ta meilleure année).
// La récupération physiologique (HRV, FC au repos) n'est pas dans le score : elle demande des mois de mesures. La capacité de charge est ce qu'on peut dire de l'entraînement encaissé.
import { noteDe, type SerieNiveau } from './niveau-annees.ts';

export type PilierCle = 'puissance' | 'endurance' | 'durabilite' | 'repetabilite' | 'charge';
export const PILIERS: readonly { cle: PilierCle; nom: string; court: string; explication: string }[] = [
  { cle: 'puissance', nom: 'Puissance', court: 'Puissance', explication: 'Sprint, 5, 20 et 60 min' },
  { cle: 'endurance', nom: 'Endurance', court: 'Endurance', explication: 'Watts à cardio égal' },
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
}

export type NotesPiliers = Record<PilierCle, number | null>;

export interface NiveauGlobalAnnee {
  an: number;
  piliers: NotesPiliers;
  /** La moyenne des piliers mesurés, arrondie ; null s'il y en a moins de 3. */
  global: number | null;
  /** Combien de piliers sur 5 ont pu être mesurés cette année-là. */
  nbPiliers: number;
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

/** Il faut au moins 3 sorties longues pour juger la durabilité d'une année, 3 sorties à trois vrais efforts pour la répétabilité. */
export const SORTIES_MINI_DURABILITE = 3;
export const SORTIES_MINI_REPETABILITE = 3;
/** Une année a un score global à partir de 2 piliers mesurés (l'écran dit alors « Calculé sur N piliers sur 5 »). */
export const PILIERS_MINI = 2;

const moyenne = (v: number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const meilleurDe = (valeurs: (number | null)[]): number => Math.max(0, ...valeurs.filter((v): v is number => v !== null));

/** Les notes de chaque pilier pour chaque année, et le score global (moyenne des piliers mesurés). Null s'il n'y a aucune année avec 2 piliers. */
export function niveauGlobal(mesures: readonly MesuresAnnee[], endurance: SerieNiveau | null): NiveauGlobal | null {
  const meilleurs = {
    w5: meilleurDe(mesures.map((m) => m.w5)),
    w300: meilleurDe(mesures.map((m) => m.w300)),
    w1200: meilleurDe(mesures.map((m) => m.w1200)),
    w3600: meilleurDe(mesures.map((m) => m.w3600)),
    ctl: meilleurDe(mesures.map((m) => m.ctlMax)),
  };
  const parAn = new Map<number, MesuresAnnee>(mesures.map((m) => [m.an, m]));
  const noteEndurance = new Map<number, number>((endurance?.annuel ?? []).map((p) => [p.an, p.score]));
  const annees = [...new Set([...parAn.keys(), ...noteEndurance.keys()])].sort((a, b) => a - b);

  const resultat: NiveauGlobalAnnee[] = [];
  for (const an of annees) {
    const m = parAn.get(an);
    const durees = m ? ([['w5', m.w5], ['w300', m.w300], ['w1200', m.w1200], ['w3600', m.w3600]] as const) : [];
    const notesPuissance = durees.filter(([cle, v]) => v !== null && v > 0 && meilleurs[cle] > 0).map(([cle, v]) => noteDe((v as number) / meilleurs[cle]));
    const ratiosDurabilite = m && m.nLongues >= SORTIES_MINI_DURABILITE
      ? [m.late300 && m.w300 ? m.late300 / m.w300 : null, m.late1200 && m.w1200 ? m.late1200 / m.w1200 : null].filter((r): r is number => r !== null)
      : [];
    const piliers: NotesPiliers = {
      puissance: moyenne(notesPuissance),
      endurance: noteEndurance.get(an) ?? null,
      durabilite: ratiosDurabilite.length ? noteDe(Math.min(1, moyenne(ratiosDurabilite)!)) : null,
      repetabilite: m && m.repN >= SORTIES_MINI_REPETABILITE && m.repRatio !== null ? noteDe(Math.min(1, m.repRatio)) : null,
      charge: m && m.ctlMax !== null && meilleurs.ctl > 0 ? noteDe(m.ctlMax / meilleurs.ctl) : null,
    };
    const mesurees = PILIERS.map((p) => piliers[p.cle]).filter((v): v is number => v !== null);
    resultat.push({ an, piliers, global: mesurees.length >= PILIERS_MINI ? Math.round(moyenne(mesurees)!) : null, nbPiliers: mesurees.length });
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

/** Les mesures de l'API en records par année (sprint, 5, 20 et 60 minutes) pour le sélecteur de records du vélo. */
export function recordsDeMesures(mesures: readonly MesuresAnnee[]): { an: number; w5?: number; w300?: number; w1200?: number; w3600?: number }[] {
  const num = (v: number | null): number | undefined => (v !== null && v > 0 ? v : undefined);
  return mesures.map((m) => ({ an: m.an, w5: num(m.w5), w300: num(m.w300), w1200: num(m.w1200), w3600: num(m.w3600) }));
}
