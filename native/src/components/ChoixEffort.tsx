import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le choix d'un effort ressenti de 1 à 10 (facultatif : retoucher le chiffre choisi l'efface). Deux rangées de cinq pastilles, avec une phrase qui explique l'échelle.
export function ChoixEffort({ valeur, onChange, etiquette, aide }: { valeur: number | null; onChange: (v: number | null) => void; etiquette: string; aide: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text>
      <View style={styles.effort} accessibilityRole="radiogroup" accessibilityLabel={`${etiquette} : de 1 à 10`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const actif = valeur === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(actif ? null : n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={`Effort ${n} sur 10`}
              style={[styles.note, { backgroundColor: actif ? p.texte : p.surface }]}
            >
              <Text style={[typo.corpsFort, { color: actif ? p.fond : p.texte }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16 }]}>{aide}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  effort: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { width: '18%', minHeight: 44, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
});
