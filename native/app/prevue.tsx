import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/ui/Bouton';
import { VueSortie } from '@/components/graphes/VueSortie';
import { ProfilSeance } from '@/components/graphes/ProfilSeance';
import { StatCle } from '@/components/ui/StatCle';
import { apercuDeGpx } from '@/data/calendrier/apercu-import';
import { blocsDePrevue } from '@/data/calendrier/ajouts';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { nomDuBloc } from '@/data/calendrier/blocs-formulaire';
import { dateIsoLocale, formatDateCourte } from '@/data/outils/format';
import { chiffresPrevue } from '@/data/calendrier/prevue-detail';
import { COULEURS_ZONE, indiceZone, milieu, NOM_TYPE, texteCible, texteDuree, tousSegments, type Bloc as BlocSeance } from '@/data/calendrier/structure';
import { useAjouts } from '@/hooks/useAjouts';
import { usePrevue } from '@/hooks/usePrevue';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une séance prévue ou une compétition, en lecture, avec le même modèle que la sortie réalisée (VueSortie) : page 1 = la carte et le profil du GPX, ou, sans GPX, le dessin du sport en fond
// et le profil des blocs sous les chiffres ; page 2 = tous les chiffres et les blocs ; page « Notes » (seulement s'il y a des notes) = notes, Modifier et Supprimer.
// Sans note, Modifier et Supprimer finissent la page 2. Le crayon du haut ouvre aussi le formulaire. On y arrive depuis le détail d'un jour du calendrier.
export default function Prevue() {
  const p = usePalette();
  const router = useRouter();
  const { id, competition: estCompetition } = useLocalSearchParams<{ id: string; competition?: string }>();
  const { prevue, chargement, erreur } = usePrevue(String(id ?? ''));
  const reference = useReferences();
  const { supprimerPrevue } = useAjouts();
  const [enCours, setEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');
  const [supprimee, setSupprimee] = useState(false); // la suppression a réussi : on laisse l'écran vide le temps du retour (sinon « Séance introuvable » clignote)
  // Le titre de l'en-tête est juste dès l'ouverture (l'écran qui nous ouvre sait si c'est une compétition), pas seulement une fois la ligne chargée
  const titreEntete = (prevue ? prevue.category === 'competition' : estCompetition === '1') ? 'Compétition' : 'Séance prévue';

  const blocs = useMemo(() => (prevue ? blocsDePrevue(prevue) : []), [prevue]);
  const parcours = useMemo(() => (prevue?.gpx_content ? apercuDeGpx(prevue.gpx_content) : null), [prevue?.gpx_content]);

  if (supprimee) return <Stack.Screen options={{ title: titreEntete }} />;
  if (chargement) {
    return (
      <View accessible accessibilityLabel="Chargement de la séance" style={styles.centre}>
        <Stack.Screen options={{ title: titreEntete }} />
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (!prevue) {
    return (
      <View style={styles.centre}>
        <Stack.Screen options={{ title: titreEntete }} />
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
  const heureLue = /T(\d{2}:\d{2})/.exec(String(prevue.start_date_local ?? ''))?.[1];
  const heure = heureLue && heureLue !== '00:00' ? heureLue : undefined; // minuit = saisie sans heure (comme dans le calendrier)
  const chiffres = chiffresPrevue(prevue);
  const notes = (prevue.notes ?? '').trim();
  const dureeBloc = (b: BlocSeance) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);
  // « J−25 » à côté de la date d'une compétition à venir ; « Aujourd'hui » le jour même
  const jours = Math.round((Date.parse(`${prevue.date}T00:00:00Z`) - Date.parse(`${dateIsoLocale(new Date())}T00:00:00Z`)) / 86_400_000);
  const decompte = competition && Number.isFinite(jours) && jours >= 0 ? (jours === 0 ? "AUJOURD'HUI" : `J−${jours}`) : '';
  const date = `${formatDateCourte(prevue.date).replace(/\./g, '')}${heure ? ` · ${heure}` : ''}${decompte ? ` · ${decompte}` : ''}`.toUpperCase();

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
            setSupprimee(true);
            router.back();
          })();
        },
      },
    ]);

  // Page 1 : la carte et le profil d'altitude du GPX ; sans GPX, le dessin du sport en fond et, sous les chiffres, le profil des blocs (s'il y en a)
  const avecProfilGpx = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;
  const trois = chiffres.slice(0, 3);
  const actions = (
    <View style={{ gap: espace.e2 }}>
      {erreurSuppression ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreurSuppression}
        </Text>
      ) : null}
      <Bouton onPress={modifier}>Modifier</Bouton>
      <Pressable
        onPress={confirmerSuppression}
        disabled={enCours}
        accessibilityRole="button"
        accessibilityLabel={competition ? 'Supprimer la compétition' : 'Supprimer la séance'}
        style={({ pressed }) => [styles.supprimer, { opacity: pressed || enCours ? 0.6 : 1 }, { borderColor: p.danger }]}
      >
        <Text style={[typo.corpsFort, { color: p.danger }]}>{enCours ? 'Suppression…' : competition ? 'Supprimer cette compétition' : 'Supprimer cette séance'}</Text>
      </Pressable>
    </View>
  );
  // Les notes ont leur page ; sans note, les boutons Modifier et Supprimer finissent la page 2 (pas de page presque vide)
  const pageNotes = notes ? (
    <>
      <View style={[styles.notes, { backgroundColor: p.surface }]}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>NOTES</Text>
        <Text style={[typo.corps, { color: p.texte }]}>{notes}</Text>
      </View>
      {actions}
    </>
  ) : undefined;

  return (
    <View style={styles.page}>
      {/* Retour par balayage depuis le bord gauche seulement : glisser sur la courbe du profil ne ferme pas l'écran */}
      <Stack.Screen options={{ title: titreEntete, headerShown: false, fullScreenGestureEnabled: false }} />
      <VueSortie
        parcours={parcours ? { ...parcours } : null}
        km={prevue.km ?? null}
        couleur={couleur}
        sport={prevue.sport}
        titre={nom}
        nomSport={`${nomSport} · ${competition ? 'compétition' : 'prévue'}`}
        date={date}
        onModifier={modifier}
        avecPageCourbes={false}
        nomPageCoach="Notes"
        pageCoach={pageNotes}
        chiffres={
          <>
            {trois.length ? (
              <View style={styles.tuiles}>
                {trois.map((c) => (
                  <View key={c.cle} style={[styles.tuile, { backgroundColor: p.surface }]}>
                    <StatCle etiquette={c.libelle.replace(/^Allure (cible|prévue)$/, 'Allure')} valeur={c.valeur} unite={c.unite} petit />
                  </View>
                ))}
              </View>
            ) : null}
            {!avecProfilGpx && blocs.length ? <ProfilSeance blocs={blocs} hauteur={56} /> : null}
          </>
        }
        pageDetails={() => (
          <>
            {chiffres.length ? (
              <View style={[styles.grille, { backgroundColor: p.surface }]}>
                {chiffres.map((c) => (
                  <View key={c.cle} style={styles.case}>
                    <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} petit />
                  </View>
                ))}
              </View>
            ) : null}
            {blocs.length ? (
              <View style={[styles.blocs, { backgroundColor: p.surface }]}>
                <Text style={[typo.micro, { color: p.texteDoux }]}>{`BLOCS (${blocs.length})`}</Text>
                <ProfilSeance blocs={blocs} hauteur={56} />
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
              </View>
            ) : null}
            {!chiffres.length && !blocs.length ? <Text style={[typo.corps, { color: p.texteMuet }]}>Rien d'autre de renseigné sur cette séance.</Text> : null}
            {pageNotes ? null : actions}
          </>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  tuiles: { flexDirection: 'row', gap: espace.e2 },
  tuile: { flex: 1, borderRadius: rayon.base, padding: espace.e3 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e4, borderRadius: rayon.base, padding: espace.e3 },
  case: { width: '50%', paddingRight: espace.e3 },
  blocs: { borderRadius: rayon.base, padding: espace.e3, gap: espace.e2 },
  notes: { borderRadius: rayon.base, padding: espace.e3, gap: 4 },
  ligneBloc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 },
  barreZone: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  supprimer: { minHeight: 44, borderRadius: rayon.base, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
