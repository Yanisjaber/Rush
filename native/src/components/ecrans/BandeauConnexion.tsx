import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bouton } from '@/components/ui/Bouton';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Message de l'accueil pour un compte sans connexion : il propose de brancher Strava. Une fois fermé, il ne revient plus.
export function BandeauConnexion({ onFermer }: { onFermer: () => void }) {
  const p = usePalette();
  const router = useRouter();
  return (
    <View style={[styles.carte, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
      <View style={styles.texte}>
        <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>
          Tes sorties arrivent toutes seules
        </Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>Connecte Strava et l'accueil se met à jour après chaque séance.</Text>
        <View style={styles.bouton}>
          <Bouton petit onPress={() => router.push('/parametres/connexions')}>
            Connecter Strava
          </Bouton>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer ce message" hitSlop={8} onPress={onFermer} style={styles.fermer}>
        <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M6 6l12 12M18 6L6 18" stroke={p.texteDoux} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { flexDirection: 'row', alignItems: 'flex-start', gap: espace.e2, borderRadius: rayon.base, borderWidth: 1, paddingLeft: 16, paddingRight: 4, paddingVertical: 12 },
  texte: { flex: 1, gap: 4 },
  titre: { fontFamily: police.titre800, fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  bouton: { alignSelf: 'flex-start', marginTop: espace.e2 },
  fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
