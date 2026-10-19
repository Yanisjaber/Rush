import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un bloc de contenu : une surface, un titre, du contenu. C'est la carte de base des widgets.
// Hiérarchie par la surface (pas d'ombre), rayon de 6 : comme sur le web.
interface Props {
  titre?: string;
  children?: ReactNode;
}

export function Bloc({ titre, children }: Props) {
  const p = usePalette();
  return (
    <View style={[styles.bloc, { backgroundColor: p.surface }]}>
      {titre ? (
        <Text accessibilityRole="header" style={[typo.titre3, styles.titre, { color: p.texte }]}>
          {titre}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.base, paddingHorizontal: 18, paddingVertical: 16 },
  titre: { marginBottom: 12 },
});
