import { Pressable, StyleSheet, Text } from 'react-native';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le « + » du détail d'un jour : un rond plein de 44 pt qui ouvre le menu d'ajout. C'est la version JS, utilisée sur Android et sur les iPhone
// sans verre liquide (voir BoutonPlus.ios.tsx pour le bouton de verre d'Apple).
export interface PropsBoutonPlus {
  onPress: () => void;
  /** Le menu d'ajout est-il ouvert ? (pour les lecteurs d'écran) */
  ouvert: boolean;
}

export function BoutonPlus({ onPress, ouvert }: PropsBoutonPlus) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ajouter : séance, activité, import de fichier, compétition, note, cycle ou repos"
      accessibilityState={{ expanded: ouvert }}
      style={[styles.rond, { backgroundColor: p.texte }]}
    >
      <Text style={[styles.plus, { color: p.fond }]}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rond: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: police.titre800, fontSize: 26, lineHeight: 30 },
});
