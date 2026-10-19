// Jetons de design Rush, recopiés de app/src/lib/design/tokens.css.
// Règle centrale : la couleur désigne le sport, pas le profil.

export type Theme = 'sombre' | 'clair';

export interface Palette {
  fond: string;
  surface: string;
  surface2: string;
  trait: string;
  traitFort: string;
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
export const rayon = { s: 5, base: 6, l: 8, rond: 999 } as const;
export const cibleTactile = 44;
