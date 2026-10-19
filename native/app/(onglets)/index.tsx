import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarreSports } from '@/components/BarreSports';
import { donneesDemo, seriesForceDemo } from '@/data/demo';
import { garderSeance } from '@/data/familles';
import { useMenu } from '@/stores/menu';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetAvenir } from '@/widgets/WidgetAvenir';
import { WidgetDernieres } from '@/widgets/WidgetDernieres';
import { WidgetForme } from '@/widgets/WidgetForme';
import { WidgetSemaine } from '@/widgets/WidgetSemaine';
import { WidgetVolume } from '@/widgets/WidgetVolume';

// Accueil en mode démo : des données d'exemple générées (les mêmes que le ?demo du site), sans compte.
// La barre des sports filtre les séances et les séances prévues ; la forme, elle, reste globale (comme sur le web).
export default function Accueil() {
  const p = usePalette();
  const { filtre } = useMenu();
  const aujourdhui = useMemo(() => new Date(), []);
  const donnees = useMemo(() => donneesDemo(aujourdhui), [aujourdhui]);
  const series = useMemo(() => seriesForceDemo(aujourdhui), [aujourdhui]);

  const seances = useMemo(() => donnees.seances.filter((s) => garderSeance(s, filtre)), [donnees, filtre]);
  const planifiees = useMemo(() => donnees.planifiees.filter((x) => garderSeance(x, filtre)), [donnees, filtre]);

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <BarreSports />
      <ScrollView contentContainerStyle={styles.contenu} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Accueil
          </Text>
          <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text>
        </View>
        <WidgetSemaine seances={seances} planifiees={planifiees} aujourdhui={aujourdhui} />
        <WidgetForme metriques={donnees.metriques} />
        <WidgetVolume seances={seances} aujourdhui={aujourdhui} />
        <WidgetDernieres seances={seances} series={series} />
        <WidgetAvenir planifiees={planifiees} aujourdhui={aujourdhui} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, paddingBottom: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
