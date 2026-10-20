import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { serieEtatDeForme } from '@/data/forme-sante';
import { preparer } from '@/data/score-sommeil';
import type { Taille } from '@/data/types';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMetriques } from '@/hooks/useMetriques';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetEtatDuJour, WidgetFcNuit, WidgetFormeSante, WidgetHrv, WidgetSommeilNuit, WidgetStress, type PropsSante } from '@/widgets/WidgetsSante';

const BARRE_ONGLETS = 72;

// Les widgets de l'écran, dans l'ordre : le premier (l'état du jour) prend le look dossard, comme sur l'Accueil.
// `vers` : l'écran de détail qu'ouvre un appui (la courbe d'état de forme, ou le sommeil).
const WIDGETS: { id: string; titre: string; taille: Taille; Composant: (p: PropsSante) => React.ReactElement; vers: string | null }[] = [
  { id: 'etat', titre: "l'état de forme du jour", taille: 'l', Composant: WidgetEtatDuJour, vers: '/sante/forme' },
  { id: 'sommeil', titre: 'le sommeil de la nuit', taille: 's', Composant: WidgetSommeilNuit, vers: '/sante/sommeil' },
  { id: 'hrv', titre: 'la HRV', taille: 's', Composant: WidgetHrv, vers: '/sante/forme' },
  { id: 'fc', titre: 'la fréquence cardiaque de nuit', taille: 's', Composant: WidgetFcNuit, vers: '/sante/forme' },
  { id: 'stress', titre: 'le stress', taille: 's', Composant: WidgetStress, vers: '/sante/forme' },
  { id: 'forme', titre: "la forme d'entraînement", taille: 'm', Composant: WidgetFormeSante, vers: '/sante/forme' },
];

// L'accès à toutes les données en profondeur : un écran par sujet
const DETAILS: { vers: string; titre: string; description: string }[] = [
  { vers: '/sante/forme', titre: "État de forme", description: 'La courbe sur 60 jours, ce qui la compose, et comment elle est calculée' },
  { vers: '/sante/sommeil', titre: 'Sommeil', description: 'Nuits, phases, graphiques et conseils' },
];

// Santé : l'écran principal. En haut l'état du jour (un indice de forme et trois indicateurs), puis les chiffres importants en grand,
// puis la liste « En détail » qui ouvre chaque sujet en profondeur. Un appui sur un widget ouvre son détail.
export default function Sante() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const bas = useSafeAreaInsets().bottom;
  const router = useRouter();
  const { nuits, chargement, erreur, actualisation, demo, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const triees = useMemo(() => preparer(nuits), [nuits]);
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques), [nuits, metriques]);
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
            {WIDGETS.map(({ id, titre, taille, Composant, vers }, i) => {
              const widget = (
                <Boite taille={taille} heros={i === 0 ? heros : null}>
                  <Composant nuits={triees} metriques={metriques} serie={serie} taille={taille} tuile={taille !== 'l'} />
                </Boite>
              );
              return (
                <Emplacement key={id} taille={taille}>
                  {vers ? (
                    <Pressable onPress={() => router.push(vers as never)} accessibilityRole="button" accessibilityLabel={`Ouvrir le détail : ${titre}`}>
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

        {!chargement ? (
          <View style={styles.details}>
            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
              En détail
            </Text>
            {DETAILS.map((d) => (
              <Pressable key={d.vers} onPress={() => router.push(d.vers as never)} accessibilityRole="button" accessibilityLabel={`${d.titre} : ${d.description}`} style={[styles.ligneDetail, { backgroundColor: p.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{d.titre}</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{d.description}</Text>
                </View>
                <View style={[styles.fleche, { borderColor: p.texteDoux }]} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  details: { gap: espace.e3, marginTop: espace.e2 },
  ligneDetail: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: rayon.bloc, paddingHorizontal: 18, paddingVertical: 12 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
