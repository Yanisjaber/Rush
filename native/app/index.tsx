import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donneesDemo, seriesForceDemo } from '@/data/demo';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetAvenir } from '@/widgets/WidgetAvenir';
import { WidgetDernieres } from '@/widgets/WidgetDernieres';

// Accueil en mode démo : des données d'exemple générées (les mêmes que le ?demo du site), sans compte.
// Pour l'instant : « Dernières séances » et « À venir ». Les autres widgets arrivent un par un.
export default function Accueil() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const aujourdhui = useMemo(() => new Date(), []);
  const donnees = useMemo(() => donneesDemo(aujourdhui), [aujourdhui]);
  const series = useMemo(() => seriesForceDemo(aujourdhui), [aujourdhui]);

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={[styles.contenu, { paddingTop: haut + espace.e4 }]}>
      <View style={styles.entete}>
        <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
          Accueil
        </Text>
        <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text>
      </View>
      <WidgetDernieres seances={donnees.seances} series={series} />
      <WidgetAvenir planifiees={donnees.planifiees} aujourdhui={aujourdhui} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, paddingBottom: espace.e7, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
