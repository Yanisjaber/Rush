import { Pressable, StyleSheet, Text } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un choix à toucher (malade, blessé, phase du cycle…) : une pastille qui se remplit quand elle est choisie. Retoucher l'efface.
interface Props {
  nom: string;
  actif: boolean;
  onPress: () => void;
  /** Phrase d'aide lue par VoiceOver. */
  aide?: string;
  /** Couleur de remplissage quand elle est choisie (par défaut la couleur de la muscu). */
  couleur?: string;
}

export function Pastille({ nom, actif, onPress, aide, couleur }: Props) {
  const p = usePalette();
  const c = couleur ?? p.sportMuscu;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={nom}
      accessibilityHint={aide}
      style={[styles.pastille, { backgroundColor: actif ? c : 'transparent', borderColor: actif ? c : p.contourChamp }]}
    >
      <Text style={[typo.corpsFort, { color: actif ? p.fond : p.texte }]}>{nom}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pastille: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
