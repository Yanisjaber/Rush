import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le contenu en grand (taille L) d'un widget « héros » : un très grand chiffre (J-54, le programme du jour…), un nom, un détail,
// et en dessous ce que le widget veut y mettre (boutons, barre de progression). Les couleurs viennent de la palette du cadre.
interface Props {
  valeur: string;
  nom?: string;
  detail?: string;
  /** Un chiffre un peu plus petit (64 pt au lieu de 80) quand le widget a beaucoup de choses à afficher dessous. */
  reduit?: boolean;
  children?: ReactNode;
}

export function GrandChiffre({ valeur, nom, detail, reduit = false, children }: Props) {
  const p = usePalette();
  return (
    <View style={styles.corps}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} maxFontSizeMultiplier={1.3} style={[styles.valeur, reduit && styles.valeurReduite, { color: p.texte }]}>
        {valeur}
      </Text>
      {nom ? (
        <Text numberOfLines={2} style={[typo.titre3, { color: p.texte }]}>
          {nom}
        </Text>
      ) : null}
      {detail ? (
        <Text numberOfLines={3} style={[typo.petit, { color: p.texteDoux }]}>
          {detail}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  corps: { flex: 1, gap: 6, justifyContent: 'flex-end' },
  valeur: { fontFamily: police.titre800, fontSize: 80, lineHeight: 84, letterSpacing: -1 },
  valeurReduite: { fontSize: 64, lineHeight: 68 },
});
