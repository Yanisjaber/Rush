// Échelle « ronde » d'un graphique en barres : un pas rond (1, 2, 2,5 ou 5 fois une puissance de 10, toujours un entier) et un haut qui en est un multiple,
// avec au plus 4 repères (2 000 → 500, 1 000, 1 500, 2 000). Fonctions pures, sans réseau.

const MULTIPLES = [1, 2, 2.5, 5];

/** Le plus petit pas rond (entier) qui couvre `maximum` en 4 repères au plus ; le haut est le plus petit multiple du pas qui couvre `maximum`. Rien (0 et 0) si `maximum` n'est pas positif. */
export function echelleRonde(maximum: number): { haut: number; pas: number } {
  if (!(maximum > 0)) return { haut: 0, pas: 0 };
  for (let puissance = 1; ; puissance *= 10) {
    for (const m of MULTIPLES) {
      const pas = m * puissance;
      if (!Number.isInteger(pas)) continue;
      if (Math.ceil(maximum / pas) <= 4) return { haut: Math.ceil(maximum / pas) * pas, pas };
    }
  }
}

/** Les valeurs des repères, du plus bas au haut : les multiples du pas (sans le 0). */
export function reperesRonds(maximum: number): number[] {
  const { haut, pas } = echelleRonde(maximum);
  return pas > 0 ? Array.from({ length: Math.round(haut / pas) }, (_, i) => (i + 1) * pas) : [];
}
