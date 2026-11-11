import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { largeursZones } from '@/data/reglages/barre-zones';
import { avecAlpha } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre de zones : chaque zone est une teinte du sport, de la plus douce à la plus dure, avec son nom dedans (quand elle est assez large) et, dessous,
// la valeur où elle commence. Les largeurs suivent les plages réelles. Avec `figees`, la première et la dernière zone (sans vraie fin, donc énormes) ont une largeur fixe
// et laissent la place aux zones du milieu (le cœur : Z1 et Z5 figées, Z2 à Z4 lisibles). Les zones se règlent dans la liste dessous ; la barre suit en direct.
interface Props {
  /** Le début de chaque zone en % de la référence (la 1re à 0). */
  bornes: number[];
  /** Jusqu'où va la barre, en % de la référence (sert à la dernière zone, sans fin). */
  axeMax: number;
  couleur: string;
  /** Le nom court de chaque zone (« Z1 »…), écrit dans la barre si la place le permet. */
  noms?: string[];
  /** Le texte posé sous le début de la zone `i` (≥ 1), par exemple « 152 » ou « 5:30 ». */
  texte?: (i: number) => string;
  /** La première et la dernière zone gardent une largeur fixe. */
  figees?: boolean;
}

const HAUT = 30;
const LARGEUR_TEXTE = 44;

export const teinteZone = (couleur: string, i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));

export function BarreZones({ bornes, axeMax, couleur, noms, texte, figees = false }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const n = bornes.length;
  const parts = largeursZones(bornes, axeMax, figees);
  const debuts = parts.map((_, i) => parts.slice(0, i).reduce((a, b) => a + b, 0));
  // Les valeurs : sur une seule rangée tant qu'elles ne se touchent pas, sinon la suivante passe sur une 2e rangée
  const rangees: number[] = [];
  let dernier = [-99, -99];
  for (let i = 1; i < n; i++) {
    const x = debuts[i] * largeur;
    let r = 0;
    if (x - dernier[0] < LARGEUR_TEXTE - 6) r = x - dernier[1] < LARGEUR_TEXTE - 6 ? 0 : 1;
    rangees[i] = r;
    dernier[r] = x;
  }
  const deuxRangees = rangees.some((r) => r === 1);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Les ${n} zones, de la plus douce à la plus dure`}
      style={{ height: HAUT + (texte ? 6 + 16 + (deuxRangees ? 14 : 0) : 0) }}
    >
      <View style={styles.barre}>
        {bornes.map((_, i) => (
          <View key={i} style={[styles.segment, { flex: parts[i], backgroundColor: teinteZone(couleur, i, n) }]}>
            {noms && parts[i] * largeur >= 26 ? (
              <Text numberOfLines={1} style={[styles.nom, { color: i < n / 2 ? p.texte : p.encreSurCouleur }]}>{noms[i]}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {texte && largeur > 0
        ? bornes.slice(1).map((_, k) => {
            const i = k + 1;
            const x = debuts[i] * largeur;
            return (
              <Text key={i} numberOfLines={1} style={[styles.valeur, { color: p.texteDoux, left: Math.min(largeur - LARGEUR_TEXTE, Math.max(0, x - LARGEUR_TEXTE / 2)), top: HAUT + 6 + rangees[i] * 14 }]}>
                {texte(i)}
              </Text>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: HAUT, borderRadius: 8, overflow: 'hidden', gap: 2 },
  segment: { alignItems: 'center', justifyContent: 'center' },
  nom: { fontFamily: police.texte600, fontSize: 12 },
  valeur: { position: 'absolute', width: LARGEUR_TEXTE, textAlign: 'center', fontFamily: police.texte600, fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
