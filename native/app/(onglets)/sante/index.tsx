import { FondDegrade } from '@/components/FondDegrade';
import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { CourbeLissee } from '@/components/CourbeLissee';
import { JaugePilier } from '@/components/JaugePilier';
import { Tuile } from '@/components/Tuile';
import { CLES_RESSENTI, jusquAuDernierIndice, serieEtatDeForme } from '@/data/forme-sante';
import { dateIsoLocale } from '@/data/format';
import { construirePiliers, construireSuivis, motifsDuJour, NOM_COURT } from '@/data/piliers';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { WidgetEtatDuJour } from '@/widgets/WidgetsSante';

const BARRE_ONGLETS = 72;
// Santé : l'écran du matin, fait pour se lire d'un coup d'œil, sans phrase.
//   1. L'état du jour : un anneau qui se remplit, l'indice au centre, un mot.
//   2. Les piliers : une jauge ronde chacun, du plus bas au plus haut (la première est ce qui tire le plus vers le bas).
//   3. Le check-in : cinq points, pleins quand tu as répondu.
//   4. Les suivis : le corps et la nutrition.
// Un appui sur n'importe quel élément ouvre son détail.
export default function Sante() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const bas = useSafeAreaInsets().bottom;
  const router = useRouter();
  const { nuits, chargement, erreur, actualisation, demo, recharger } = useDonneesSommeil();
  const { metriques, chargement: chargementMetriques, erreur: erreurMetriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, chargement: chargementMesures, erreur: erreurMesures, recharger: rechargerMesures } = useMesuresSante();
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  // Le dernier jour qui a un indice : le matin, avant la synchro de la montre, le jour d'aujourd'hui n'a que ton check-in (pas assez pour un chiffre)
  const serieJour = useMemo(() => jusquAuDernierIndice(serie), [serie]);
  const piliers = useMemo(() => construirePiliers(nuits, metriques, mesures, serieJour), [nuits, metriques, mesures, serieJour]);
  const aujourdhui = dateIsoLocale(new Date());
  const dernierJour = serieJour[serieJour.length - 1];
  const jourAffiche = dernierJour?.indice != null && dernierJour.date !== aujourdhui ? dernierJour.date : null;
  const manquants = dernierJour?.indice != null ? dernierJour.manquants : [];
  const message = erreur || erreurMesures || erreurMetriques;

  // Au retour d'un sous-écran (check-in, corps, nutrition), on recharge les mesures : sauf au tout premier affichage, déjà chargé par les hooks
  const dejaVu = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (dejaVu.current) void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()]);
      dejaVu.current = true;
    }, [recharger, rechargerMetriques, rechargerMesures]),
  );
  const motifs = useMemo(() => motifsDuJour(piliers), [piliers]);
  const principaux = useMemo(() => piliers.filter((x) => !x.surveille), [piliers]);
  const surveilles = useMemo(() => piliers.filter((x) => x.surveille), [piliers]);
  const alertes = useMemo(() => surveilles.filter((x) => x.alerte), [surveilles]);
  const suivis = useMemo(() => construireSuivis(mesures, aujourdhui), [mesures, aujourdhui]);
  const reponses = CLES_RESSENTI.filter((c) => mesures[aujourdhui]?.[c] != null).length;
  const aller = (vers: string) => router.push(vers as never);
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={[styles.page, { backgroundColor: 'transparent' }]}>
      <FondDegrade />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: haut + espace.e4, paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()])} tintColor={p.texteDoux} />}
      >
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Santé
          </Text>
          <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'capitalize' }]}>{demo ? 'Mode démo' : date}</Text>
        </View>

        {message ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{message}</Text>
          </View>
        ) : null}

        {chargement || chargementMesures || chargementMetriques ? (
          <View accessible accessibilityLabel="Chargement de ta santé" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : (
          <>
            <Pressable onPress={() => aller('/sante/forme')} accessibilityRole="button" accessibilityLabel="État de forme du jour. Ouvrir la courbe et le calcul.">
              <Boite taille="l" hauteur={200} heros={{ couleur: couleurSport(p) }}>
                <WidgetEtatDuJour serie={serieJour} />
              </Boite>
            </Pressable>
            {jourAffiche ? (
              <Text style={[typo.micro, { color: p.texteMuet, marginTop: -espace.e1 }]}>
                Dernières données : {new Date(`${jourAffiche}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            ) : null}

            {motifs.length || alertes.length ? (
              // Une seule rangée de puces : ce qui a bougé, puis les alertes (elles ne changent pas le chiffre : elles signalent un écart marqué à ta norme)
              <View style={styles.motifs}>
                {motifs.map((m) => {
                  const couleur = m.niveau === 'bon' ? p.ok : m.niveau === 'moyen' ? p.alerte : m.niveau === 'faible' ? p.danger : p.texteMuet;
                  return (
                    <Pressable key={m.cle} onPress={() => aller(m.vers)} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button" accessibilityLabel={`${m.nom} ${m.delta} par rapport à ta moyenne`} style={[styles.motif, { backgroundColor: p.surface }]}>
                      <View style={[styles.pointMotif, { backgroundColor: couleur }]} />
                      <Text style={[typo.petit, { color: p.texte }]}>
                        {m.nom} <Text style={{ fontFamily: police.texte600 }}>{m.delta}</Text>
                      </Text>
                    </Pressable>
                  );
                })}
                {alertes.map((x) => (
                  <Pressable key={x.cle} onPress={() => aller(x.vers)} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button" accessibilityLabel={`Alerte, ${x.nom} : ${x.valeur} ${x.unite}`} style={[styles.motif, { backgroundColor: p.surface, borderWidth: 1, borderColor: p.danger }]}>
                    <Text style={[typo.petit, { color: p.danger, fontFamily: police.texte600 }]}>!</Text>
                    <Text style={[typo.petit, { color: p.texte }]}>
                      {NOM_COURT[x.cle]} <Text style={{ fontFamily: police.texte600 }}>{/^[+−]\d/.test(x.ecart ?? '') ? (x.ecart as string).split(' ')[0] : x.valeur}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte, marginTop: espace.e2 }]}>
              Piliers
            </Text>
            <View style={styles.jauges}>
              {principaux.map((x) => (
                <JaugePilier colonnes={5} key={x.cle} nom={NOM_COURT[x.cle]} indice={x.indice} valeur={x.valeur} unite={x.unite} onPress={() => aller(x.vers)} />
              ))}
            </View>

            {manquants.length ? (
              // Ce qui rendrait l'estimation plus précise : une consigne par pilier sans donnée
              <View style={[styles.conseil, { backgroundColor: p.surface }]}>
                <Text style={[typo.micro, { color: p.texteMuet }]}>Pour être plus précis</Text>
                {manquants.map((m) => (
                  <Text key={m.cle} style={[typo.petit, { color: p.texteDoux }]}>
                    {m.comment}
                  </Text>
                ))}
              </View>
            ) : null}

            {surveilles.length ? (
              <>
                <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte, marginTop: espace.e2 }]}>
                  Surveillés
                </Text>
                <View style={styles.jauges}>
                  {surveilles.map((x) => (
                    <JaugePilier colonnes={3} key={x.cle} nom={NOM_COURT[x.cle]} indice={x.indice} valeur={x.valeur} unite={x.unite} onPress={() => aller(x.vers)} />
                  ))}
                </View>
              </>
            ) : null}

            <Pressable
              onPress={() => aller('/sante/checkin')}
              accessibilityRole="button"
              accessibilityLabel={reponses === 5 ? 'Check-in du matin fait. Le modifier.' : `Check-in du matin : ${reponses} réponse${reponses > 1 ? 's' : ''} sur 5. Le faire.`}
              style={[styles.checkin, { backgroundColor: p.surface }]}
            >
              <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>Check-in</Text>
              <View style={styles.pointsCheckin}>
                {CLES_RESSENTI.map((q, i) => (
                  <View key={q} style={[styles.pointCheckin, { backgroundColor: i < reponses ? p.ok : p.traitFort }]} />
                ))}
              </View>
              <View style={[styles.fleche, { borderColor: p.texteDoux }]} />
            </Pressable>

            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte, marginTop: espace.e2 }]}>
              Suivis
            </Text>
            <GrilleWidgets>
              {suivis.map((x) => (
                <Emplacement key={x.cle} taille="s">
                  <Pressable onPress={() => aller(x.vers)} accessibilityRole="button" accessibilityLabel={`${x.nom} : ${x.valeur} ${x.unite} ${x.ecart ?? ''}`.trim()} accessibilityHint="Ouvre le détail">
                    <Boite taille="s">
                      <Tuile gros titre={x.nom} valeur={x.valeur} unite={x.unite.replace(' par jour', '/j')} note={x.ecart ?? x.manquant ?? undefined}>
                        {x.courbe.length > 1 ? <CourbeLissee valeurs={x.courbe} couleur={p.texteDoux} largeur={100} hauteur={36} aire={false} pointFinal={false} epaisseur={2.2} etiquette={`${x.nom} sur ${x.courbe.length} jours`} /> : null}
                      </Tuile>
                    </Boite>
                  </Pressable>
                </Emplacement>
              ))}
            </GrilleWidgets>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, gap: espace.e3 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  motifs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motif: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, borderRadius: rayon.rond, paddingHorizontal: 14 },
  pointMotif: { width: 9, height: 9, borderRadius: 5 },
  jauges: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espace.e2 },
  conseil: { borderRadius: rayon.bloc, paddingHorizontal: 18, paddingVertical: 12, gap: 4 },
  checkin: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: rayon.bloc, paddingHorizontal: 18 },
  pointsCheckin: { flexDirection: 'row', gap: 6 },
  pointCheckin: { width: 10, height: 10, borderRadius: 5 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
});
