// Placer la pastille du curseur (altitude et km) sur le profil d'altitude de façon à toucher le moins possible la courbe. Fonction pure, sans écran.
export type Point = [number, number];

export interface Placement {
  left: number;
  top: number;
  /** Où est la pastille par rapport au point : au-dessus, en dessous, ou sur un côté. Sert à choisir la flèche. */
  position: 'dessus' | 'dessous' | 'gauche' | 'droite';
}

const ECART = 14; // distance entre le point et la pastille
const MARGE_COURBE = 4; // marge autour de la pastille pour compter un point de courbe comme « dessous »

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
 * La meilleure place pour une pastille de `largeur` × `hauteur` autour du point `curseur`, dans un cadre de `cadre` : celle qui couvre le moins de courbe.
 * À égalité, on préfère au-dessus et centrée, puis en dessous, puis décalée, puis sur le côté. La pastille reste toujours dans le cadre.
 */
export function placerPastille(courbe: Point[], curseur: Point, taille: { largeur: number; hauteur: number }, cadre: { largeur: number; hauteur: number }): Placement {
  const [x, y] = curseur;
  const { largeur: w, hauteur: h } = taille;
  const dans = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max, 0));
  const brut: Placement[] = [
    { left: x - w / 2, top: y - h - ECART, position: 'dessus' },
    { left: x - w / 2, top: y + ECART, position: 'dessous' },
    { left: x - w + 24, top: y - h - ECART, position: 'dessus' },
    { left: x - 24, top: y - h - ECART, position: 'dessus' },
    { left: x - w + 24, top: y + ECART, position: 'dessous' },
    { left: x - 24, top: y + ECART, position: 'dessous' },
    { left: x - w - ECART, top: y - h / 2, position: 'gauche' },
    { left: x + ECART, top: y - h / 2, position: 'droite' },
  ];
  const candidats = brut.map((c) => ({ ...c, left: dans(c.left, cadre.largeur - w), top: dans(c.top, cadre.hauteur - h) }));
  let meilleur = candidats[0];
  let moins = Infinity;
  for (const c of candidats) {
    // Une pastille qui recouvre le point lui-même (cadre trop étroit) ne vaut rien : on l'écarte
    const surLePoint = x >= c.left && x <= c.left + w && y >= c.top && y <= c.top + h;
    const score = chevauchement(courbe, { left: c.left, top: c.top, largeur: w, hauteur: h }) + (surLePoint ? 1000 : 0);
    if (score < moins) {
      moins = score;
      meilleur = c;
    }
  }
  return meilleur;
}
