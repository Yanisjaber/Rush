import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'en-tête flottant des écrans plein fond (parcours d'une séance prévue, sortie réalisée) : le retour rond, le titre en pastille et le crayon.
// Un titre trop long pour la pastille est coupé ; un appui dessus l'affiche en entier dans une fenêtre.
interface Props {
  titre: string;
  /** Le crayon en haut à droite : ouvre le formulaire de modification. Absent, pas de crayon. */
  onModifier?: () => void;
}

/** La hauteur du retour et du titre, sous la zone de sécurité : l'écran s'en sert pour garder la trace visible sous l'en-tête. */
export const HAUT_ENTETE = 64;

export function EnteteFlottante({ titre, onModifier }: Props) {
  const p = usePalette();
  const router = useRouter();
  const haut = useSafeAreaInsets().top;
  const [titreCoupe, setTitreCoupe] = useState(false); // le titre dépasse-t-il la pastille ? (mesuré par un texte invisible, sans limite de lignes)
  const [titreOuvert, setTitreOuvert] = useState(false);
  const verre = avecAlpha(p.fond, 0.88);

  return (
    <>
      <View pointerEvents="box-none" style={[styles.entete, { top: haut + espace.e2 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={({ pressed }) => [styles.rond, { backgroundColor: verre, borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.zoneTitre}>
          <Pressable
            disabled={!titreCoupe}
            onPress={() => setTitreOuvert(true)}
            accessibilityRole={titreCoupe ? 'button' : 'header'}
            accessibilityLabel={titre}
            accessibilityHint={titreCoupe ? 'Affiche le titre en entier' : undefined}
            style={[styles.pastilleTitre, { backgroundColor: verre }]}
          >
            <Text numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
              {titre}
            </Text>
            <Text
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onTextLayout={(e) => setTitreCoupe(e.nativeEvent.lines.length > 1)}
              style={[typo.titre3, styles.mesure]}
            >
              {titre}
            </Text>
          </Pressable>
        </View>
        {onModifier ? (
          <Pressable
            onPress={onModifier}
            accessibilityRole="button"
            accessibilityLabel="Modifier"
            style={({ pressed }) => [styles.rond, { backgroundColor: verre, borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={p.texte} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ) : null}
      </View>

      <Modal transparent animationType="fade" visible={titreOuvert} onRequestClose={() => setTitreOuvert(false)}>
        <Pressable onPress={() => setTitreOuvert(false)} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.voile}>
          <View style={[styles.carteTitre, { backgroundColor: p.surface, borderColor: p.trait }]}>
            <Text accessibilityRole="header" selectable style={[typo.titre2, { color: p.texte }]}>
              {titre}
            </Text>
            <Text style={[typo.petit, { color: p.texteMuet }]}>Touche pour fermer</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entete: { position: 'absolute', left: espace.e4, right: espace.e4, flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  rond: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoneTitre: { flex: 1, alignItems: 'flex-start' },
  pastilleTitre: { flexShrink: 1, borderRadius: rayon.base, paddingHorizontal: espace.e3, paddingVertical: 6 },
  // Le texte de mesure : invisible, posé sur le vrai titre, sans limite de lignes (s'il passe sur 2 lignes, le titre est coupé)
  mesure: { position: 'absolute', left: espace.e3, right: espace.e3, top: 6, opacity: 0 },
  voile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5, backgroundColor: 'rgba(0,0,0,0.55)' },
  carteTitre: { width: '100%', borderRadius: rayon.bloc, borderWidth: 1, padding: espace.e5, gap: espace.e3 },
});
