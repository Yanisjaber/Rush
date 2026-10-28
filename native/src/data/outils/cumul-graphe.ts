// Géométrie du graphique « Cumul sur 3 ans » : fonctions pures (pas d'écran), donc testables.
// Entrée : les séries de cumulParAnnee (366 jours d'une année bissextile, null après aujourd'hui pour l'année en cours).
// Sortie : tout ce qu'il faut dessiner dans un repère de LARGEUR × HAUTEUR : graduations, mois, courbes, repère « aujourd'hui », points.

import { echelleRonde } from './echelle.ts';

export const LARGEUR_CUMUL = 330;
export const HAUTEUR_CUMUL = 200;
/** Marge de droite : le graphique prend toute la largeur, les étiquettes se posent par-dessus. */
export const MARGE_DROITE_CUMUL = 8;
const MARGE = { gauche: 6, droite: MARGE_DROITE_CUMUL, haut: 12, bas: 18 };
/** Écart minimal entre deux étiquettes, pour qu'elles ne se chevauchent pas quand les courbes se touchent. */
const ECART_ETIQUETTES = 15;
/** Place sous la ligne de base pour les lettres des mois. */
export const MARGE_BAS_CUMUL = MARGE.bas;
// Un mois sur deux, en toutes lettres courtes : tout tient sans se serrer
const NOMS_MOIS = ['Janv.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

export interface SerieCumul {
  annee: number;
  valeurs: (number | null)[];
}

export interface GrapheCumul {
  graduations: { valeur: number; y: number }[];
  mois: { nom: string; x: number }[];
  /** Une courbe par série, dans l'ordre reçu. */
  courbes: { annee: number; d: string }[];
  /** Position du dernier jour connu de la première série (aujourd'hui pour l'année en cours, fin décembre sinon). */
  repereX: number;
  /** Position du jour affiché (le jour pointé, ou le dernier jour connu) et ce jour-là (-1 sans donnée). */
  curseurX: number;
  jour: number;
  /** Une valeur par série à ce jour-là (les séries sans valeur ce jour-là sont omises). */
  points: { annee: number; x: number; y: number; valeur: number }[];
  /** Une étiquette par point : même ordre que `points`, écartées entre elles (`y` est la hauteur de l'étiquette, pas du point). Elles se posent à droite de la ligne, ou (`ancrage: 'fin'`) à gauche et au-dessus du point le plus haut s'il n'y a pas la place. */
  etiquettes: { annee: number; x: number; y: number; valeur: number; ancrage: 'debut' | 'fin' }[];
  /** Haut de l'échelle (un multiple de 3 rond, voir echelleRonde). */
  maximum: number;
}

const dernierIndexConnu = (s: SerieCumul): number => {
  for (let j = s.valeurs.length - 1; j >= 0; j--) if (s.valeurs[j] != null) return j;
  return -1;
};

/** Jour (0 = 1er janvier, année bissextile) → « 12 mars ». */
export function libelleJour(jour: number): string {
  const d = new Date(Date.UTC(2024, 0, 1 + jour));
  const nom = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.getUTCMonth()];
  return `${d.getUTCDate()} ${nom}`;
}

const nbJours = (series: SerieCumul[]) => Math.max(2, ...series.map((s) => s.valeurs.length));

/** Le jour pointé par le doigt : `positionX` en points dans un graphique large de `largeurPx`, entre le 1er janvier et le dernier jour du graphique (on peut dépasser aujourd'hui). */
export function jourDeX(positionX: number, largeurPx: number, series: SerieCumul[]): number {
  if (!(largeurPx > 0) || !series[0]) return 0;
  const vx = (positionX / largeurPx) * LARGEUR_CUMUL;
  const j = Math.round(((vx - MARGE.gauche) / (LARGEUR_CUMUL - MARGE.gauche - MARGE.droite)) * (nbJours(series) - 1));
  return Math.min(nbJours(series) - 1, Math.max(0, j));
}

/**
 * `jour` : le jour pointé, de 0 à la fin de l'année (par défaut le dernier jour connu de la première série : aujourd'hui, ou fin d'année).
 * Après aujourd'hui, l'année en cours n'a plus de valeur : seules les autres années ont un point.
 * `largeurEtiquette` : la place que prend la plus large étiquette (dans le repère du dessin), pour savoir de quel côté de la ligne les poser.
 */
export function grapheCumul(series: SerieCumul[], jour: number | null = null, largeurEtiquette = 0): GrapheCumul {
  const n = nbJours(series);
  const largeurUtile = LARGEUR_CUMUL - MARGE.gauche - MARGE.droite;
  const hauteurUtile = HAUTEUR_CUMUL - MARGE.haut - MARGE.bas;
  const plusGrand = Math.max(0, ...series.flatMap((s) => s.valeurs.filter((v): v is number => v != null)));
  const { haut, pas } = echelleRonde(plusGrand);
  const maximum = Math.max(1, haut); // le haut : un multiple de 3 rond juste au-dessus du plus grand cumul, comme les barres du Rythme
  const x = (j: number) => MARGE.gauche + (largeurUtile * j) / (n - 1);
  const y = (v: number) => HAUTEUR_CUMUL - MARGE.bas - (hauteurUtile * v) / maximum;
  const nombre = (v: number) => v.toFixed(1);

  const chemin = (s: SerieCumul): string => {
    const fin = dernierIndexConnu(s);
    if (fin < 0) return '';
    let d = '';
    for (let j = 0; j < fin; j += 2) d += `${d ? 'L' : 'M'}${nombre(x(j))} ${nombre(y(s.valeurs[j] ?? 0))}`;
    return `${d}${d ? 'L' : 'M'}${nombre(x(fin))} ${nombre(y(s.valeurs[fin] ?? 0))}`;
  };

  const premiere = series[0];
  const dernier = premiere ? dernierIndexConnu(premiere) : -1;
  const marque = jour == null || dernier < 0 ? dernier : Math.min(n - 1, Math.max(0, jour));
  const courbes = series.map((s) => ({ annee: s.annee, d: chemin(s) }));

  // Les jours sont ceux d'une année bissextile (comme cumulParAnnee) : le centre de chaque mois
  const mois = NOMS_MOIS.map((nom, m) => {
    const debut = Math.round((Date.UTC(2024, m, 1) - Date.UTC(2024, 0, 1)) / 86400000);
    const jours = Math.round((Date.UTC(2024, m + 1, 1) - Date.UTC(2024, m, 1)) / 86400000);
    return { nom, x: x(debut + jours / 2) };
  }).filter((_, m) => m % 2 === 0);

  const points = marque < 0 ? [] : series.flatMap((s) => (s.valeurs[marque] != null ? [{ annee: s.annee, x: x(marque), y: y(s.valeurs[marque] as number), valeur: s.valeurs[marque] as number }] : []));
  // Quatre graduations : le 0, le tiers, les deux tiers et le haut, tous ronds (le pas est un entier) ; sans données, le 0 et le haut ; chacune est posée à la hauteur de sa valeur
  const graduations = (pas > 0 ? [0, pas, 2 * pas, 3 * pas] : [0, maximum]).map((valeur) => ({ valeur, y: y(valeur) }));

  // À droite de la ligne si la place suffit : chaque étiquette à la hauteur de son point, écartées si les courbes se touchent.
  // Sinon à gauche : empilées AU-DESSUS du point le plus haut (là où il n'y a pas de courbe) s'il y a la place, la plus haute en premier ;
  // à défaut, à la hauteur de leur point, écartées elles aussi.
  const xLigne = marque >= 0 ? x(marque) : x(0);
  const aDroite = xLigne + 8 + largeurEtiquette <= LARGEUR_CUMUL - 2;
  const ordre = points.map((_, i) => i).sort((a, b) => points[a].y - points[b].y);
  const yEtiquette: number[] = [];
  const ecarter = () => {
    let precedent = -Infinity;
    for (const i of ordre) {
      precedent = Math.max(points[i].y, precedent + ECART_ETIQUETTES);
      yEtiquette[i] = precedent;
    }
    // Quand les valeurs sont à zéro (début d'année), tout est tassé sur la ligne de base : on remonte le groupe pour qu'il reste au-dessus des noms des mois
    const limiteBasse = HAUTEUR_CUMUL - MARGE.bas - 4;
    const depassement = precedent - limiteBasse;
    if (depassement > 0) for (const i of ordre) yEtiquette[i] = Math.max(MARGE.haut, yEtiquette[i] - depassement);
  };
  const hautPile = ordre.length ? points[ordre[0]].y - 10 - (ordre.length - 1) * ECART_ETIQUETTES : 0;
  if (aDroite || !ordre.length || hautPile < MARGE.haut) ecarter();
  else ordre.forEach((i, rang) => (yEtiquette[i] = hautPile + rang * ECART_ETIQUETTES));
  const etiquettes = points.map((pt, i) => ({ annee: pt.annee, x: aDroite ? xLigne + 8 : xLigne - 8, y: yEtiquette[i], valeur: pt.valeur, ancrage: (aDroite ? 'debut' : 'fin') as 'debut' | 'fin' }));

  return { graduations, mois, courbes, repereX: dernier >= 0 ? x(dernier) : x(0), curseurX: marque >= 0 ? x(marque) : x(0), jour: marque, points, etiquettes, maximum };
}
