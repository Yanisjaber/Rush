// Recadrage rond de la photo de profil : calculs purs (sans écran, sans réseau).
//
// Le principe : la photo est posée au centre de la zone, à une échelle de base où son PETIT côté remplit tout juste le cercle
// (diamètre `d`). L'utilisateur la zoome (`zoom` ≥ 1) et la déplace (`tx`, `ty`, en pixels d'écran depuis le centre).
// Le cercle ne doit jamais montrer de vide : le déplacement est limité en conséquence.

export const ZOOM_MAX = 5;
/** Taille de la photo enregistrée (carré), assez pour le rond de 72 px en 3x et un affichage plus grand plus tard. */
export const COTE_AVATAR = 512;

export interface Cadre {
  /** Largeur et hauteur de la photo d'origine, en pixels. */
  w: number;
  h: number;
  /** Diamètre du cercle à l'écran. */
  d: number;
  zoom: number;
  tx: number;
  ty: number;
}

/** Échelle de base (pixels d'écran par pixel de photo) : le petit côté de la photo remplit le cercle. */
export function echelleBase(w: number, h: number, d: number): number {
  const petit = Math.min(w, h);
  return petit > 0 && d > 0 ? d / petit : 1;
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Le zoom, ramené entre 1 (photo qui remplit le cercle) et ZOOM_MAX. */
export const bornerZoom = (zoom: number): number => borner(Number.isFinite(zoom) ? zoom : 1, 1, ZOOM_MAX);

/** Déplacement maximal (en pixels d'écran) de chaque côté du centre, pour que le cercle reste plein. */
export function deplacementMax(c: Pick<Cadre, 'w' | 'h' | 'd' | 'zoom'>): { x: number; y: number } {
  const s = echelleBase(c.w, c.h, c.d) * bornerZoom(c.zoom);
  return { x: Math.max(0, (c.w * s - c.d) / 2), y: Math.max(0, (c.h * s - c.d) / 2) };
}

/** Le cadre avec zoom et déplacement ramenés dans les limites. */
export function bornerCadre(c: Cadre): Cadre {
  const zoom = bornerZoom(c.zoom);
  const m = deplacementMax({ ...c, zoom });
  return { ...c, zoom, tx: borner(c.tx, -m.x, m.x), ty: borner(c.ty, -m.y, m.y) };
}

export interface Rectangle {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Le carré de la photo d'origine (en pixels) qui se trouve dans le cercle : c'est lui qu'on découpe. */
export function rectangleDecoupe(brut: Cadre): Rectangle {
  const c = bornerCadre(brut);
  const s = echelleBase(c.w, c.h, c.d) * c.zoom;
  const cote = Math.min(c.d / s, c.w, c.h);
  // Centre du cercle dans la photo : le centre de la photo, décalé à l'inverse du déplacement
  const cx = c.w / 2 - c.tx / s;
  const cy = c.h / 2 - c.ty / s;
  const originX = borner(cx - cote / 2, 0, c.w - cote);
  const originY = borner(cy - cote / 2, 0, c.h - cote);
  const entier = Math.max(1, Math.floor(cote));
  return { originX: Math.round(originX), originY: Math.round(originY), width: Math.min(entier, Math.floor(c.w)), height: Math.min(entier, Math.floor(c.h)) };
}
