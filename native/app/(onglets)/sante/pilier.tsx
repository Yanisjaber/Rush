import { FondDegrade } from '@/components/FondDegrade';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnneauJauge } from '@/components/AnneauJauge';
import { Bloc } from '@/components/Bloc';
import { CourbeLissee } from '@/components/CourbeLissee';
import { estPilier, NOM_COMPOSANTE, POIDS_FORME, niveauDe, serieEtatDeForme, type CleComposante, type Niveau } from '@/data/forme-sante';
import { construirePiliers, historiquePilier, texteValeur } from '@/data/piliers';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;
// Les piliers où une valeur plus BASSE que d'habitude est une bonne nouvelle
const SENS_INVERSE = new Set<CleComposante>(['fc', 'stress', 'resp']);
const PERIODES = [7, 30, 60] as const;
const MOT: Record<Niveau, string> = { bon: 'Bon', moyen: 'Moyen', faible: 'Faible' };

// Ce que dit chaque pilier : comment le lire et d'où vient la méthode. Un seul modèle d'écran pour tous (voir plus bas).
const INFOS: Partial<Record<CleComposante, { veutDire: string; lecture: string; source: string }>> = {
  hrv: {
    veutDire: "La variabilité de ton rythme cardiaque pendant la nuit : c'est la mesure la plus sensible de ta récupération.",
    lecture: "Comparée à TA moyenne : plus haute que d'habitude, c'est que ton corps a bien récupéré ; plus basse, qu'il est fatigué ou sous stress. On regarde la moyenne des 3 dernières nuits.",
    source: 'Plews et coll., 2013 ; Buchheit, 2014 (suivi de la récupération par la HRV).',
  },
  fc: {
    veutDire: 'La fréquence cardiaque la plus basse de ta nuit.',
    lecture: "Comparée à TA moyenne : plus basse que d'habitude, tu es bien récupéré ; plus haute, c'est un signe de fatigue, de stress ou de début de maladie.",
    source: 'Buchheit, 2014 (fréquence cardiaque de repos et état d\'entraînement).',
  },
  stress: {
    veutDire: 'Le stress moyen de la nuit mesuré par ta montre, de 0 à 100.',
    lecture: "Comparé à TA moyenne : plus bas que d'habitude, tu as mieux récupéré ; plus haut, la nuit a été plus agitée. Surveillé seulement : il est dérivé de la HRV, qui compte déjà dans l'état de forme.",
    source: 'Dérivé de la HRV par la montre ; même méthode de comparaison à ta propre référence.',
  },
  charge: {
    veutDire: "Ta fraîcheur d'entraînement : la condition (ta forme de fond) moins la fatigue des dernières séances.",
    lecture: "Positive : tu es frais. Autour de zéro : équilibré. Très négative : tu es fatigué par tes séances. On la ramène entre 0 et 100 pour l'état de forme (0 de fraîcheur vaut 50).",
    source: "Banister et coll., 1975 (modèle fitness-fatigue), repris dans ton calcul de charge d'entraînement.",
  },
  resp: {
    veutDire: 'Ta fréquence respiratoire pendant la nuit, en respirations par minute.',
    lecture: "Comparée à TA moyenne : plus haute que d'habitude, c'est souvent un signe de maladie ou de surcharge.",
    source: 'Mesure d\'un appareil (Whoop, Apple Santé) ; même méthode de comparaison à ta propre référence.',
  },
  temperature: {
    veutDire: "L'écart de ta température cutanée à ta normale, en degrés.",
    lecture: "Plus l'écart est grand (au-dessus comme en dessous), plus l'indice baisse : un écart marqué peut annoncer une infection ou venir du cycle.",
    source: "Mesure d'un appareil (Whoop, Apple Santé).",
  },
};

// Le détail d'un pilier. Toujours le même modèle : 1. Aujourd'hui, 2. Évolution, 3. Ce que ça veut dire, 4. D'où ça vient.
export default function Pilier() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { cle } = useLocalSearchParams<{ cle: string }>();
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]>(60);
  const [lecture, setLecture] = useState(false);
  const { nuits, chargement, actualisation, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, recharger: rechargerMesures } = useMesuresSante();
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const piliers = useMemo(() => construirePiliers(nuits, metriques, mesures, serie), [nuits, metriques, mesures, serie]);

  const cleValide = (Object.keys(POIDS_FORME) as CleComposante[]).find((c) => c === cle);
  const infos = cleValide ? INFOS[cleValide] : undefined;
  if (!cleValide || !infos) {
    return (
      <View style={[styles.page, { backgroundColor: 'transparent' }]}>
        <FondDegrade />
        <Text style={[typo.corps, { color: p.texteDoux, padding: espace.e4 }]}>Ce sujet n'existe pas.</Text>
      </View>
    );
  }

  const vue = piliers.find((x) => x.cle === cleValide);
  const histo = historiquePilier(cleValide, nuits, metriques, mesures);
  const recent = histo.slice(-periode);
  const reference = histo.slice(-29, -1);
  const moyenne = reference.length >= 10 ? reference.reduce((a, b) => a + b, 0) / reference.length : null;
  const niveau = niveauDe(vue?.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.texteMuet;

  return (
    <View style={{ flex: 1 }}>
      <FondDegrade />
      <ScrollView
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()])} tintColor={p.texteDoux} />}
    >
      <Stack.Screen options={{ title: NOM_COMPOSANTE[cleValide] }} />
      {chargement ? (
        <View accessible accessibilityLabel="Chargement" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <AnneauJauge
              valeur={vue?.indice ?? null}
              taille={190}
              epaisseur={18}
              couleur={couleur}
              piste={p.surface2}
              etiquette={`${NOM_COMPOSANTE[cleValide]} : ${vue && vue.valeur !== '—' ? `${vue.valeur} ${vue.unite}, ${niveau ? MOT[niveau] : ''}` : 'pas de donnée'}`}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.valeur, { color: vue && vue.valeur !== '—' ? p.texte : p.texteMuet }]}>
                {vue && vue.valeur !== '—' ? vue.valeur : '—'}
              </Text>
              {vue?.unite && vue.valeur !== '—' ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{vue.unite}</Text> : null}
            </AnneauJauge>
            {niveau ? (
              <View style={styles.puces}>
                <View style={[styles.puce, { borderColor: couleur }]}>
                  <View style={[styles.point, { backgroundColor: couleur }]} />
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{MOT[niveau]}</Text>
                </View>
                {vue?.ecart ? (
                  // L'écart prend la couleur du niveau : « Stress +8 » est rouge (monter est mauvais), « HRV +8 » serait vert
                  <View style={[styles.puce, { borderColor: /^[+−]\d/.test(vue.ecart) ? couleur : p.traitFort }]}>
                    <Text style={[typo.corps, { color: /^[+−]\d/.test(vue.ecart) ? couleur : p.texteDoux }]}>{vue.ecart}</Text>
                  </View>
                ) : null}
                {SENS_INVERSE.has(cleValide) ? (
                  <View style={[styles.puce, { borderColor: p.traitFort }]}>
                    <Text style={[typo.corps, { color: p.texteDoux }]}>plus bas = mieux</Text>
                  </View>
                ) : null}
                {estPilier(cleValide) ? (
                  <View accessible accessibilityLabel={`Compte pour ${Math.round(POIDS_FORME[cleValide] * 100)} % de ton état de forme`} style={[styles.puce, { borderColor: p.traitFort }]}>
                    <Text style={[typo.corps, { color: p.texteDoux }]}>{Math.round(POIDS_FORME[cleValide] * 100)} % de l'état</Text>
                  </View>
                ) : (
                  <View accessible accessibilityLabel="Surveillé : ne change pas le chiffre de l'état de forme, signale seulement un écart marqué" style={[styles.puce, { borderColor: vue?.alerte ? p.danger : p.traitFort }]}>
                    <Text style={[typo.corps, { color: vue?.alerte ? p.danger : p.texteDoux }]}>{vue?.alerte ? '! alerte · hors score' : 'surveillé · hors score'}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>{vue?.manquant ?? 'Pas encore de donnée pour ce sujet.'}</Text>
            )}
          </View>

          <Bloc>
            <View style={styles.periodes} accessibilityRole="tablist">
              {PERIODES.map((n) => (
                <Pressable key={n} onPress={() => setPeriode(n)} accessibilityRole="tab" accessibilityState={{ selected: n === periode }} accessibilityLabel={`${n} valeurs`} style={[styles.periode, { backgroundColor: n === periode ? p.surface2 : 'transparent', borderColor: n === periode ? p.traitFort : 'transparent' }]}>
                  <Text style={[typo.corpsFort, { color: n === periode ? p.texte : p.texteDoux }]}>{n} j</Text>
                </Pressable>
              ))}
            </View>
            {recent.length > 1 ? (
              <>
                <CourbeLissee valeurs={recent} couleur={p.texte} hauteur={100} etiquette={`${NOM_COMPOSANTE[cleValide]} sur ${recent.length} valeurs`} />
                {moyenne != null ? (
                  <Text accessibilityLabel={`Ta moyenne sur les ${reference.length} valeurs précédentes : ${texteValeur(cleValide, moyenne)} ${vue?.unite ?? ''}`} style={[typo.micro, { color: p.texteMuet, marginTop: 8 }]}>
                    ta moyenne · {texteValeur(cleValide, moyenne)} {vue?.unite ?? ''}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[typo.petit, { color: p.texteMuet }]}>—</Text>
            )}
          </Bloc>

          <Pressable onPress={() => setLecture((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: lecture }} accessibilityLabel="Comment lire ça" style={[styles.rangee, { backgroundColor: p.surface }]}>
            <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>Comment lire ça</Text>
            <View style={[styles.fleche, { borderColor: p.texteDoux, transform: [{ rotate: lecture ? '-45deg' : '135deg' }] }]} />
          </Pressable>
          {lecture ? (
            <Bloc>
              <Text style={[typo.corps, { color: p.texte }]}>{infos.veutDire}</Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>{infos.lecture}</Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>{infos.source}</Text>
              <Text style={[typo.petit, { color: p.texteMuet, marginTop: 8 }]}>Estimation à partir de tes chiffres : ce n'est pas un avis médical.</Text>
            </Bloc>
          ) : null}
        </>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e3, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  hero: { alignItems: 'center', gap: 14, paddingVertical: espace.e2 },
  valeur: { fontFamily: police.titre800, fontSize: 44, lineHeight: 48, letterSpacing: -1, maxWidth: 130, textAlign: 'center' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  puce: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, borderWidth: 1, borderRadius: rayon.rond, paddingHorizontal: 14 },
  point: { width: 12, height: 12, borderRadius: 6 },
  periodes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periode: { minHeight: 40, minWidth: 64, borderWidth: 1, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  rangee: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: rayon.bloc, paddingHorizontal: 18 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2 },
});
