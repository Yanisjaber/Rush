// Les largeurs des zones sur la barre (fonction pure, testée) : voir components/reglages/BarreZones.tsx.

/** La part de la barre pour chaque zone figée (première et dernière). */
export const LARGEUR_FIGEE = 0.15;

/** La part de largeur (0 à 1) de chaque zone. Exportée pour les tests. */
export function largeursZones(bornes: number[], axeMax: number, figees: boolean): number[] {
  const n = bornes.length;
  const plage = (i: number) => Math.max(0.5, (i < n - 1 ? bornes[i + 1] : Math.max(axeMax, bornes[i] + 1)) - bornes[i]);
  if (figees && n >= 3) {
    const milieu = [] as number[];
    for (let i = 1; i < n - 1; i++) milieu.push(plage(i));
    const somme = milieu.reduce((a, b) => a + b, 0);
    const reste = 1 - 2 * LARGEUR_FIGEE;
    return [LARGEUR_FIGEE, ...milieu.map((m) => (m / somme) * reste), LARGEUR_FIGEE];
  }
  const toutes = bornes.map((_, i) => plage(i));
  const total = toutes.reduce((a, b) => a + b, 0);
  return toutes.map((x) => x / total);
}

