import { Pressable, StyleSheet, Text } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le « + Ajouter » du détail d'un jour : une pilule à contour de 44 pt qui ouvre le menu d'ajout. C'est la version JS, utilisée sur Android et sur les iPhone
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
      style={[styles.pilule, { borderColor: p.traitFort }]}
    >
      <Text style={[styles.plus, { color: p.texte }]}>+</Text>
      <Text style={[typo.corpsFort, { color: p.texte }]}>Ajouter</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pilule: { minHeight: 44, flexDirection: 'row', gap: 6, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: police.titre800, fontSize: 22, lineHeight: 26 },
});
