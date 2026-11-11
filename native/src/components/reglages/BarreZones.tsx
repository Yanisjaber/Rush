import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { avecAlpha, rayon } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre de zones, en lecture : chaque zone est une teinte du sport, de la plus douce à la plus dure, avec la largeur de sa plage.
// Sous la barre, la valeur où commence chaque zone (sur deux rangées en alternance, pour que des limites proches ne se chevauchent pas). Les zones se règlent dans la liste dessous ; la barre suit en direct.
interface Props {
  /** Le début de chaque zone en % de la référence (la 1re à 0). */
  bornes: number[];
  /** Jusqu'où va la barre, en % de la référence. */
  axeMax: number;
  couleur: string;
  /** Le texte posé sous le début de la zone `i` (≥ 1), par exemple « 152 » ou « 5:30 ». */
  texte?: (i: number) => string;
}

export const teinteZone = (couleur: string, i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));

export function BarreZones({ bornes, axeMax, couleur, texte }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const n = bornes.length;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Les ${n} zones, de la plus douce à la plus dure`} style={texte ? styles.avecTextes : undefined}>
      <View style={styles.barre}>
        {bornes.map((b, i) => {
          const fin = i < n - 1 ? bornes[i + 1] : axeMax;
          return <View key={i} style={{ flex: Math.max(0.5, fin - b), backgroundColor: teinteZone(couleur, i, n) }} />;
        })}
      </View>
      {texte && largeur > 0
        ? bornes.slice(1).map((b, k) => {
            const i = k + 1;
            return (
              <Text
                key={i}
                numberOfLines={1}
                style={[styles.valeur, { color: p.texteDoux, left: Math.min(largeur - 44, Math.max(0, (b / axeMax) * largeur - 22)), top: 22 + (k % 2) * 14 }]}
              >
                {texte(i)}
              </Text>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 18, borderRadius: rayon.rond, overflow: 'hidden', gap: 2 },
  avecTextes: { height: 18 + 4 + 14 + 16 },
  valeur: { position: 'absolute', width: 44, textAlign: 'center', fontFamily: police.texte600, fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
