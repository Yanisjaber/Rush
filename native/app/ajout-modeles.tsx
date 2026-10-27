import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { PastillesChoix } from '@/components/ChampsFeuille';
import { ChampTexte } from '@/components/ChampTexte';
import { ProfilSeance } from '@/components/ProfilSeance';
import { ChampDate } from '@/components/ChampDate';
import { blocsDuModele, cleDuModele, filtrerModeles, lignePrevueDepuisModele, resumeModele, sportsDesModeles, type Modele } from '@/data/modeles';
import { COULEURS_ZONE, indiceZone, milieu, NOM_TYPE, texteCible, texteDuree } from '@/data/structure';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useModeles } from '@/hooks/useModeles';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Poser un modèle de séance sur un jour : la liste de tes modèles (recherche, filtre par sport), avec un petit profil. On touche un modèle pour voir ses blocs,
// puis « Poser sur ce jour » l'ajoute aux séances prévues.
export default function EcranAjoutModeles() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const { modeles, chargement, erreur: erreurChargement } = useModeles();
  const { creerPrevue } = useAjouts();
  const ref = useReferences();
  const [date, setDate] = useState(useDateAjout());
  const [recherche, setRecherche] = useState('');
  const [sport, setSport] = useState('tous');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const liste = useMemo(() => filtrerModeles(modeles, recherche, sport), [modeles, recherche, sport]);
  const sports = useMemo(() => sportsDesModeles(modeles), [modeles]);

  async function poser(m: Modele) {
    if (enCours) return; // un second appui pendant l'ajout ne crée pas de doublon
    setErreur('');
    setEnCours(true);
    const e = await creerPrevue(lignePrevueDepuisModele(m, date, '12:00', ref));
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  const jourCourt = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e6 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <ChampDate etiquette="Poser le modèle le" date={date} onChange={setDate} />
      <ChampTexte value={recherche} onChangeText={setRecherche} placeholder="Chercher un modèle…" autoCorrect={false} returnKeyType="search" accessibilityLabel="Chercher un modèle" />
      {sports.length > 1 ? (
        <PastillesChoix
          valeurs={[{ cle: 'tous', nom: 'Tous' }, ...sports.map((cle) => ({ cle, nom: SPORTS[cle as CleSport].court }))]}
          actuel={sport}
          onChoisir={setSport}
          etiquette="Filtrer par sport"
        />
      ) : null}
      {chargement ? <ActivityIndicator color={p.texteDoux} /> : null}
      {erreurChargement ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreurChargement}
        </Text>
      ) : null}
      {!chargement && !erreurChargement && !modeles.length ? (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Tu n'as pas encore de modèle. Tu peux en créer depuis le site, ils apparaîtront ici.</Text>
      ) : null}
      {!chargement && modeles.length && !liste.length ? <Text style={[typo.corps, { color: p.texteDoux }]}>Aucun modèle ne correspond.</Text> : null}
      <View style={{ gap: espace.e2 }}>
        {liste.map((m) => {
          const blocs = blocsDuModele(m);
          const cle = cleDuModele(m);
          const actif = ouvert === m.id;
          return (
            <View key={m.id} style={[styles.carte, { backgroundColor: p.surface }]}>
              <Pressable
                onPress={() => setOuvert(actif ? null : m.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: actif }}
                accessibilityLabel={`${m.name}, ${resumeModele(m)}`}
                style={styles.ligne}
              >
                {blocs.length ? <ProfilSeance blocs={blocs} hauteur={34} largeur={64} /> : <View style={[styles.point, { backgroundColor: couleurSport(p, cle) }]} />}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                    {m.name}
                  </Text>
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
                    {resumeModele(m)}
                  </Text>
                </View>
                <Text style={{ color: p.texteDoux, fontSize: 18 }}>{actif ? '⌃' : '⌄'}</Text>
              </Pressable>
              {actif ? (
                <View style={{ gap: espace.e2 }}>
                  {m.description ? <Text style={[typo.petit, { color: p.texteDoux }]}>{m.description}</Text> : null}
                  {blocs.map((b, i) => {
                    const z = indiceZone(milieu(b.work), b.metric);
                    return (
                      <View key={i} style={styles.bloc}>
                        <View style={[styles.barreZone, { backgroundColor: COULEURS_ZONE[Math.min(z, COULEURS_ZONE.length - 1)] }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[typo.corpsFort, { color: p.texte }]}>{b.type === 'interval' ? `${b.name || NOM_TYPE.interval} · ${b.reps} fois` : b.name || NOM_TYPE[b.type]}</Text>
                          <Text style={[typo.petit, { color: p.texteDoux }]}>
                            {texteDuree(b.work.min)} {texteCible(b.work, b.metric, ref, m.sport_raw ?? 'Ride')}
                            {b.type === 'interval' && b.rec ? ` · récup ${texteDuree(b.rec.min)}` : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {erreur ? (
                    <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                      {erreur}
                    </Text>
                  ) : null}
                  <Bouton disabled={enCours} onPress={() => void poser(m)}>{enCours ? 'Ajout…' : `Poser sur ${jourCourt}`}</Bouton>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, gap: espace.e4 },
  carte: { borderRadius: rayon.bloc, padding: espace.e3, gap: espace.e3 },
  ligne: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: espace.e3 },
  point: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 25 },
  bloc: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barreZone: { width: 5, alignSelf: 'stretch', minHeight: 34, borderRadius: 3 },
});
