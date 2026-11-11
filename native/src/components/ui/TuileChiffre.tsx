import { StyleSheet, Text, View } from 'react-native';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une tuile de la première page d'une activité : quatre tiennent côte à côte. L'étiquette et l'unité sont sur une ligne chacune, la valeur rétrécit au besoin plutôt que de passer à la ligne.
interface Props {
  etiquette: string;
  valeur: string;
  unite?: string;
  /** La donnée est écartée des calculs : le chiffre est barré et grisé. */
  ecarte?: boolean;
}

export function TuileChiffre({ etiquette, valeur, unite, ecarte }: Props) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={[etiquette, valeur, unite, ecarte ? 'écartée de tes calculs' : ''].filter(Boolean).join(' ')} style={[styles.tuile, { backgroundColor: p.surface }]}>
      <Text numberOfLines={1} style={[typo.micro, styles.etiquette, { color: p.texteDoux }, ecarte && styles.barre]}>{etiquette}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.valeur, { color: ecarte ? p.texteMuet : p.texte }, ecarte && styles.barre]}>
        {valeur}
      </Text>
      <Text numberOfLines={1} style={[styles.unite, { color: p.texteDoux }]}>{ecarte ? 'écartée' : (unite ?? ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tuile: { flex: 1, minWidth: 0, borderRadius: rayon.base, paddingVertical: espace.e3, paddingHorizontal: espace.e2 },
  etiquette: { fontSize: 10, lineHeight: 14, letterSpacing: 0.5 },
  valeur: { fontFamily: police.titre700, fontSize: 20, lineHeight: 26, marginTop: 2, fontVariant: ['tabular-nums'] },
  unite: { fontFamily: police.texte400, fontSize: 12, lineHeight: 16 },
  barre: { textDecorationLine: 'line-through' },
});
