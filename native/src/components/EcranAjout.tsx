import type { ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le gabarit des écrans d'ajout du « + » : les champs, l'erreur éventuelle et le bouton d'enregistrement (le titre est celui de l'en-tête de l'écran). Le clavier ne cache jamais les champs
// (on peut faire défiler, et toucher en dehors d'un champ le ferme).
// `entete` : un bandeau fixe au-dessus de la zone qui défile (le dossard et les onglets de la compétition restent en vue pendant la saisie).
export function EcranAjout({ bouton, enCours, erreur, onValider, entete, children }: { bouton: string; enCours: boolean; erreur: string; onValider: () => void; entete?: ReactNode; children: ReactNode }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  return (
    <>
      {entete ? <View style={[styles.entete, { backgroundColor: p.fond }]}>{entete}</View> : null}
    <ScrollView contentContainerStyle={{ paddingBottom: bas + espace.e6 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      {/* Toucher à côté d'un champ ferme le clavier (le curseur disparaît, ce qui est tapé reste) ; les champs et les boutons gardent leur propre toucher */}
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.contenu}>
        {children}
        {erreur ? (
          <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
            {erreur}
          </Text>
        ) : null}
        <Bouton disabled={enCours} onPress={() => { if (!enCours) onValider(); }}>{enCours ? 'Enregistrement…' : bouton}</Bouton>
      </Pressable>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, gap: espace.e4 },
  entete: { paddingHorizontal: espace.e4, paddingTop: espace.e2, paddingBottom: espace.e3, gap: espace.e3 },
});
