import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bouton } from '@/components/Bouton';
import { dateIsoLocale } from '@/data/outils/format';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'accueil d'un compte neuf (aucune séance, aucun objectif) : à la place des widgets vides, un grand titre, une phrase et les deux façons de commencer
// (brancher Strava, ou saisir une séance à la main). Il disparaît dès que le compte a une donnée.
export function EtatVide({ hauteur }: { hauteur: number }) {
  const p = usePalette();
  const router = useRouter();
  return (
    <View style={[styles.page, { minHeight: hauteur }]}>
      <View style={[styles.lune, { backgroundColor: p.surface }]}>
        <Svg width={30} height={30} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z" stroke={p.texteDoux} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
      <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>
        {'Rien encore.\nNormal.'}
      </Text>
      <Text style={[typo.corps, styles.phrase, { color: p.texteDoux }]}>Ton compte est tout neuf. Ajoute une séance ou branche Strava, et l'accueil se remplit.</Text>
      <View style={styles.boutons}>
        <Bouton onPress={() => router.push('/parametres/connexions')}>Connecter Strava</Bouton>
        <Bouton variante="discret" onPress={() => router.push({ pathname: '/ajout-sortie', params: { date: dateIsoLocale() } })}>
          Saisir une séance
        </Bouton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center', gap: espace.e3, paddingHorizontal: espace.e4, paddingBottom: espace.e6 },
  lune: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: police.titre800, fontSize: 34, lineHeight: 36, letterSpacing: -0.7, textAlign: 'center' },
  phrase: { textAlign: 'center', maxWidth: 300 },
  boutons: { alignSelf: 'stretch', gap: espace.e2, marginTop: espace.e2 },
});
