import { StyleSheet, Text, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un classement en barres : une ligne par élément (« 11 mai », sa barre, sa valeur), la barre la plus longue est la première. Sert aux meilleures semaines.
export interface LigneClassement {
  libelle: string;
  valeur: number;
  texte: string;
}

interface Props {
  lignes: LigneClassement[];
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

export function ClassementBarres({ lignes, couleur, etiquette }: Props) {
  const p = usePalette();
  const maximum = Math.max(1e-9, ...lignes.map((l) => l.valeur));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={styles.liste}>
      {lignes.map((l, i) => (
        <View key={`${l.libelle}-${i}`} style={styles.ligne}>
          <Text numberOfLines={1} style={[typo.petit, styles.libelle, { color: i === 0 ? p.texte : p.texteDoux }]}>
            {l.libelle}
          </Text>
          <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
            <View style={{ width: `${Math.max((l.valeur / maximum) * 100, 2)}%`, height: '100%', borderRadius: 3, backgroundColor: couleur, opacity: i === 0 ? 1 : 0.55 }} />
          </View>
          <Text numberOfLines={1} style={[typo.petit, styles.valeur, { color: p.texte }]}>
            {l.texte}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  libelle: { width: 58 },
  piste: { flex: 1, height: 10, borderRadius: 3, overflow: 'hidden' },
  valeur: { width: 84, textAlign: 'right', fontFamily: police.titre700, fontVariant: ['tabular-nums'] },
});
