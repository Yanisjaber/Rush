// ============================================================
// La répétabilité d'une sortie : à quel point on reproduit un effort dur dans la même sortie.
// On cherche les 3 meilleurs efforts de 5 minutes qui ne se chevauchent pas (au moins 5 minutes d'écart entre deux) et on garde leur puissance moyenne :
//   rep_1 ≥ rep_2 ≥ rep_3. Le rapport rep_3 / rep_1 dit si le 3e effort ressemble au 1er (proche de 1 : on reproduit ; plus bas : on s'épuise).
// Stocké dans `power_curve` (clés rep_1, rep_2, rep_3, en watts) avec les meilleures puissances par durée ; l'agrégation par année est faite par rpc_piliers_annuels.
// Fonctions pures, sans réseau ni Deno : le même code tourne dans l'Edge Function et dans les tests.
// ============================================================

/** Durée de chaque effort (secondes) et écart minimal entre deux efforts. */
export const DUREE_EFFORT_S = 300;
export const ECART_EFFORTS_S = 300;
export const NOMBRE_EFFORTS = 3;

/**
 * Les puissances moyennes des `nombre` meilleurs efforts de `duree` secondes, sans chevauchement ni moins de `ecart` secondes entre eux, du plus fort au plus faible.
 * `watts` : un point par seconde (voir reechantillonner1Hz). Moins d'efforts que demandé (sortie courte) : on rend ceux qu'on a.
 */
export function meilleursEfforts(watts: readonly number[], duree = DUREE_EFFORT_S, nombre = NOMBRE_EFFORTS, ecart = ECART_EFFORTS_S): number[] {
  const n = watts.length;
  if (n < duree) return [];
  const cum = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + (watts[i] != null && watts[i] > 0 ? watts[i] : 0);
  const moyennes: number[] = [];
  for (let i = 0; i + duree <= n; i++) moyennes.push((cum[i + duree] - cum[i]) / duree);
  const ordre = moyennes.map((_, i) => i).sort((a, b) => moyennes[b] - moyennes[a]);
  const choisis: number[] = [];
  for (const i of ordre) {
    if (choisis.every((j) => Math.abs(i - j) >= duree + ecart)) {
      choisis.push(i);
      if (choisis.length === nombre) break;
    }
  }
  return choisis.map((i) => moyennes[i]).sort((a, b) => b - a);
}

/** Les clés à ranger dans power_curve : rep_1, rep_2, rep_3 (watts arrondis) ; rien si la sortie n'a pas trois efforts. */
export function clesRepetabilite(watts: readonly number[]): Record<string, number> {
  const efforts = meilleursEfforts(watts);
  if (efforts.length < NOMBRE_EFFORTS || efforts[NOMBRE_EFFORTS - 1] <= 0) return {};
  return Object.fromEntries(efforts.map((w, i) => [`rep_${i + 1}`, Math.round(w)]));
}
