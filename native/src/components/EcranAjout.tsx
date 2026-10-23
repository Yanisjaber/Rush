import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le gabarit des écrans d'ajout du « + » : un titre, les champs, l'erreur éventuelle et le bouton d'enregistrement. Le clavier ne cache jamais les champs
// (on peut faire défiler, et toucher en dehors d'un champ le ferme).
export function EcranAjout({ titre, bouton, enCours, erreur, onValider, children }: { titre: string; bouton: string; enCours: boolean; erreur: string; onValider: () => void; children: ReactNode }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e6 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
        {titre}
      </Text>
      {children}
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreur}
        </Text>
      ) : null}
      <Bouton onPress={onValider}>{enCours ? 'Enregistrement…' : bouton}</Bouton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, gap: espace.e4 },
});
