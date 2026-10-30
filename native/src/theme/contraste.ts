// Contraste de deux couleurs (WCAG) : pour écrire un texte lisible sur un fond de couleur variable, par exemple une case plus ou moins bleue.
// Couleurs en hexadécimal #rrggbb. Fonctions pures : tests dans tests/theme/contraste.test.ts.

function canaux(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const lineaire = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** La luminance relative d'une couleur (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = canaux(hex);
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
}

/** Le rapport de contraste entre deux couleurs, de 1 (identiques) à 21 (noir sur blanc). Il faut 4,5 pour du texte courant. */
export function rapportContraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

/** La couleur obtenue en posant `devant` avec une transparence `alpha` (0 à 1) sur `derriere`. */
export function melanger(devant: string, alpha: number, derriere: string): string {
  const a = Math.min(1, Math.max(0, alpha));
  const [r1, g1, b1] = canaux(devant);
  const [r2, g2, b2] = canaux(derriere);
  const m = (x: number, y: number) => Math.round(x * a + y * (1 - a)).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/** Parmi les couleurs de texte proposées, celle qui contraste le plus avec le fond. */
export function meilleurTexte(fond: string, candidats: readonly string[]): string {
  return candidats.reduce((meilleure, c) => (rapportContraste(fond, c) > rapportContraste(fond, meilleure) ? c : meilleure));
}
