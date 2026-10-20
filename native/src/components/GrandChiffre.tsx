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
  children?: ReactNode;
}

export function GrandChiffre({ valeur, nom, detail, children }: Props) {
  const p = usePalette();
  return (
    <View style={styles.corps}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} maxFontSizeMultiplier={1.3} style={[styles.valeur, { color: p.texte }]}>
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
});
