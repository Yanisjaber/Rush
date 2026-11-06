import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { usePalette } from '@/theme/usePalette';

// Le rond de profil : la photo du compte si elle existe, sinon une silhouette. Contour de 2 px qui détache la photo du fond.
// Décoratif : le bouton ou l'écran qui le contient porte le libellé d'accessibilité.
export function RondProfil({ url, taille = 38 }: { url: string | null; taille?: number }) {
  const p = usePalette();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.rond, { width: taille, height: taille, borderRadius: taille / 2, backgroundColor: p.surface2, borderColor: p.traitFort }]}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: taille, height: taille }} resizeMode="cover" />
      ) : (
        <Svg width={taille} height={taille} viewBox="0 0 36 36">
          <Circle cx={18} cy={14} r={6} fill={p.texteDoux} />
          <Path d="M5 36c0-8 6-13 13-13s13 5 13 13z" fill={p.texteDoux} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rond: { borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
