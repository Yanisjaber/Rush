// Le filtre de sport de la barre du haut. Un texte, partout dans l'app :
//   « tout »            aucune restriction
//   « course »          un seul sport
//   « course+velo »     plusieurs sports (leurs familles, séparées par « + », dans l'ordre de la barre)
// Fonctions pures : le choix lui-même vit dans stores/menu.ts.

const SEPARATEUR = '+';

/** Les sports d'un filtre : `null` pour « tout » (pas de restriction), sinon la liste des familles. */
export function famillesDuFiltre(filtre: string | null | undefined): string[] | null {
  if (!filtre || filtre === 'tout') return null;
  return filtre.split(SEPARATEUR).filter(Boolean);
}

/** Le filtre garde-t-il cette famille de sport ? « tout » garde tout. */
export function filtreGarde(filtre: string | null | undefined, famille: string): boolean {
  const liste = famillesDuFiltre(filtre);
  return liste === null || liste.includes(famille);
}

/** Le filtre porte-t-il sur plusieurs sports à la fois ? */
export const estMultiple = (filtre: string | null | undefined): boolean => (famillesDuFiltre(filtre)?.length ?? 0) > 1;

/**
 * Le filtre qui correspond à une sélection de sports cochés. Rien de coché, ou tout coché : « tout ».
 * L'ordre est celui de la barre (`ordre`), pour qu'une même sélection donne toujours le même texte.
 */
export function filtreDeSelection(selection: readonly string[], ordre: readonly string[]): string {
  const choisis = ordre.filter((f) => selection.includes(f));
  if (choisis.length === 0 || choisis.length === ordre.length) return 'tout';
  return choisis.join(SEPARATEUR);
}

/** La sélection cochée d'un filtre, restreinte aux sports encore dans la barre. « tout » = liste vide (rien de particulier coché). */
export function selectionDuFiltre(filtre: string | null | undefined, ordre: readonly string[]): string[] {
  return (famillesDuFiltre(filtre) ?? []).filter((f) => ordre.includes(f));
}
