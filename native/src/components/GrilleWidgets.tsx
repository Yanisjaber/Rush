import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { ContexteTaille, ECART_LIGNES, HAUTEURS } from '@/components/taille';
import type { Taille } from '@/data/types';

// La grille de l'accueil : deux colonnes. Un widget S prend une demi-ligne, M et L une ligne entière.
// Les widgets se rangent dans l'ordre, à la suite, et passent à la ligne tout seuls : deux S voisins se retrouvent côte à côte,
// un S seul garde sa demi-ligne. C'est la même grille à l'accueil et en mode édition (ce qu'on règle est ce qu'on voit).
export const GOUTTIERE = 6; // demi-écart entre deux colonnes

/** Style de l'emplacement d'un widget dans la grille. */
export function styleEmplacement(taille: Taille, seul = false): ViewStyle {
  // Un S seul sur sa ligne est centré (25 % de marge de chaque côté)
  return { width: taille === 's' ? '50%' : '100%', paddingHorizontal: GOUTTIERE, paddingBottom: ECART_LIGNES, marginLeft: taille === 's' && seul ? '25%' : 0 };
}

export function GrilleWidgets({ children }: { children: ReactNode }) {
  return <View style={styles.grille}>{children}</View>;
}

/** La boîte d'un widget : sa taille en points est fixe (voir taille.ts), le contenu s'y adapte et ce qui dépasse est coupé. */
export function Boite({ taille, children }: { taille: Taille; children: ReactNode }) {
  return (
    <ContexteTaille.Provider value={taille}>
      <View style={{ height: HAUTEURS[taille], overflow: 'hidden' }}>{children}</View>
    </ContexteTaille.Provider>
  );
}

export function Emplacement({ taille, seul = false, children }: { taille: Taille; seul?: boolean; children: ReactNode }) {
  return <View style={styleEmplacement(taille, seul)}>{children}</View>;
}

export const styles = StyleSheet.create({
  // Les marges négatives annulent celles des emplacements aux bords : la grille reste alignée avec le reste de l'écran
  grille: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GOUTTIERE, marginBottom: -ECART_LIGNES },
});
