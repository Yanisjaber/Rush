import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarreSports } from '@/components/BarreSports';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Écran provisoire des pages pas encore refaites en natif : le titre et une phrase.
// avecSports : montre la barre des sports en haut (Calendrier, Bilan… comme sur le web).
interface Props {
  titre: string;
  description: string;
  avecSports?: boolean;
}

export function EcranBientot({ titre, description, avecSports = false }: Props) {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      {avecSports ? <BarreSports /> : null}
      {/* Sans barre des sports, c'est le contenu qui réserve la place de l'heure et de l'encoche */}
      <View style={[styles.contenu, !avecSports && { paddingTop: haut + espace.e4 }]}>
        <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
          {titre}
        </Text>
        <Text style={[typo.corps, { color: p.texteDoux }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e2 },
});
