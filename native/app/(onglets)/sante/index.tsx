import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { preparer } from '@/data/score-sommeil';
import type { Taille } from '@/data/types';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMetriques } from '@/hooks/useMetriques';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetFcNuit, WidgetFormeSante, WidgetHrv, WidgetSommeilNuit, WidgetStress, type PropsSante } from '@/widgets/WidgetsSante';

const BARRE_ONGLETS = 72;

// Les widgets de l'écran, dans l'ordre : le premier prend le look dossard (comme sur l'Accueil). `detail` : un appui ouvre l'écran du Sommeil.
const WIDGETS: { id: string; titre: string; taille: Taille; Composant: (p: PropsSante) => React.ReactElement; detail: boolean }[] = [
  { id: 'sommeil', titre: 'le sommeil de la nuit', taille: 'l', Composant: WidgetSommeilNuit, detail: true },
  { id: 'hrv', titre: 'la HRV', taille: 's', Composant: WidgetHrv, detail: true },
  { id: 'fc', titre: 'la fréquence cardiaque de nuit', taille: 's', Composant: WidgetFcNuit, detail: true },
  { id: 'stress', titre: 'le stress', taille: 's', Composant: WidgetStress, detail: true },
  { id: 'forme', titre: 'la forme et la fatigue', taille: 's', Composant: WidgetFormeSante, detail: false },
];

// Santé : l'écran principal, une grille de widgets (sommeil de la nuit, HRV, FC de nuit, stress, forme et fatigue).
// Le détail du sommeil (aperçu, graphiques, conseils) s'ouvre en touchant un widget.
export default function Sante() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const bas = useSafeAreaInsets().bottom;
  const router = useRouter();
  const { nuits, chargement, erreur, actualisation, demo, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const triees = useMemo(() => preparer(nuits), [nuits]);
  const heros = { couleur: couleurSport(p) };

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: haut + espace.e4, paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques()])} tintColor={p.texteDoux} />}
      >
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Santé
          </Text>
          {demo ? <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text> : null}
        </View>

        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        {chargement ? (
          <View accessible accessibilityLabel="Chargement de ta santé" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : (
          <GrilleWidgets>
            {WIDGETS.map(({ id, titre, taille, Composant, detail }, i) => {
              const widget = (
                <Boite taille={taille} heros={i === 0 ? heros : null}>
                  <Composant nuits={triees} metriques={metriques} taille={taille} tuile={taille !== 'l'} />
                </Boite>
              );
              return (
                <Emplacement key={id} taille={taille}>
                  {detail ? (
                    <Pressable onPress={() => router.push('/sante/sommeil')} accessibilityRole="button" accessibilityLabel={`Ouvrir le détail du sommeil : ${titre}`}>
                      {widget}
                    </Pressable>
                  ) : (
                    widget
                  )}
                </Emplacement>
              );
            })}
          </GrilleWidgets>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
