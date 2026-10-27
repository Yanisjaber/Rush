import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { CarteTrace } from '@/components/CarteTrace';
import { IconeSport } from '@/components/IconeSport';
import { ProfilAltitude } from '@/components/ProfilAltitude';
import { ProfilSeance } from '@/components/ProfilSeance';
import { StatCle } from '@/components/StatCle';
import { apercuDeGpx } from '@/data/apercu-import';
import { blocsDePrevue } from '@/data/ajouts';
import { nomDuType } from '@/data/catalogue-sports';
import { nomDuBloc } from '@/data/blocs-formulaire';
import { formatDateLongue } from '@/data/format';
import { chiffresPrevue } from '@/data/prevue-detail';
import { COULEURS_ZONE, indiceZone, milieu, NOM_TYPE, texteCible, texteDuree, tousSegments, type Bloc as BlocSeance } from '@/data/structure';
import { useAjouts } from '@/hooks/useAjouts';
import { usePrevue } from '@/hooks/usePrevue';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une séance prévue ou une compétition, en lecture : son nom, le jour et l'heure, ses chiffres, ses blocs avec leur profil, son parcours GPX (carte et altitude) et ses notes.
// Deux boutons fixés en bas : Modifier (ouvre le formulaire déjà rempli) et Supprimer (avec une confirmation). On y arrive depuis le détail d'un jour du calendrier.
export default function Prevue() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { prevue, chargement, erreur } = usePrevue(String(id ?? ''));
  const reference = useReferences();
  const { supprimerPrevue } = useAjouts();
  const [enCours, setEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');

  const blocs = useMemo(() => (prevue ? blocsDePrevue(prevue) : []), [prevue]);
  const parcours = useMemo(() => (prevue?.gpx_content ? apercuDeGpx(prevue.gpx_content) : null), [prevue?.gpx_content]);

  if (chargement) {
    return (
      <View accessible accessibilityLabel="Chargement de la séance" style={styles.centre}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (!prevue) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          {erreur || 'Séance introuvable.'}
        </Text>
      </View>
    );
  }

  const competition = prevue.category === 'competition';
  const couleur = couleurSport(p, prevue.sport);
  const nomSport = nomDuType(prevue.sport);
  const nom = (prevue.name ?? '').trim() || nomSport;
  const heure = /T(\d{2}:\d{2})/.exec(String(prevue.start_date_local ?? ''))?.[1];
  const nature = competition ? `Compétition${prevue.priority === 'A' || prevue.priority === 'B' ? ` · priorité ${prevue.priority}` : ''}` : 'Séance prévue';
  const chiffres = chiffresPrevue(prevue);
  const notes = (prevue.notes ?? '').trim();
  const dureeBloc = (b: BlocSeance) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);

  const modifier = () => router.push({ pathname: competition ? '/ajout-competition' : '/ajout-seance', params: { id: prevue.id } });
  const confirmerSuppression = () =>
    Alert.alert(competition ? 'Supprimer cette compétition ?' : 'Supprimer cette séance ?', 'Elle disparaîtra du calendrier. Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setEnCours(true);
            const e = await supprimerPrevue(prevue.id);
            setEnCours(false);
            if (e) return setErreurSuppression(e);
            router.back();
          })();
        },
      },
    ]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: competition ? 'Compétition' : 'Séance prévue' }} />
      <ScrollView contentContainerStyle={styles.contenu} contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.entete, { backgroundColor: p.surface, borderLeftColor: couleur }]}>
          <View style={styles.sport}>
            <IconeSport sport={prevue.sport} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>
              {nomSport} · {nature.toLowerCase()}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            {nom}
          </Text>
          <Text style={[typo.corps, { color: p.texteDoux }]}>
            {formatDateLongue(prevue.date)}
            {heure ? ` · ${heure}` : ''}
          </Text>
        </View>

        {chiffres.length ? (
          <Bloc titre={competition ? "L'épreuve" : 'Les chiffres'}>
            <View style={styles.grille}>
              {chiffres.map((c) => (
                <View key={c.cle} style={styles.case}>
                  <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} petit />
                </View>
              ))}
            </View>
          </Bloc>
        ) : null}

        {blocs.length ? (
          <>
            <Bloc titre="Profil">
              <ProfilSeance blocs={blocs} hauteur={56} />
            </Bloc>
            <Bloc titre={`Blocs (${blocs.length})`}>
              {blocs.map((b, i) => {
                const z = indiceZone(milieu(b.work), b.metric);
                return (
                  <View
                    key={i}
                    accessible
                    accessibilityLabel={`${nomDuBloc(b, NOM_TYPE)}, ${texteDuree(dureeBloc(b))}`}
                    style={[styles.ligneBloc, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={[styles.barreZone, { backgroundColor: COULEURS_ZONE[Math.min(z, COULEURS_ZONE.length - 1)] }]} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                        {b.type === 'interval' ? `${nomDuBloc(b, NOM_TYPE)} · ${b.reps} fois` : nomDuBloc(b, NOM_TYPE)}
                      </Text>
                      <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
                        {texteDuree(b.work.min)} {texteCible(b.work, b.metric, reference, prevue.sport)}
                        {b.type === 'interval' && b.rec ? ` · récup ${texteDuree(b.rec.min)}` : ''}
                      </Text>
                    </View>
                    <Text style={[typo.corpsFort, { color: p.texte }]}>{texteDuree(dureeBloc(b))}</Text>
                  </View>
                );
              })}
            </Bloc>
          </>
        ) : null}

        {prevue.gpx_content ? (
          <Bloc titre="Parcours">
            {parcours?.region && parcours.trace.length > 1 ? <CarteTrace trace={parcours.trace} region={parcours.region} couleur={couleur} hauteur={170} /> : null}
            {parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null ? (
              <ProfilAltitude profil={parcours.profil} min={parcours.altitudeMin} max={parcours.altitudeMax} km={prevue.km} couleur={couleur} hauteur={56} />
            ) : null}
            {prevue.gpx_name ? <Text style={[typo.petit, { color: p.texteDoux }]}>{prevue.gpx_name}</Text> : null}
          </Bloc>
        ) : null}

        {notes ? (
          <Bloc titre="Notes">
            <Text style={[typo.corps, { color: p.texte }]}>{notes}</Text>
          </Bloc>
        ) : null}

        {erreurSuppression ? (
          <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
            {erreurSuppression}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.bas, { backgroundColor: p.fond, borderTopColor: p.trait, paddingBottom: bas + espace.e3 }]}>
        <View style={{ flex: 1 }}>
          <Bouton onPress={modifier}>Modifier</Bouton>
        </View>
        <Pressable
          onPress={confirmerSuppression}
          disabled={enCours}
          accessibilityRole="button"
          accessibilityLabel={competition ? 'Supprimer la compétition' : 'Supprimer la séance'}
          style={({ pressed }) => [styles.supprimer, { borderColor: p.danger, opacity: pressed || enCours ? 0.6 : 1 }]}
        >
          <Text style={[typo.corpsFort, { color: p.danger }]}>{enCours ? 'Suppression…' : 'Supprimer'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  contenu: { padding: espace.e4, gap: espace.e3, paddingBottom: espace.e5 },
  entete: { borderRadius: rayon.bloc, borderLeftWidth: 6, padding: espace.e4, gap: 4 },
  sport: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e4 },
  case: { width: '50%', paddingRight: espace.e3 },
  ligneBloc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 },
  barreZone: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  bas: { flexDirection: 'row', gap: espace.e2, paddingHorizontal: espace.e4, paddingTop: espace.e3, borderTopWidth: 1 },
  supprimer: { flex: 1, minHeight: 44, borderRadius: rayon.base, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
