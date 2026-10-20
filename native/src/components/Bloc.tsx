import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { useRemplir } from '@/components/taille';
import { usePalette } from '@/theme/usePalette';

// Un bloc de contenu : une surface, un titre, du contenu. C'est la carte de base des widgets.
// Hiérarchie par la surface (pas d'ombre), rayon de 20 : plus doux que le web, pour l'app native.
// Avec `couleur` (par exemple la couleur d'un sport), c'est un aplat de couleur : les enfants écrivent en encre foncée.
interface Props {
  titre?: string;
  couleur?: string;
  children?: ReactNode;
}

export function Bloc({ titre, couleur, children }: Props) {
  const p = usePalette();
  const remplir = useRemplir();
  return (
    <View style={[styles.bloc, { backgroundColor: couleur ?? p.surface }, remplir]}>
      {titre ? (
        <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, styles.titre, { color: couleur ? p.encreSurCouleur : p.texte }]}>
          {titre}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.bloc, paddingHorizontal: 18, paddingVertical: 16 },
  titre: { marginBottom: 12 },
});
