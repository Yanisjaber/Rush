import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { VueSortie } from '@/components/graphes/VueSortie';
import { ListeTours } from '@/components/ui/ListeTours';
import { PucesEcart } from '@/components/ui/PucesEcart';
import { StatCle } from '@/components/ui/StatCle';
import { sortieSupprimable } from '@/data/calendrier/ajouts';
import { chiffreEcarte, pucesEcart } from '@/data/calendrier/donnees-ecartees';
import { chiffresSeance, lignesTours, troisChiffres } from '@/data/calendrier/seance-detail';
import { formatDateCourte } from '@/data/outils/format';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { useAjouts } from '@/hooks/useAjouts';
import { useSeance } from '@/hooks/useSeance';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le détail d'une sortie réalisée (maquette « Pages qu'on balaie ») : la carte en plein fond (ou, sans GPS, un dossard), les trois chiffres clés, puis trois pages qu'on balaie
// dans la feuille : Profil d'altitude, Tours et Notes et données. On y arrive depuis le calendrier. Une activité saisie à la main peut être modifiée (crayon) et supprimée
// (en bas de la page Notes et données) ; celles de Strava appartiennent à Strava.
export default function Seance() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { seance, tours, trace, chargement, chargementTours, chargementTrace, erreur, erreurTours, basculerDonnee } = useSeance(String(id ?? ''));
  const [erreurEcart, setErreurEcart] = useState('');
  const { supprimerSortie } = useAjouts();
  const [enCours, setEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');
  const [supprimee, setSupprimee] = useState(false); // suppression réussie : écran vide le temps du retour (sinon « Séance introuvable » clignote)

  if (supprimee) return <View style={styles.centre} />;

  if (chargement) {
    return (
      <View accessible accessibilityLabel="Chargement de la séance" style={styles.centre}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (!seance) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          {erreur || 'Séance introuvable.'}
        </Text>
      </View>
    );
  }

  const couleur = couleurSport(p, seance.sport);
  const nomSport = nomDuType(seance.sport);
  const chiffres = chiffresSeance(seance);
  const cles = troisChiffres(chiffres);
  const lignes = tours ? lignesTours(tours, seance.sport) : [];
  const puces = pucesEcart(seance);
  const notes = (seance.user_notes ?? '').trim();
  const supprimable = sortieSupprimable(seance);
  const jour = String(seance.start_date_local).slice(0, 10);
  const heureLue = /T(\d{2}:\d{2})/.exec(String(seance.start_date_local ?? ''))?.[1];
  const date = `${formatDateCourte(jour).replace(/\./g, '')}${heureLue && heureLue !== '00:00' ? ` · ${heureLue}` : ''}`.toUpperCase();
  const principal = chiffres.find((c) => c.cle === 'distance') ?? chiffres.find((c) => c.cle === 'duree');

  const confirmerSuppression = () =>
    Alert.alert('Supprimer cette activité ?', 'Elle disparaîtra du calendrier et de tes totaux. Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setEnCours(true);
            const e = await supprimerSortie(seance.id);
            setEnCours(false);
            if (e) return setErreurSuppression(e);
            setSupprimee(true);
            router.back();
          })();
        },
      },
    ]);

  return (
    <View style={styles.page}>
      {/* Retour par balayage depuis le bord gauche seulement (pas plein écran) : glisser le doigt sur la courbe du profil ne ferme pas l'écran */}
      <Stack.Screen options={{ headerShown: false, fullScreenGestureEnabled: false }} />
      <VueSortie
        parcours={trace}
        chargementCarte={chargementTrace}
        km={seance.distance_km ?? null}
        couleur={couleur}
        sport={seance.sport}
        titre={seance.name || nomSport}
        date={`${nomSport} · ${date}`.toUpperCase()}
        hero={principal ? { etiquette: principal.libelle.toUpperCase(), valeur: principal.valeur, unite: principal.unite, detail: `${nomSport} · ${date}` } : null}
        onModifier={() => router.push({ pathname: '/ajout-sortie', params: { id: seance.id } })}
        chiffres={
          cles.length ? (
            <View style={styles.tuiles}>
              {cles.map((c) => (
                <View key={c.cle} style={[styles.tuile, { backgroundColor: p.surface }]}>
                  <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} petit ecarte={chiffreEcarte(seance, c.cle)} />
                </View>
              ))}
            </View>
          ) : null
        }
        pageTours={<ListeTours lignes={lignes} chargement={chargementTours} erreur={erreurTours} />}
        pageDonnees={
          <View style={{ gap: espace.e3 }}>
            {notes ? (
              <View style={[styles.notes, { backgroundColor: p.surface }]}>
                <Text style={[typo.micro, { color: p.texteDoux }]}>NOTES</Text>
                <Text style={[typo.corps, { color: p.texte }]}>{notes}</Text>
              </View>
            ) : (
              <Text style={[typo.corps, { color: p.texteMuet }]}>Pas de note sur cette sortie.</Text>
            )}
            {puces.length ? (
              <PucesEcart
                puces={puces}
                couleur={couleur}
                erreur={erreurEcart}
                onBasculer={(puce) => {
                  void (async () => setErreurEcart(await basculerDonnee(puce.colonne, !puce.ecartee)))();
                }}
              />
            ) : null}
            {supprimable ? (
              <View style={{ gap: espace.e2 }}>
                {erreurSuppression ? (
                  <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                    {erreurSuppression}
                  </Text>
                ) : null}
                <Pressable
                  onPress={confirmerSuppression}
                  disabled={enCours}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer l'activité"
                  style={({ pressed }) => [styles.supprimer, { borderColor: p.danger, opacity: pressed || enCours ? 0.6 : 1 }]}
                >
                  <Text style={[typo.corpsFort, { color: p.danger }]}>{enCours ? 'Suppression…' : 'Supprimer cette activité'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  tuiles: { flexDirection: 'row', gap: espace.e2 },
  tuile: { flex: 1, borderRadius: rayon.base, padding: espace.e3 },
  notes: { borderRadius: rayon.base, padding: espace.e3, gap: 4 },
  supprimer: { minHeight: 44, borderRadius: rayon.base, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
