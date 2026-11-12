import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ModeleAthleteRealiste } from '@/components/profil/ModeleAthleteRealiste';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { usePalette } from '@/theme/usePalette';

/** Profil volontairement réduit à l'avatar : les données et les réglages restent dans leurs écrans dédiés. */
export default function Profil() {
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation();

  // Le geste « glisser depuis le bord » est coupé ici (il gêne la rotation du mannequin) : sur la pile de Profil
  // ET sur celle du dessus (le groupe Paramètres), sinon c'est elle qui ferme la page. On les remet en quittant.
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ gestureEnabled: false });
      return () => parent?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );

  const hauteurModele = Math.min(680, Math.max(420, height - insets.top - insets.bottom - 24));

  return (
    <View style={[styles.ecran, { backgroundColor: p.fond }]}>
      <FondDegrade />
      <View style={[styles.cadre, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <ModeleAthleteRealiste maillot palette={p} accent={p.sportNeutre} largeur="100%" hauteur={hauteurModele} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        style={({ pressed }) => [styles.retour, { top: insets.top + 8, backgroundColor: p.surface2, opacity: pressed ? 0.7 : 1 }]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  cadre: { flex: 1, justifyContent: 'center' },
  retour: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
