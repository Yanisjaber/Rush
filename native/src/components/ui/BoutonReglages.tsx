import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { usePalette } from '@/theme/usePalette';

// La roue dentée qui ouvre les Paramètres (plein écran, avec un bouton retour). Elle est en haut à droite de la barre des sports
// et dans l'en-tête de Santé. Toujours visible, même pour un compte sans sport : c'est par là qu'on se déconnecte et qu'on gère son compte.
export function BoutonReglages() {
  const p = usePalette();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/parametres')}
      accessibilityRole="button"
      accessibilityLabel="Paramètres"
      hitSlop={{ top: 0, bottom: 0, left: 0, right: 4 }}
      style={({ pressed }) => [styles.bouton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={12} cy={12} r={3.2} stroke={p.texte} strokeWidth={1.8} />
        <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke={p.texte} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
});
