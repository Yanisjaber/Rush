import { StyleSheet, Text, View } from 'react-native';
import { formatNum } from '@/data/outils/format';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'échelle d'un graphique en barres, comme dans le cumul sur 3 ans : des traits fins au tiers, aux deux tiers et en haut de l'échelle,
// avec leur valeur écrite dans une marge à gauche des barres (jamais sous une barre). À poser derrière les barres, dans un conteneur de la même hauteur que la zone des barres,
// dont le contenu est décalé de `GOUTTIERE_ECHELLE` vers la droite.
export const GOUTTIERE_ECHELLE = 36;

interface Props {
  /** Haut de l'échelle (un chiffre rond, voir maximumRond) : 0 ou moins, et rien n'est dessiné. */
  maximum: number;
  /** Marges entre le conteneur et la zone des barres (une valeur écrite au-dessus, des lettres dessous). */
  haut?: number;
  bas?: number;
}

/** Les valeurs des repères : un tiers, deux tiers et le haut, arrondis, toutes différentes (avec un petit maximum, les arrondis se répéteraient). */
export function graduationsBarres(maximum: number): number[] {
  if (!(maximum > 0)) return [];
  return [...new Set([maximum / 3, (2 * maximum) / 3, maximum].map(Math.round))].filter((v) => v > 0);
}

export function EchelleBarres({ maximum, haut = 0, bas = 0 }: Props) {
  const p = usePalette();
  return (
    <View pointerEvents="none" style={[styles.zone, { top: haut, bottom: bas }]}>
      {graduationsBarres(maximum).map((v) => (
        <View key={v} style={[styles.repere, { bottom: `${Math.min(100, (v / maximum) * 100)}%` }]}>
          <View style={[styles.trait, { backgroundColor: p.trait }]} />
          <Text numberOfLines={1} style={[styles.valeur, { color: p.texteMuet, fontFamily: police.texte400 }]}>{formatNum(v, 0)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0 },
  repere: { position: 'absolute', left: 0, right: 0, height: 0 },
  trait: { position: 'absolute', left: GOUTTIERE_ECHELLE - 2, right: 0, height: StyleSheet.hairlineWidth },
  // Centrée sur son trait, alignée à droite contre les barres
  valeur: { position: 'absolute', left: 0, width: GOUTTIERE_ECHELLE - 6, bottom: -6, textAlign: 'right', fontSize: 9.5, lineHeight: 12, fontVariant: ['tabular-nums'] },
});
