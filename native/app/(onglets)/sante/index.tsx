import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boite } from '@/components/GrilleWidgets';
import { CartePilier } from '@/components/CartePilier';
import { serieEtatDeForme } from '@/data/forme-sante';
import { dateIsoLocale } from '@/data/format';
import { consignesMasquees, construirePiliers, construireSuivis } from '@/data/piliers';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetEtatDuJour } from '@/widgets/WidgetsSante';

const BARRE_ONGLETS = 72;
const QUESTIONS = ['ressenti_fatigue', 'ressenti_courbatures', 'ressenti_humeur', 'ressenti_motivation', 'ressenti_stress'];

// Santé : l'écran principal, lu de haut en bas dans un seul ordre.
//   1. Comment je vais ?  L'état du jour, en une ligne (un indice de 0 à 100, une phrase, la précision) ; un appui ouvre la courbe et le calcul.
//   2. À faire.           Le check-in du matin, 10 secondes.
//   3. Pourquoi ?         Les piliers qui expliquent l'état, du plus bas au plus haut : une carte identique pour chacun.
//   4. Tes suivis.        Le corps et la nutrition, avec la même carte. Un appui sur une carte ouvre son détail.
export default function Sante() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const bas = useSafeAreaInsets().bottom;
  const router = useRouter();
  const { nuits, chargement, erreur, actualisation, demo, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, recharger: rechargerMesures } = useMesuresSante();
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const piliers = useMemo(() => construirePiliers(nuits, metriques, mesures, serie), [nuits, metriques, mesures, serie]);
  const suivis = useMemo(() => construireSuivis(mesures, dateIsoLocale(new Date())), [mesures]);
  const aPlus = consignesMasquees(piliers, serie[serie.length - 1]);
  const reponses = QUESTIONS.filter((c) => mesures[dateIsoLocale(new Date())]?.[c] != null).length;
  const aller = (vers: string) => router.push(vers as never);

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: haut + espace.e4, paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()])} tintColor={p.texteDoux} />}
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
          <>
            <Pressable onPress={() => aller('/sante/forme')} accessibilityRole="button" accessibilityLabel="État de forme du jour. Ouvrir la courbe et le calcul." style={{ marginHorizontal: 0 }}>
              <Boite taille="m" heros={{ couleur: couleurSport(p) }}>
                <WidgetEtatDuJour serie={serie} compact />
              </Boite>
            </Pressable>

            <Section titre="À faire" />
            <Pressable
              onPress={() => aller('/sante/checkin')}
              accessibilityRole="button"
              accessibilityLabel={reponses === 5 ? 'Check-in du matin fait. Le modifier.' : 'Faire le check-in du matin, dix secondes'}
              style={[styles.checkin, { backgroundColor: p.surface }]}
            >
              <View style={[styles.pastille, { backgroundColor: reponses === 5 ? p.ok : p.alerte }]} />
              <View style={{ flex: 1 }}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>Check-in du matin</Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>
                  {reponses === 5 ? "Fait aujourd'hui. Touche pour le modifier." : reponses > 0 ? `${reponses} réponse${reponses > 1 ? 's' : ''} sur 5. Touche pour finir.` : 'Pas encore fait : 10 secondes pour une estimation plus précise.'}
                </Text>
              </View>
              <View style={[styles.fleche, { borderColor: p.texteDoux }]} />
            </Pressable>

            <Section titre="Ce qui explique ton état" sous="Du pilier le plus bas au plus haut. Le point dit où tu en es par rapport à ta norme." />
            {piliers.map((x) => (
              <CartePilier key={x.cle} nom={x.nom} valeur={x.valeur} unite={x.unite} ecart={x.ecart} niveau={x.niveau} courbe={x.courbe} manquant={x.manquant} onPress={() => aller(x.vers)} />
            ))}
            {aPlus.length ? (
              <Text style={[typo.petit, { color: p.texteDoux }]}>Pour être encore plus précis : {aPlus.join(' ')}</Text>
            ) : null}

            <Section titre="Tes suivis" sous="Des tendances lentes : elles ne changent pas l'état du jour." />
            {suivis.map((x) => (
              <CartePilier key={x.cle} nom={x.nom} valeur={x.valeur} unite={x.unite} ecart={x.ecart} courbe={x.courbe} manquant={x.manquant} onPress={() => aller(x.vers)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Le titre d'une section : toujours le même, avec une ligne d'explication facultative
function Section({ titre, sous }: { titre: string; sous?: string }) {
  const p = usePalette();
  return (
    <View style={{ marginTop: espace.e3 }}>
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
        {titre}
      </Text>
      {sous ? <Text style={[typo.petit, { color: p.texteDoux }]}>{sous}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, gap: espace.e3 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  checkin: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: rayon.bloc, paddingHorizontal: 18, paddingVertical: 12 },
  pastille: { width: 12, height: 12, borderRadius: 6 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
});
