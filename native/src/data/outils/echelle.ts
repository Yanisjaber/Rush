// Échelle « ronde » d'un graphique en barres : le haut est un multiple de 3 rond, juste au-dessus du plus grand mois (ou de la plus grande semaine),
// pour que le tiers et les deux tiers tombent sur des nombres ronds (1 010 → 400, 800, 1 200 ; 2 542 → 1 000, 2 000, 3 000). Fonctions pures, sans réseau.

// Le pas entre deux repères : 1, 1,5, 2, 2,5, 3, 4, 5, 6 ou 8 fois une puissance de 10, du plus petit au plus grand (le haut vaut 3 pas). Seuls les entiers servent.
const MULTIPLES = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/** Le plus petit pas rond (entier) dont 3 pas couvrent `maximum` ; le haut vaut 3 pas. Rien (0 et 0) si `maximum` n'est pas positif. */
export function echelleRonde(maximum: number): { haut: number; pas: number } {
  if (!(maximum > 0)) return { haut: 0, pas: 0 };
  for (let puissance = 1; ; puissance *= 10) {
    for (const m of MULTIPLES) {
      const pas = m * puissance;
      if (Number.isInteger(pas) && 3 * pas >= maximum) return { haut: 3 * pas, pas };
    }
  }
}

/** Les valeurs des 3 repères, du plus bas au haut : un tiers, deux tiers et le haut (le 0 est la ligne de base). */
export function reperesRonds(maximum: number): number[] {
  const { pas } = echelleRonde(maximum);
  return pas > 0 ? [pas, 2 * pas, 3 * pas] : [];
}
