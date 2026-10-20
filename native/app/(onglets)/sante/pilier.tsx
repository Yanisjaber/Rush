import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { CourbeLissee } from '@/components/CourbeLissee';
import { NOM_COMPOSANTE, POIDS_FORME, niveauDe, serieEtatDeForme, type CleComposante, type Niveau } from '@/data/forme-sante';
import { construirePiliers, historiquePilier, texteValeur } from '@/data/piliers';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;
const NB_VALEURS = 60;
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
    lecture: "Comparé à TA moyenne : plus bas que d'habitude, tu as mieux récupéré ; plus haut, la nuit a été plus agitée.",
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
  const { nuits, chargement, actualisation, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, recharger: rechargerMesures } = useMesuresSante();
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const piliers = useMemo(() => construirePiliers(nuits, metriques, mesures, serie), [nuits, metriques, mesures, serie]);

  const cleValide = (Object.keys(POIDS_FORME) as CleComposante[]).find((c) => c === cle);
  const infos = cleValide ? INFOS[cleValide] : undefined;
  if (!cleValide || !infos) {
    return (
      <View style={[styles.page, { backgroundColor: p.fond }]}>
        <Text style={[typo.corps, { color: p.texteDoux, padding: espace.e4 }]}>Ce sujet n'existe pas.</Text>
      </View>
    );
  }

  const vue = piliers.find((x) => x.cle === cleValide);
  const histo = historiquePilier(cleValide, nuits, metriques, mesures);
  const recent = histo.slice(-NB_VALEURS);
  const reference = histo.slice(-29, -1);
  const moyenne = reference.length >= 10 ? reference.reduce((a, b) => a + b, 0) / reference.length : null;
  const niveau = niveauDe(vue?.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.texteMuet;

  return (
    <ScrollView
      style={{ backgroundColor: p.fond }}
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
          <Bloc titre={`${NOM_COMPOSANTE[cleValide]} aujourd'hui`}>
            {vue && vue.valeur !== '—' ? (
              <>
                <View style={styles.valeurLigne}>
                  <Text accessibilityLabel={`${vue.valeur} ${vue.unite}`} style={[styles.valeur, { color: p.texte }]}>
                    {vue.valeur}
                  </Text>
                  {vue.unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{vue.unite}</Text> : null}
                </View>
                {niveau ? (
                  <View style={styles.niveau}>
                    <View style={[styles.point, { backgroundColor: couleur }]} />
                    <Text style={[typo.corpsFort, { color: p.texte }]}>{MOT[niveau]}</Text>
                    {vue.ecart ? <Text style={[typo.corps, { color: p.texteDoux }]}> · {vue.ecart}</Text> : null}
                  </View>
                ) : null}
                <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>Compte pour {Math.round(POIDS_FORME[cleValide] * 100)} % de ton état de forme.</Text>
              </>
            ) : (
              <Text style={[typo.corps, { color: p.texteDoux }]}>{vue?.manquant ?? 'Pas encore de donnée pour ce sujet.'}</Text>
            )}
          </Bloc>

          <Bloc titre="Évolution">
            {recent.length > 1 ? (
              <>
                <CourbeLissee valeurs={recent} couleur={p.texte} hauteur={90} etiquette={`${NOM_COMPOSANTE[cleValide]} sur ${recent.length} valeurs`} />
                {moyenne != null ? (
                  <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                    Ta moyenne sur les {reference.length} valeurs précédentes : {texteValeur(cleValide, moyenne)} {vue?.unite ?? ''}.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore assez de valeurs pour tracer une courbe.</Text>
            )}
          </Bloc>

          <Bloc titre="Ce que ça veut dire">
            <Text style={[typo.corps, { color: p.texte }]}>{infos.veutDire}</Text>
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>{infos.lecture}</Text>
          </Bloc>

          <Bloc titre="D'où ça vient">
            <Text style={[typo.petit, { color: p.texteDoux }]}>{infos.source}</Text>
            <Text style={[typo.petit, { color: p.texteMuet, marginTop: 8 }]}>Estimation à partir de tes chiffres : ce n'est pas un avis médical.</Text>
          </Bloc>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e3, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valeur: { fontFamily: police.titre800, fontSize: 64, lineHeight: 68, letterSpacing: -1 },
  niveau: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  point: { width: 12, height: 12, borderRadius: 6 },
});
