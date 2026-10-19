// Géométrie du graphique de séries (une valeur par date : cumul d'une année, nuits de sommeil…).
// Port du calcul de components/charts/GrapheNuits.svelte, sorti en fonction pure pour être testable.
// Peut combiner : barres (simples ou empilées en %), lignes (sur la même échelle ou sur une échelle propre),
// une bande min-max et des repères horizontaux.

export interface SerieBarres {
  nom: string;
  valeurs: (number | null)[];
  couleur: string;
  /** Une couleur par barre (prend le dessus sur `couleur`). */
  couleurs?: string[];
}

export interface SerieLigne {
  nom: string;
  valeurs: (number | null)[];
  couleur: string;
  pointille?: boolean;
  /** Échelle propre à cette ligne (sinon l'échelle commune du graphique). */
  echelle?: { min: number; max: number };
}

export interface ParamsGraphe {
  etiquettes: string[]; // dates ISO
  barres?: SerieBarres[];
  empile?: boolean;
  lignes?: SerieLigne[];
  bande?: { min: number[]; max: number[] } | null;
  reperes?: { valeur: number; etiquette?: string }[];
  min?: number;
  max?: number;
  hauteur?: number;
}

export const LARGEUR_GRAPHE = 800;
const MARGE = 6;

export interface Graphe {
  n: number;
  hauteur: number;
  pas: number;
  rects: { i: number; x: number; w: number; y: number; h: number; couleur: string }[];
  chemins: { d: string; couleur: string; pointille: boolean }[];
  zoneBande: string;
  reperesY: number[];
  /** Positions (indices) des dates écrites sous le graphique : début, milieu, fin. */
  repereDates: number[];
  cx: (i: number) => number;
}

const valide = (v: number | null | undefined): v is number => v != null && !Number.isNaN(v);

export function construireGraphe(p: ParamsGraphe): Graphe {
  const { etiquettes, barres = [], empile = false, lignes = [], bande = null, reperes = [], min, max, hauteur = 150 } = p;
  const L = LARGEUR_GRAPHE;
  const n = etiquettes.length;

  const toutes = [
    ...barres.flatMap((b) => b.valeurs),
    ...lignes.filter((l) => !l.echelle).flatMap((l) => l.valeurs),
    ...(bande ? [...bande.min, ...bande.max] : []),
    ...reperes.map((r) => r.valeur),
  ].filter(valide);
  const echMin = min ?? (empile ? 0 : Math.min(0, ...(toutes.length ? toutes : [0])));
  const echMax = max ?? (empile ? 100 : Math.max(1, ...(toutes.length ? toutes : [1])) * 1.08);
  const y = (v: number, e: { min: number; max: number } = { min: echMin, max: echMax }) => hauteur - MARGE - ((v - e.min) / (e.max - e.min || 1)) * (hauteur - 2 * MARGE);
  const pas = n ? L / n : L;
  const cx = (i: number) => i * pas + pas / 2;

  // Barres : empilées en % du total de chaque nuit, ou simples
  const rects: Graphe['rects'] = [];
  for (let i = 0; i < n; i++) {
    const largeur = Math.max(2, pas * 0.7);
    if (empile) {
      const total = barres.reduce((s, b) => s + (b.valeurs[i] || 0), 0);
      let cumul = 0;
      for (const b of barres) {
        const part = total ? ((b.valeurs[i] || 0) / total) * 100 : 0;
        rects.push({ i, x: cx(i) - largeur / 2, w: largeur, y: y(cumul + part), h: Math.max(0, y(cumul) - y(cumul + part)), couleur: b.couleur });
        cumul += part;
      }
    } else {
      for (const b of barres) {
        const v = b.valeurs[i];
        if (!valide(v)) continue;
        rects.push({ i, x: cx(i) - largeur / 2, w: largeur, y: y(v), h: Math.max(1, y(echMin) - y(v)), couleur: b.couleurs?.[i] || b.couleur });
      }
    }
  }

  // Lignes : les trous (valeurs absentes) interrompent le tracé
  const chemins = lignes.map((l) => {
    const e = l.echelle || { min: echMin, max: echMax };
    let d = '';
    let ouvert = false;
    l.valeurs.forEach((v, i) => {
      if (!valide(v)) {
        ouvert = false;
        return;
      }
      d += `${ouvert ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v, e).toFixed(1)}`;
      ouvert = true;
    });
    return { d, couleur: l.couleur, pointille: !!l.pointille };
  });

  let zoneBande = '';
  if (bande) {
    const haut = bande.max.map((v, i): [number, number] => [cx(i), y(v)]).filter(([, yy]) => !Number.isNaN(yy));
    const bas = bande.min.map((v, i): [number, number] => [cx(i), y(v)]).filter(([, yy]) => !Number.isNaN(yy)).reverse();
    zoneBande = haut.length && bas.length ? `M${[...haut, ...bas].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L')}Z` : '';
  }

  const repereDates = n ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, k, a) => a.indexOf(v) === k) : [];
  return { n, hauteur, pas, rects, chemins, zoneBande, reperesY: reperes.map((r) => y(r.valeur)), repereDates, cx };
}

/** « jj/mm » à partir d'une date ISO. */
export const jj = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Le texte de lecture quand on pose le doigt sur une date : la date et les valeurs de chaque série. */
export function lectureGraphe(p: ParamsGraphe, survol: number | null, formater: (v: number, nom: string) => string = (v) => String(Math.round(v))): string {
  const n = p.etiquettes.length;
  if (survol == null || survol >= n) return '';
  const { barres = [], lignes = [] } = p;
  const valeurs = [...barres.map((b): [string, number | null] => [b.nom, b.valeurs[survol]]), ...lignes.map((l): [string, number | null] => [l.nom, l.valeurs[survol]])]
    .filter((e): e is [string, number] => valide(e[1]))
    .map(([nom, v]) => `${nom} ${formater(v, nom)}`)
    .join(' · ');
  return `${jj(p.etiquettes[survol])} : ${valeurs}`;
}

/** L'indice de la date touchée, à partir de la position du doigt (x) dans la largeur du graphique. */
export function indiceTouche(x: number, largeur: number, n: number): number | null {
  if (!largeur || !n) return null;
  return Math.max(0, Math.min(n - 1, Math.floor((x / largeur) * n)));
}
