import { StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { SPORTS, type CleSport } from '@/theme/sports';
import { rayon, espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le bandeau du mode édition : il explique, et il propose Terminer, Annuler et « revenir à l'automatique ».
export function BandeauEdition({ onglet, onTerminer, onAnnuler, onAuto }: { onglet: string; onTerminer: () => void; onAnnuler: () => void; onAuto: () => void }) {
  const p = usePalette();
  const nomOnglet = onglet !== 'tout' ? (SPORTS[onglet as CleSport]?.court ?? onglet) : '';
  return (
    <View style={[styles.bandeau, { backgroundColor: p.dossardFond }]} accessibilityRole="summary">
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.dossardTexte }]}>
        Mode édition{nomOnglet ? ` : onglet ${nomOnglet}` : ''}
      </Text>
      <Text style={[typo.petit, { color: p.dossardTexte }]}>Monte, descends, redimensionne ou retire les widgets, puis ajoute-en depuis la liste en bas.</Text>
      <View style={styles.actions}>
        <Bouton variante="sur-dossard" onPress={onTerminer}>
          Terminer
        </Bouton>
        <Bouton variante="sur-dossard-contour" onPress={onAnnuler}>
          Annuler
        </Bouton>
      </View>
      <Bouton variante="sur-dossard-contour" onPress={onAuto}>
        {nomOnglet ? 'Revenir à la composition par défaut de cet onglet' : "Revenir à l'accueil automatique"}
      </Bouton>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { borderRadius: rayon.base, padding: 14, gap: espace.e3 },
  actions: { gap: espace.e3 },
});
