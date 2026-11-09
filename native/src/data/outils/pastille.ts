// Placer la pastille du curseur (altitude et km) sur le profil d'altitude de façon à toucher peu la courbe, en restant dans le graphique. Fonction pure, sans écran.
export type Point = [number, number];

export interface Placement {
  left: number;
  top: number;
  /** Au-dessus ou en dessous du point : sert à choisir la flèche (▼ ou ▲). */
  position: 'dessus' | 'dessous';
}

const ECART = 28; // distance entre le point et la pastille (le trait pointillé la relie au point)
const MARGE_COURBE = 4; // marge autour de la pastille pour compter un point de courbe comme « dessous »
const TOLERANCE = 4; // points de courbe qu'on accepte sous la pastille avant de la déplacer : évite qu'elle saute d'une place à l'autre pour presque rien

/** Des points de la courbe, resserrés (4 de plus entre deux points voisins), pour que le comptage ne rate pas un tronçon qui traverse la pastille sans y poser un sommet. */
function echantillon(courbe: Point[]): Point[] {
  const s: Point[] = [];
  for (let i = 0; i < courbe.length; i++) {
    s.push(courbe[i]);
    const suivant = courbe[i + 1];
    if (!suivant) continue;
    for (let k = 1; k <= 4; k++) s.push([courbe[i][0] + ((suivant[0] - courbe[i][0]) * k) / 5, courbe[i][1] + ((suivant[1] - courbe[i][1]) * k) / 5]);
  }
  return s;
}

/** Combien de points de la courbe tombent dans le rectangle (agrandi de la marge). */
export function chevauchement(courbe: Point[], r: { left: number; top: number; largeur: number; hauteur: number }): number {
  let n = 0;
  for (const [x, y] of echantillon(courbe)) {
    if (x >= r.left - MARGE_COURBE && x <= r.left + r.largeur + MARGE_COURBE && y >= r.top - MARGE_COURBE && y <= r.top + r.hauteur + MARGE_COURBE) n++;
  }
  return n;
}

/**
 * La place d'une pastille de `largeur` × `hauteur` près du point `curseur`, toujours au-dessus ou en dessous, et dans le graphique (`cadre.gauche` à `cadre.largeur` en
 * largeur, 0 à `cadre.hauteur` en hauteur : la colonne des altitudes, à gauche, reste libre). On essaie, dans l'ordre : au-dessus centrée, en dessous centrée, puis
 * décalée vers la gauche ou la droite, au-dessus puis en dessous. On garde la première place qui ne recouvre pas la courbe de plus de TOLERANCE points de plus
 * que la meilleure : elle ne saute donc pas pour un détail.
 */
export function placerPastille(
  courbe: Point[],
  curseur: Point,
  taille: { largeur: number; hauteur: number },
  cadre: { gauche?: number; largeur: number; hauteur: number },
): Placement {
  const [x, y] = curseur;
  const { largeur: w, hauteur: h } = taille;
  const gauche = cadre.gauche ?? 0;
  const bornes = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(max, min));
  const brut: Placement[] = [
    { left: x - w / 2, top: y - h - ECART, position: 'dessus' },
    { left: x - w / 2, top: y + ECART, position: 'dessous' },
    { left: x - w + 24, top: y - h - ECART, position: 'dessus' },
    { left: x - 24, top: y - h - ECART, position: 'dessus' },
    { left: x - w + 24, top: y + ECART, position: 'dessous' },
    { left: x - 24, top: y + ECART, position: 'dessous' },
  ];
  const candidats = brut.map((c) => ({
    ...c,
    left: bornes(c.left, gauche, cadre.largeur - w),
    top: bornes(c.top, 0, cadre.hauteur - h),
  }));
  const scores = candidats.map((c) => {
    // Une pastille qui recouvre le point lui-même (cadre trop étroit) ne vaut rien : on l'écarte
    const surLePoint = x >= c.left && x <= c.left + w && y >= c.top && y <= c.top + h;
    return chevauchement(courbe, { left: c.left, top: c.top, largeur: w, hauteur: h }) + (surLePoint ? 1000 : 0);
  });
  const moins = Math.min(...scores);
  const i = scores.findIndex((s) => s <= moins + TOLERANCE);
  return candidats[i];
}
