import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un bouton « Retour » pour les écrans sans en-tête natif (les Paramètres ouverts par la roue dentée).
// S'il n'y a nulle part où revenir (ouverture directe par un lien), il ramène à l'Accueil.
export function BoutonRetour() {
  const p = usePalette();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      hitSlop={{ top: 0, bottom: 0, left: 8, right: 16 }}
      style={({ pressed }) => [styles.bouton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[typo.petit, { color: p.texte }]}>Retour</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, alignSelf: 'flex-start', marginLeft: -4 },
});
