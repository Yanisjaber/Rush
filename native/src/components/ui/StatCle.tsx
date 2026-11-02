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
  /** Un chiffre de 24 pt (rangées de repères), au lieu de 40. */
  petit?: boolean;
  /** La donnée est écartée des calculs : le chiffre est barré et grisé, la note devient « écartée ». */
  ecarte?: boolean;
}

export function StatCle({ etiquette, valeur, unite, note, couleur, petit, ecarte }: Props) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={[etiquette, valeur, unite, ecarte ? 'écartée de tes calculs' : note].filter(Boolean).join(' ')}>
      <Text style={[typo.micro, { color: p.texteDoux }, ecarte && styles.barre]}>{etiquette}</Text>
      <Text style={[styles.valeur, petit && styles.valeurPetite, { color: ecarte ? p.texteMuet : (couleur ?? p.texte) }, ecarte && styles.barre]}>
        {valeur}
        {unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
      {ecarte ? <Text style={[typo.petit, styles.note, { color: p.danger }]}>écartée</Text> : note ? <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, marginTop: 4, fontVariant: ['tabular-nums'] },
  valeurPetite: { fontSize: 20, lineHeight: 24, marginTop: 2 },
  note: { marginTop: 4 },
  barre: { textDecorationLine: 'line-through' },
});
