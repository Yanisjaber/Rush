import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarreSports } from '@/components/BarreSports';
import { construireContexte } from '@/data/contexte';
import { compositionAuto, composerOnglet, grouperTuiles, type WidgetPlace } from '@/data/registre';
import { useDonneesAccueil } from '@/hooks/useDonneesAccueil';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { COMPOSANTS, WidgetBientot } from '@/widgets/composants';

// Sur l'onglet Muscu, ces widgets passent en tuiles de deux par ligne (comme sur le web, voir Accueil.svelte)
const TUILES = new Set(['tonnage', 'regularite']);
// Ces widgets ne se comprennent que grâce à leur graphique (le corps, la courbe de charge) : ils gardent leur version complète
const GRANDS = new Set(['groupes', 'chargemuscu']);
// Un compte neuf (aucune donnée) ne voit que l'essentiel
const COMPTE_VIDE = new Set(['objectif', 'semaine', 'avenir']);
// Hauteur de la barre d'onglets flottante (Liquid Glass) à réserver en bas de la liste, pour que le dernier widget ne passe pas dessous
const BARRE_ONGLETS = 72;

// Accueil : les widgets du sport choisi dans la barre du haut, avec les données du compte (ou la démo).
export default function Accueil() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre, familles } = useMenu();
  const { donnees, chargement, actualisation, demo, recharger } = useDonneesAccueil();

  const contexte = useMemo(() => (donnees ? construireContexte(donnees, filtre) : null), [donnees, filtre]);

  // Compte neuf : aucune séance, rien de prévu, aucun objectif, ni force ni Hyrox
  const compteVide =
    !!donnees &&
    !demo &&
    !donnees.erreur &&
    !donnees.seances.length &&
    !donnees.dernieres.length &&
    !donnees.planifiees.length &&
    !donnees.objectifs.length &&
    !donnees.force.series.length &&
    !donnees.force.programmes.length &&
    !donnees.hyrox.tests.length;

  const widgets = useMemo(() => {
    const auto = compositionAuto(familles);
    const liste = filtre === 'tout' ? auto : composerOnglet(auto, filtre);
    return compteVide ? liste.filter((w) => COMPTE_VIDE.has(w.id)) : liste;
  }, [familles, filtre, compteVide]);

  const compactMuscu = filtre === 'muscu';
  const compactDe = (id: string) => compactMuscu && !GRANDS.has(id);
  // Les tuiles se rangent deux par deux ; les autres widgets prennent toute la largeur
  const blocs = compactMuscu ? grouperTuiles(widgets, (id) => TUILES.has(id)) : widgets;

  const rendre = (w: WidgetPlace) => {
    if (!contexte) return null;
    const Composant = COMPOSANTS[w.id];
    return Composant ? <Composant key={w.id} contexte={contexte} taille={w.taille} compact={compactDe(w.id)} /> : <WidgetBientot key={w.id} id={w.id} />;
  };

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <BarreSports />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Accueil
          </Text>
          {demo ? <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text> : null}
        </View>

        {chargement ? (
          <View accessible accessibilityLabel="Chargement de tes données" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Chargement de tes données…</Text>
          </View>
        ) : (
          <>
            {donnees?.erreur ? <Avis texte={donnees.erreur} /> : null}
            {donnees?.erreurSport ? <Avis texte={donnees.erreurSport} /> : null}
            {compteVide ? (
              <Avis texte="Ton compte est neuf : rien à afficher pour l'instant. Tes séances arriveront dès que tu auras connecté Strava ou saisi une séance." info />
            ) : null}
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Un message qui accompagne l'écran (erreur de lecture, compte neuf) : jamais de texte brut venu de la base
function Avis({ texte, info = false }: { texte: string; info?: boolean }) {
  const p = usePalette();
  return (
    <View accessible accessibilityRole={info ? undefined : 'alert'} style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: info ? p.sportNeutre : p.alerte }]}>
      <Text style={[typo.petit, { color: p.texte }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', gap: espace.e3, paddingVertical: espace.e7 },
  tuiles: { flexDirection: 'row', gap: espace.e3 },
  vide: { flex: 1 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
