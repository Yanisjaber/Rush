import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Des onglets en pastille : un bloc arrondi, l'onglet choisi est plein (comme les pastilles de priorité). Chaque onglet fait au moins 44 pt de haut.
export function OngletsSegment<T extends string>({ onglets, actuel, onChoisir, etiquette }: { onglets: { cle: T; nom: string }[]; actuel: T; onChoisir: (cle: T) => void; etiquette: string }) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={etiquette} style={[styles.cadre, { backgroundColor: p.surface }]}>
      {onglets.map((o) => {
        const actif = o.cle === actuel;
        return (
          <Pressable
            key={o.cle}
            onPress={() => onChoisir(o.cle)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={o.nom}
            style={[styles.onglet, actif && { backgroundColor: p.texte }]}
          >
            <Text numberOfLines={1} style={[typo.corpsFort, { color: actif ? p.fond : p.texteDoux, fontSize: 15 }]}>
              {o.nom}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { flexDirection: 'row', borderRadius: rayon.rond, padding: 4 },
  onglet: { flex: 1, minHeight: 44, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
