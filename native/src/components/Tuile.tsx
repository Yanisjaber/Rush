import { useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ContexteTaille } from '@/components/taille';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tuile compacte : un titre, un chiffre clé, une note et (en dessous) une mini visualisation.
// Deux tuiles tiennent côte à côte sur un iPhone. Port de components/Tuile.svelte.
interface Props {
  titre: string;
  valeur: string;
  unite?: string;
  note?: string;
  children?: ReactNode;
}

export function Tuile({ titre, valeur, unite, note, children }: Props) {
  const p = usePalette();
  // Taille M : la même tuile sur toute la largeur et une seule ligne de haut, le texte à gauche et le visuel à droite
  const taille = useContext(ContexteTaille);
  const ligne = taille === 'm';
  // Taille XS : une ligne fine de 60 pt, le titre et le chiffre à gauche, la note à droite, pas de visuel
  if (taille === 'xs') {
    return (
      <View accessible accessibilityLabel={[titre, valeur, unite, note].filter(Boolean).join(' ')} style={[styles.tuile, styles.fine, { backgroundColor: p.surface }]}>
        <View style={styles.texteLigne}>
          <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
            {titre}
          </Text>
          <Text numberOfLines={1} style={[styles.valeur, styles.valeurFine, { color: p.texte }]}>
            {valeur}
            {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {unite}</Text> : null}
          </Text>
        </View>
        {note ? (
          <Text numberOfLines={2} style={[typo.petit, styles.noteFine, { color: p.texteDoux }]}>
            {note}
          </Text>
        ) : null}
      </View>
    );
  }
  const texte = (
    <View style={ligne ? styles.texteLigne : undefined}>
      <View style={[styles.pastille, { backgroundColor: p.surface2 }]}>
        <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
          {titre}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.valeur, { color: p.texte }]}>
        {valeur}
        {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
      {note ? (
        <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel={[titre, valeur, unite, note].filter(Boolean).join(' ')}
      style={[styles.tuile, ligne && styles.ligne, { backgroundColor: p.surface }]}
    >
      {texte}
      {children ? <View style={ligne ? styles.visuelLigne : styles.visuel}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tuile: { flex: 1, borderRadius: rayon.bloc, paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden' },
  // Le titre est dans une pastille ovale (comme les filtres de Strava)
  pastille: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 3 },
  valeur: { fontFamily: police.titre700, fontSize: 28, lineHeight: 32, marginTop: 6 },
  fine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  // 60 pt de haut : le chiffre est plus petit que dans les autres tailles
  valeurFine: { marginTop: 0, fontSize: 22, lineHeight: 26 },
  noteFine: { flexShrink: 1, maxWidth: '42%', textAlign: 'right' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 16, },
  texteLigne: { flex: 1, minWidth: 0 },
  visuelLigne: { width: '42%', justifyContent: 'center' },
  visuel: { marginTop: 'auto', paddingTop: 8 },
});
