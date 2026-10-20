// Jetons de design Rush, recopiés de app/src/lib/design/tokens.css.
// Règle centrale : la couleur désigne le sport, pas le profil.

export type Theme = 'sombre' | 'clair';

export interface Palette {
  fond: string;
  surface: string;
  surface2: string;
  trait: string;
  traitFort: string;
  /** Contour d'un champ de saisie ou d'un bouton : au moins 3:1 sur le fond et la surface (les traits décoratifs sont plus pâles). */
  contourChamp: string;
  texte: string;
  texteDoux: string;
  texteMuet: string;
  encreSurCouleur: string;
  dossardFond: string;
  dossardTexte: string;
  sportCourse: string;
  sportVelo: string;
  sportNatation: string;
  sportMuscu: string;
  sportHybride: string;
  sportHybrideTexte: string;
  sportNeutre: string;
  ok: string;
  alerte: string;
  danger: string;
}

export const sombre: Palette = {
  fond: '#0c0d10',
  surface: '#14161b',
  surface2: '#1b1e25',
  trait: '#272b35',
  traitFort: '#3a3f4c',
  contourChamp: '#6b7280',
  texte: '#f3f2ee',
  texteDoux: '#a2a7b3',
  texteMuet: '#868c9a',
  encreSurCouleur: '#0c0d10',
  dossardFond: '#f3f2ee',
  dossardTexte: '#0c0d10',
  sportCourse: '#ff7a33',
  sportVelo: '#4f8cff',
  sportNatation: '#22d3ee',
  sportMuscu: '#ff5a4f',
  sportHybride: '#ffd60a',
  sportHybrideTexte: '#ffd60a',
  sportNeutre: '#a2a7b3',
  ok: '#4ade80',
  alerte: '#ff7a33',
  danger: '#ff5a4f',
};

export const clair: Palette = {
  fond: '#f5f4f0',
  surface: '#ffffff',
  surface2: '#edece6',
  trait: '#e2e0d9',
  traitFort: '#c9c6bc',
  contourChamp: '#7a7f8a',
  texte: '#14151a',
  texteDoux: '#5b606c',
  texteMuet: '#656a76',
  encreSurCouleur: '#000000',
  dossardFond: '#14151a',
  dossardTexte: '#f3f2ee',
  sportCourse: '#e85d0c',
  sportVelo: '#2f6fe8',
  sportNatation: '#0788a0',
  sportMuscu: '#e63b30',
  sportHybride: '#c99a00',
  sportHybrideTexte: '#7d5e00',
  sportNeutre: '#5b606c',
  ok: '#127336',
  alerte: '#a8420a',
  danger: '#b91c1c',
};

// Espacements (échelle de 4 px), rayons et cible tactile minimale.
export const espace = { e1: 4, e2: 8, e3: 12, e4: 16, e5: 24, e6: 32, e7: 48 } as const;
// bloc : les blocs de widgets et les tuiles, plus doux que le reste (le dossard garde son rayon de 6, c'est sa signature)
export const rayon = { s: 5, base: 6, l: 8, bloc: 20, rond: 999 } as const;
export const cibleTactile = 44;

/** Une couleur hexadécimale (#rrggbb) avec de la transparence : avecAlpha('#ff7a33', 0.12). */
export function avecAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}

/**
 * Mélange deux couleurs hexadécimales (#rrggbb) comme le ferait `color-mix(in srgb, a pctA%, b)` en CSS :
 * melange(a, b, 30) = 30 % de a et 70 % de b.
 */
export function melange(a: string, b: string, pctA: number): string {
  const t = Math.min(100, Math.max(0, pctA)) / 100;
  const canaux = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [canaux(a), canaux(b)];
  return `#${ca.map((v, i) => Math.round(v * t + cb[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
}
