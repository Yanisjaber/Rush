import { StyleSheet, Text, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un chiffre clé : étiquette, grande valeur, unité et note optionnelle.
interface Props {
  etiquette: string;
  valeur: string;
  unite?: string;
  note?: string;
  /** Couleur de la valeur (ex. vert quand on est frais). Par défaut : le texte. */
  couleur?: string;
}

export function StatCle({ etiquette, valeur, unite, note, couleur }: Props) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={[etiquette, valeur, unite, note].filter(Boolean).join(' ')}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{etiquette}</Text>
      <Text style={[styles.valeur, { color: couleur ?? p.texte }]}>
        {valeur}
        {unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
      {note ? <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, marginTop: 4, fontVariant: ['tabular-nums'] },
  note: { marginTop: 4 },
});
