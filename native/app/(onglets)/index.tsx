import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarreSports } from '@/components/BarreSports';
import { construireContexte } from '@/data/contexte';
import { donneesDemo, seriesForceDemo } from '@/data/demo';
import { compositionAuto, composerOnglet, grouperTuiles, type WidgetPlace } from '@/data/registre';
import { useMenu } from '@/stores/menu';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { COMPOSANTS, WidgetBientot } from '@/widgets/composants';

// Sur l'onglet Muscu, ces widgets passent en tuiles de deux par ligne (comme sur le web, voir Accueil.svelte)
const TUILES = new Set(['tonnage', 'regularite']);
// Ces widgets ne se comprennent que grâce à leur graphique (le corps, la courbe de charge) : ils gardent leur version complète
const GRANDS = new Set(['groupes', 'chargemuscu']);
// Hauteur de la barre d'onglets flottante (Liquid Glass) à réserver en bas de la liste, pour que le dernier widget ne passe pas dessous
const BARRE_ONGLETS = 72;

// Accueil en mode démo : des données d'exemple générées (les mêmes que le ?demo du site), sans compte.
// Les widgets affichés dépendent du sport choisi dans la barre du haut (composition du registre).
export default function Accueil() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre, familles } = useMenu();
  const aujourdhui = useMemo(() => new Date(), []);
  const donnees = useMemo(() => donneesDemo(aujourdhui), [aujourdhui]);
  const series = useMemo(() => seriesForceDemo(aujourdhui), [aujourdhui]);
  const contexte = useMemo(() => construireContexte(donnees, series, filtre), [donnees, series, filtre]);

  const widgets = useMemo(() => {
    const auto = compositionAuto(familles);
    return filtre === 'tout' ? auto : composerOnglet(auto, filtre);
  }, [familles, filtre]);

  const compactMuscu = filtre === 'muscu';
  const compactDe = (id: string) => compactMuscu && !GRANDS.has(id);

  // Les tuiles se rangent deux par deux ; les autres widgets prennent toute la largeur
  const blocs = compactMuscu ? grouperTuiles(widgets, (id) => TUILES.has(id)) : widgets;

  const rendre = (w: WidgetPlace) => {
    const Composant = COMPOSANTS[w.id];
    return Composant ? <Composant key={w.id} contexte={contexte} taille={w.taille} compact={compactDe(w.id)} /> : <WidgetBientot key={w.id} id={w.id} />;
  };

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <BarreSports />
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Accueil
          </Text>
          <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text>
        </View>
        {blocs.map((b) =>
          Array.isArray(b) ? (
            <View key={b.map((w) => w.id).join('+')} style={styles.tuiles}>
              {b.map(rendre)}
              {b.length === 1 ? <View style={styles.vide} /> : null}
            </View>
          ) : (
            rendre(b)
          ),
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tuiles: { flexDirection: 'row', gap: espace.e3 },
  vide: { flex: 1 },
});
