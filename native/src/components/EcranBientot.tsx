import { StyleSheet, Text, View } from 'react-native';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Écran provisoire des pages pas encore refaites en natif : le titre et une phrase.
export function EcranBientot({ titre, description }: { titre: string; description: string }) {
  const p = usePalette();
  return (
    <View style={[styles.page, { backgroundColor: p.fond, paddingTop: espace.e4 }]}>
      <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
        {titre}
      </Text>
      <Text style={[typo.corps, { color: p.texteDoux }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: espace.e4, gap: espace.e2 },
});
