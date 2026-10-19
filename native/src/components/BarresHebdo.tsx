import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/theme/usePalette';

// Une barre par semaine (tonnage, charge de musculation…). La dernière est pleine, les autres atténuées.
// Port des barres des widgets Tonnage et Charge musculation.
interface Props {
  valeurs: number[];
  couleur: string;
  hauteur?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

export function BarresHebdo({ valeurs, couleur, hauteur = 120, etiquette }: Props) {
  const p = usePalette();
  const maximum = Math.max(1, ...valeurs);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={[styles.barres, { height: hauteur, borderBottomColor: p.trait }]}>
      {valeurs.map((v, i) => (
        <View key={i} style={[styles.colonne, { opacity: i === valeurs.length - 1 ? 1 : 0.55 }]}>
          <View style={{ height: `${(v / maximum) * 100}%`, minHeight: 2, backgroundColor: couleur, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  colonne: { flex: 1, height: '100%', justifyContent: 'flex-end' },
});
