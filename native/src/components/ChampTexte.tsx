import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le champ de saisie de l'app : une pastille pleine (comme la date), le texte centré dans sa hauteur, le libellé en petit au-dessus. Quand on écrit, un contour clair
// l'entoure. Les textes longs (notes) prennent la même couleur mais des coins moins ronds et le texte en haut. `sur` : sur quel fond le champ est posé
// (« fond » = l'écran, « surface » = une feuille ou une carte, où le champ prend la teinte du dessus pour rester visible).
export function ChampTexte({ etiquette, sur = 'fond', multiline, style, onFocus, onBlur, ref, ...props }: TextInputProps & { etiquette?: string; sur?: 'fond' | 'surface'; ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const p = usePalette();
  const [actif, setActif] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {etiquette ? <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text> : null}
      <TextInput
        {...props}
        ref={ref}
        multiline={multiline}
        placeholderTextColor={p.texteMuet}
        accessibilityLabel={props.accessibilityLabel ?? etiquette}
        onFocus={(e) => {
          setActif(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setActif(false);
          onBlur?.(e);
        }}
        style={[styles.champ, multiline ? styles.long : styles.court, { backgroundColor: sur === 'surface' ? p.surface2 : p.surface, color: p.texte, borderColor: actif ? p.texte : 'transparent' }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  champ: { borderWidth: 2, paddingHorizontal: 18, fontFamily: police.texte600, fontSize: 16 },
  court: { height: 48, borderRadius: rayon.rond, paddingVertical: 0, textAlignVertical: 'center' },
  long: { minHeight: 96, borderRadius: 20, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
});
