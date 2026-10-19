import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choisirFiltre, useMenu } from '@/stores/menu';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre des sports, fixe en haut de l'écran : « Tous » puis un sport par pastille (point de sa couleur).
// Le choix est un filtre global : il reste quand on change d'écran. Les pastilles défilent s'il y en a beaucoup.
// Retoucher le sport déjà choisi revient à « Tous » (comme sur le web).
// La barre est posée tout en haut de l'écran : elle réserve elle-même la place de l'heure et de l'encoche.
export function BarreSports() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const { familles, filtre } = useMenu();
  if (!familles.length) return null;

  return (
    <View style={[styles.barre, { backgroundColor: p.fond, borderBottomColor: p.trait, paddingTop: haut }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee} accessibilityRole="tablist">
        <Pastille libelle="Tous" actif={filtre === 'tout'} onPress={() => choisirFiltre('tout')} />
        {familles.map((f) => (
          <Pastille
            key={f}
            libelle={SPORTS[f as CleSport]?.court ?? SPORTS.autre.court}
            point={couleurSport(p, f)}
            actif={filtre === f}
            onPress={() => choisirFiltre(f)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Pastille({ libelle, point, actif, onPress }: { libelle: string; point?: string; actif: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: actif }}
      hitSlop={{ top: 0, bottom: 0, left: 2, right: 2 }}
      style={({ pressed }) => [styles.pastille, { backgroundColor: actif ? p.surface2 : 'transparent', opacity: pressed ? 0.7 : 1 }]}
    >
      {point ? <View style={[styles.point, { backgroundColor: point }]} /> : null}
      <Text style={[styles.texte, { color: actif ? p.texte : p.texteDoux }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: { borderBottomWidth: StyleSheet.hairlineWidth },
  rangee: { paddingHorizontal: 8, alignItems: 'center' },
  // 44 pt de haut : la cible tactile minimale
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 999 },
  point: { width: 9, height: 9, borderRadius: 4.5 },
  texte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
});
