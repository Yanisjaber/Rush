import { StyleSheet, View } from 'react-native';

// Mini histogramme pour les tuiles compactes. La dernière barre est pleine, les autres atténuées.
// `valeurs` : des nombres ≥ 0 ; `max` : la valeur d'une barre pleine hauteur (par défaut, la plus grande).
interface Props {
  valeurs: number[];
  max?: number;
  couleur: string;
  /** Phrase lue par VoiceOver. */
  etiquette: string;
}

export function MiniBarres({ valeurs, max = 0, couleur, etiquette }: Props) {
  const maximum = max > 0 ? max : Math.max(1, ...valeurs);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={styles.mini}>
      {valeurs.map((v, i) => (
        <View key={i} style={[styles.col, i === valeurs.length - 1 ? null : styles.attenuee]}>
          <View style={{ width: '100%', height: `${Math.max(v > 0 ? 6 : 2, (v / maximum) * 100)}%`, backgroundColor: couleur, borderRadius: 3 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 30 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  attenuee: { opacity: 0.4 },
});
