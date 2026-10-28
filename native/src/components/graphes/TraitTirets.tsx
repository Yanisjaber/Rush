import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

// Un trait horizontal en tirets. On ne peut pas le faire avec une bordure en pointillés d'un seul côté (borderTopWidth + borderStyle: 'dashed') :
// React Native ne dessine les pointillés que sur un cadre complet, et affiche l'avertissement « Unsupported dashed / dotted border style ».
interface Props {
  couleur: string;
  /** Épaisseur du trait, en points. */
  epaisseur?: number;
  /** Largeur du trait (par défaut toute la largeur disponible). */
  largeur?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}

export function TraitTirets({ couleur, epaisseur = 1, largeur = '100%', style }: Props) {
  // Même rythme que les bordures en tirets natives : un tiret et un blanc font chacun trois fois l'épaisseur
  const tiret = 3 * epaisseur;
  return (
    <Svg width={largeur} height={epaisseur} style={style} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={0} y1={epaisseur / 2} x2="100%" y2={epaisseur / 2} stroke={couleur} strokeWidth={epaisseur} strokeDasharray={`${tiret} ${tiret}`} />
    </Svg>
  );
}
