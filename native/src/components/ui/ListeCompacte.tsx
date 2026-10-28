import { StyleSheet, Text, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une liste serrée de « nom ··· valeur », la partie visuelle des tuiles M (60 % de la largeur, ~110 pt de haut : 3 ou 4 lignes).
// `point` : une pastille de couleur devant le nom (le sport) ; `couleur` : la couleur de la valeur ; `fort` : la valeur en gras plus grande.
export interface LigneCompacte {
  cle: string;
  nom: string;
  valeur: string;
  point?: string;
  couleur?: string;
}

export function ListeCompacte({ lignes, etiquette }: { lignes: LigneCompacte[]; etiquette?: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={etiquette ?? lignes.map((l) => `${l.nom} ${l.valeur}`).join(', ')} style={styles.liste}>
      {lignes.map((l) => (
        <View key={l.cle} style={styles.ligne}>
          {l.point ? <View style={[styles.point, { backgroundColor: l.point }]} /> : null}
          <Text numberOfLines={1} style={[typo.petit, styles.nom, { color: p.texteDoux }]}>
            {l.nom}
          </Text>
          <Text numberOfLines={1} style={[styles.valeur, { color: l.couleur ?? p.texte }]}>
            {l.valeur}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
  point: { width: 10, height: 10, borderRadius: 5 },
  nom: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
