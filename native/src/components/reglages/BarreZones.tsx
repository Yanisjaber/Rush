import { StyleSheet, View } from 'react-native';
import { avecAlpha, rayon } from '@/theme/couleurs';

// La barre de zones, en lecture : chaque zone est une teinte du sport, de la plus douce à la plus dure, avec la largeur de sa plage.
// Les zones se règlent dans la liste dessous (flèches ou clavier) ; la barre suit en direct.
interface Props {
  /** Le début de chaque zone en % de la référence (la 1re à 0). */
  bornes: number[];
  /** Jusqu'où va la barre, en % de la référence. */
  axeMax: number;
  couleur: string;
}

export const teinteZone = (couleur: string, i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));

export function BarreZones({ bornes, axeMax, couleur }: Props) {
  const n = bornes.length;
  return (
    <View accessible accessibilityLabel={`Les ${n} zones, de la plus douce à la plus dure`} style={styles.barre}>
      {bornes.map((b, i) => {
        const fin = i < n - 1 ? bornes[i + 1] : axeMax;
        return <View key={i} style={{ flex: Math.max(0.5, fin - b), backgroundColor: teinteZone(couleur, i, n) }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 18, borderRadius: rayon.rond, overflow: 'hidden', gap: 2 },
});
