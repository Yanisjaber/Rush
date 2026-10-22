// La grande palette qui s'ouvre au bout d'une ligne de couleurs : douze teintes en trois tons (clair, moyen, foncé), puis quatre gris. Fonctions pures.

/** Une couleur en teinte (0-360), saturation et luminosité (0-100) → « #rrggbb ». */
export function hslVersHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

const TEINTES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const TONS = [68, 55, 42]; // luminosité : clair, moyen, foncé
const GRIS = ['#c9ccd3', '#8d93a0', '#5b616d', '#33373f'];

/** Les 40 couleurs de la palette : trois tons de chaque teinte (36), puis quatre gris. */
export function paletteComplete(): string[] {
  return [...TONS.flatMap((l) => TEINTES.map((h) => hslVersHex(h, 62, l))), ...GRIS];
}
