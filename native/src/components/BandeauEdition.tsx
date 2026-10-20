import { StyleSheet, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { rayon } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// La barre du mode édition, fixée en bas de l'écran (au-dessus du menu) : Terminer, Annuler, Réinitialiser.
// Réinitialiser remet la composition automatique (ou celle par défaut de l'onglet).
export function BandeauEdition({ onTerminer, onAnnuler, onAuto }: { onTerminer: () => void; onAnnuler: () => void; onAuto: () => void }) {
  const p = usePalette();
  return (
    <View style={[styles.barre, { backgroundColor: p.surface, borderColor: p.traitFort }]} accessibilityRole="toolbar" accessibilityLabel="Mode édition">
      <View style={styles.bouton}>
        <Bouton onPress={onTerminer}>Terminer</Bouton>
      </View>
      <View style={styles.bouton}>
        <Bouton variante="discret" onPress={onAnnuler}>
          Annuler
        </Bouton>
      </View>
      <View style={[styles.bouton, styles.large]}>
        <Bouton variante="discret" onPress={onAuto}>
          Réinitialiser
        </Bouton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: rayon.bloc, padding: 8 },
  bouton: { flex: 1 },
  large: { flex: 1.3 },
});
