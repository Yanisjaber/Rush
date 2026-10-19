import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tuile compacte : un titre, un chiffre clé, une note et (en dessous) une mini visualisation.
// Deux tuiles tiennent côte à côte sur un iPhone. Port de components/Tuile.svelte.
interface Props {
  titre: string;
  valeur: string;
  unite?: string;
  note?: string;
  children?: ReactNode;
}

export function Tuile({ titre, valeur, unite, note, children }: Props) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={[titre, valeur, unite, note].filter(Boolean).join(' ')} style={[styles.tuile, { backgroundColor: p.surface }]}>
      <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
        {titre}
      </Text>
      <Text numberOfLines={1} style={[styles.valeur, { color: p.texte }]}>
        {valeur}
        {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
      {note ? <Text style={[typo.petit, { color: p.texteDoux }]}>{note}</Text> : null}
      {children ? <View style={styles.visuel}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tuile: { flex: 1, minHeight: 118, borderRadius: rayon.base, paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden' },
  valeur: { fontFamily: police.titre700, fontSize: 28, lineHeight: 32, marginTop: 6 },
  visuel: { marginTop: 'auto', paddingTop: 8 },
});
