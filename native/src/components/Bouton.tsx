import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un bouton. Toujours au moins 44 pt de haut (cible tactile).
// variante : 'principal' (aplat clair), 'discret' (contour), 'sur-dossard' et 'sur-dossard-contour' (à poser sur le dossard).
interface Props {
  variante?: 'principal' | 'discret' | 'sur-dossard' | 'sur-dossard-contour';
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  /** Plus bas (32 pt) pour les petits widgets ; la zone tactile reste de 44 pt grâce à hitSlop. */
  petit?: boolean;
}

export function Bouton({ variante = 'principal', onPress, children, accessibilityLabel, petit }: Props) {
  const p = usePalette();
  const styles = {
    principal: { fond: p.texte, texte: p.fond, contour: undefined },
    discret: { fond: 'transparent', texte: p.texte, contour: p.traitFort },
    // À poser sur le dossard : inverse des couleurs du dossard, donc toujours lisible
    'sur-dossard': { fond: p.dossardTexte, texte: p.dossardFond, contour: undefined },
    // Bouton secondaire sur le dossard : un contour aux couleurs du dossard (le « discret » serait invisible sur fond clair)
    'sur-dossard-contour': { fond: 'transparent', texte: p.dossardTexte, contour: p.dossardTexte },
  }[variante];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={petit ? { top: 6, bottom: 6 } : undefined}
      style={({ pressed }) => [
        base.bouton,
        petit && base.petit,
        { backgroundColor: styles.fond, opacity: pressed ? 0.7 : 1 },
        styles.contour ? { borderColor: styles.contour, borderWidth: variante === 'sur-dossard-contour' ? 2 : 1 } : null,
      ]}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[base.texte, { color: styles.texte }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const base = StyleSheet.create({
  bouton: { minHeight: 44, paddingHorizontal: 12, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  petit: { minHeight: 32, paddingHorizontal: 10 },
  texte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
});
