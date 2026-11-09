// Règles de la sélection de sports (le menu du haut). Pures : le choix lui-même vit dans stores/menu.ts.
// Le filtre qui en découle (« tout », « course », « course+velo ») est calculé par data/sports/filtre.ts.

/** Coche ou décoche un sport dans la sélection (l'ordre de la sélection n'a pas d'importance : le filtre suit l'ordre de la barre). */
export function basculerSport(selection: readonly string[], famille: string): string[] {
  return selection.includes(famille) ? selection.filter((f) => f !== famille) : [...selection, famille];
}
