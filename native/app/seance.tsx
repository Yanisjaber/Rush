import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GraphesSynchro } from '@/components/graphes/GraphesSynchro';
import { PageDetailsSortie } from '@/components/graphes/PageDetailsSortie';
import { VueSortie } from '@/components/graphes/VueSortie';
import { ListeTours } from '@/components/ui/ListeTours';
import { PucesEcart } from '@/components/ui/PucesEcart';
import { StatCle } from '@/components/ui/StatCle';
import { sortieSupprimable } from '@/data/calendrier/ajouts';
import { chiffreEcarte, pucesEcart } from '@/data/calendrier/donnees-ecartees';
import { chiffresSeance, lignesTours, troisChiffres } from '@/data/calendrier/seance-detail';
import { formatDateCourte } from '@/data/outils/format';
import { familleAffichage } from '@/data/sports/familles';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { RepartitionSortie } from '@/components/graphes/RepartitionSortie';
import { calculerZones, referenceCardio } from '@/data/reglages/profil';
import { repartitionsSortie } from '@/data/outils/repartition-zones';
import { useAjouts } from '@/hooks/useAjouts';
import { useProfilSection } from '@/hooks/useProfilSection';
import { useSeance } from '@/hooks/useSeance';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le détail d'une sortie réalisée (maquette « Pages qu'on balaie ») : la carte en plein fond (ou, sans GPS, un dossard), les trois chiffres clés, puis le profil d'altitude ; balayer vers la gauche ouvre la page 2 (toutes les infos, sans carte : rubriques, tours, notes et données). On y arrive depuis le calendrier. Une activité saisie à la main peut être modifiée (crayon) et supprimée
// (en bas de la page 2) ; celles de Strava appartiennent à Strava.
export default function Seance() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { seance, tours, trace, courbes, chargement, chargementTours, chargementTrace, erreur, erreurTours, basculerDonnee } = useSeance(String(id ?? ''));
  const { ligne: profil } = useProfilSection('physiologie');
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
  // Début des zones cardio Z3, Z4 et Z5a, recalculées depuis le profil (jamais stockées) : sans FC max ni seuil, pas de fond coloré
  const refCardio = referenceCardio(profil);
  const zonesCardio = refCardio ? calculerZones('cardio', refCardio.bpm) : null;
  // Le temps passé par zone (cœur, puissance, allure) : seulement avec les flux et la référence du profil (FTP de la sortie à défaut de celle du profil)
  const extrasProfil = (profil?.extras ?? {}) as Record<string, unknown>;
  const mesuresZones = repartitionsSortie(
    courbes?.brut,
    { lthr: refCardio, ftp: Number(profil?.ftp) > 0 ? Number(profil?.ftp) : seance.ftp_at_time, seuilKmh: Number(extrasProfil.threshold_speed) || null },
    familleAffichage(seance.sport) === 'course',
    seance.moving_time,
  );
  const seuilsCoeur: [number, number, number] | null = zonesCardio ? [zonesCardio[2].de, zonesCardio[3].de, zonesCardio[4].de] : null;
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
        nomSport={nomSport}
        date={date}
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
        repartitions={mesuresZones.length ? <RepartitionSortie mesures={mesuresZones} couleur={couleur} /> : undefined}
        graphesHaut={courbes ? (hauteur, onGlisse) => <GraphesSynchro courbes={courbes} km={seance.distance_km ?? null} rythme={familleAffichage(seance.sport) === 'velo' ? 'vitesse' : 'allure'} couleur={couleur} dureeS={seance.moving_time ?? null} hauteur={hauteur} seuilsCoeur={seuilsCoeur} onGlisse={onGlisse} /> : undefined}
        pageDetails={(onGlisse) => (
          <PageDetailsSortie
            chiffres={chiffres}
            ecarte={(cle) => chiffreEcarte(seance, cle)}
            altitude={trace && trace.altitudeMin != null && trace.altitudeMax != null ? { min: trace.altitudeMin, max: trace.altitudeMax } : null}
            couleur={couleur}
          >
            <Text style={[typo.micro, { color: p.texteDoux }]}>TOURS</Text>
            <ListeTours lignes={lignes} chargement={chargementTours} erreur={erreurTours} />
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
          </PageDetailsSortie>
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
  notes: { borderRadius: rayon.base, padding: espace.e3, gap: 4 },
  supprimer: { minHeight: 44, borderRadius: rayon.base, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
