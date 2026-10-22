import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon, espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les petits champs partagés par les feuilles du calendrier (ajout, modification d'une note) : des pastilles à choisir, et une ligne de couleurs.

/** Des pastilles dont une seule est choisie (cible tactile de 44 pt). */
export function PastillesChoix<T extends string>({ valeurs, actuel, onChoisir, etiquette }: { valeurs: { cle: T; nom: string }[]; actuel: T; onChoisir: (v: T) => void; etiquette: string }) {
  const p = usePalette();
  return (
    <View style={styles.pastilles} accessibilityRole="radiogroup" accessibilityLabel={etiquette}>
      {valeurs.map((v) => {
        const actif = actuel === v.cle;
        return (
          <Pressable
            key={v.cle}
            onPress={() => onChoisir(v.cle)}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={v.nom}
            style={[styles.pastille, { borderColor: actif ? p.texte : p.contourChamp, backgroundColor: actif ? p.texte : 'transparent' }]}
          >
            <Text numberOfLines={1} style={[typo.corpsFort, { color: actif ? p.fond : p.texte }]}>
              {v.nom}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Une ligne de couleurs (pastilles rondes de 44 pt), une seule choisie. */
export function ChoixCouleur({ couleurs, actuelle, onChoisir }: { couleurs: { hex: string; nom: string }[]; actuelle: string; onChoisir: (hex: string) => void }) {
  const p = usePalette();
  return (
    <View style={styles.couleurs} accessibilityRole="radiogroup" accessibilityLabel="Couleur">
      {couleurs.map((c) => (
        <Pressable
          key={c.hex}
          onPress={() => onChoisir(c.hex)}
          accessibilityRole="radio"
          accessibilityState={{ selected: actuelle === c.hex }}
          accessibilityLabel={c.nom}
          style={[styles.couleur, { backgroundColor: c.hex, borderColor: actuelle === c.hex ? p.texte : 'transparent' }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastille: { minHeight: 44, minWidth: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  couleurs: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e3 },
  couleur: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
});
