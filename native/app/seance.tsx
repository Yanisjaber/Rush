import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GraphesSynchro } from '@/components/graphes/GraphesSynchro';
import { PageAnalyseSortie } from '@/components/graphes/PageAnalyseSortie';
import { PageDetailsSortie } from '@/components/graphes/PageDetailsSortie';
import { VueSortie } from '@/components/graphes/VueSortie';
import { ListeTours } from '@/components/ui/ListeTours';
import { PucesEcart } from '@/components/ui/PucesEcart';
import { StatCle } from '@/components/ui/StatCle';
import { sortieSupprimable } from '@/data/calendrier/ajouts';
import { analyserSortie } from '@/data/calendrier/analyse/constats';
import { flux1Hz } from '@/data/calendrier/analyse/flux';
import { typeDeSeance } from '@/data/calendrier/analyse/type-seance';
import { chiffreEcarte, pucesEcart } from '@/data/calendrier/donnees-ecartees';
import { chiffresSeance, lignesTours, troisChiffres } from '@/data/calendrier/seance-detail';
import { deriveCardiaque } from '@/data/outils/derive-cardiaque';
import { travailAuDessusFtp } from '@/data/outils/efforts-sortie';
import { formatDateCourte, formatKm } from '@/data/outils/format';
import { familleAffichage } from '@/data/sports/familles';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { GrapheTours } from '@/components/graphes/GrapheTours';
import { RecordsSortie } from '@/components/graphes/RecordsSortie';
import { RepartitionSortie } from '@/components/graphes/RepartitionSortie';
import { calculerZones, referenceCardio } from '@/data/reglages/profil';
import { repartitionsSortie } from '@/data/outils/repartition-zones';
import { useAjouts } from '@/hooks/useAjouts';
import { useHistoriqueSorties } from '@/hooks/useHistoriqueSorties';
import { usePrevueLiee } from '@/hooks/usePrevueLiee';
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
  const liee = usePrevueLiee(seance);
  const historique = useHistoriqueSorties(seance);
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
  const familleSortie = familleAffichage(seance.sport);
  const nomSport = nomDuType(seance.sport);
  // La dérive cardiaque se calcule sur les flux (elle n'est pas dans la base) : un chiffre de plus dans la rubrique Cœur, quand on a le cœur et assez de durée
  const derive = deriveCardiaque(courbes?.brut, familleAffichage(seance.sport) === 'velo' ? 'velo' : 'autre');
  const chiffresBase = chiffresSeance(seance);
  const m = seance.metrics ?? {};
  const mesure = (cle: string): number | null => (typeof m[cle] === 'number' && Number.isFinite(m[cle] as number) && (m[cle] as number) > 0 ? (m[cle] as number) : null);
  const aPuissance = chiffresBase.some((c) => c.cle === 'watts'); // une puissance mesurée (pas estimée) : sinon ni IF, ni efficacité
  const nP = Number(seance.np) > 0 ? Number(seance.np) : null;
  const fcMoy = Number(seance.avg_heartrate) > 0 ? Number(seance.avg_heartrate) : null;
  // L'IF et le travail au-dessus de la FTP se calculent avec ta FTP d'AUJOURD'HUI (celle du profil, sinon celle de la sortie) : les valeurs gardées dans la base datent de l'époque de la sortie
  const ftpActuelle = Number(profil?.ftp) > 0 ? Number(profil?.ftp) : Number(seance.ftp_at_time) > 0 ? Number(seance.ftp_at_time) : null;
  const travailFtp = ftpActuelle ? travailAuDessusFtp(courbes?.brut?.watts, courbes?.brut?.temps, ftpActuelle) : null;
  const pmax = mesure('pmax') ?? (Number(seance.max_watts) > 0 ? Number(seance.max_watts) : null);
  // Les chiffres en plus : lus dans `metrics` (calculés par le serveur sur les flux complets) ou déduits des colonnes de la séance
  const supplements: { cle: string; libelle: string; valeur: string; unite?: string }[] = [
    ...(derive ? [{ cle: 'derive', libelle: 'Dérive', valeur: `${derive.pct > 0 ? '+' : derive.pct < 0 ? '−' : ''}${formatKm(Math.abs(derive.pct), 1)}`, unite: '%' }] : []),
    ...(aPuissance && nP && ftpActuelle ? [{ cle: 'if', libelle: 'Intensité', valeur: String(Math.round((nP / ftpActuelle) * 100)), unite: '%' }] : []),
    ...(aPuissance && nP && fcMoy ? [{ cle: 'ef', libelle: 'Efficacité', valeur: formatKm(nP / fcMoy, 2) }] : []),
    ...(mesure('trimp') ? [{ cle: 'trimp', libelle: 'TRIMP', valeur: String(Math.round(mesure('trimp')!)) }] : []),
    ...(aPuissance && pmax ? [{ cle: 'pmax', libelle: 'Puissance max', valeur: String(Math.round(pmax)), unite: 'W' }] : []),
    // Les calories (en plus du travail en kJ) et les glucides estimés (CHO, calculés par le serveur depuis l'énergie fournie)
    ...(chiffresBase.some((c) => c.cle === 'energie' && c.unite === 'kJ') && Number(seance.calories) > 0 ? [{ cle: 'calories', libelle: 'Calories', valeur: String(Math.round(Number(seance.calories))), unite: 'kcal' }] : []),
    // Pas de CHO en course : la formule du serveur suppose 1 kJ de travail = 1 kcal (vrai à vélo) et surestime beaucoup en course, où la puissance est estimée
    ...(aPuissance && familleAffichage(seance.sport) === 'velo' && mesure('cho_g') ? [{ cle: 'cho', libelle: 'CHO estimé', valeur: String(Math.round(mesure('cho_g')!)), unite: 'g' }] : []),
    ...(aPuissance && travailFtp != null ? [{ cle: 'kjftp', libelle: 'Travail > FTP', valeur: formatKm(travailFtp, 1), unite: 'kJ' }] : []),
  ];
  const chiffres = [...chiffresBase, ...supplements];

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
  // Les bandes de zones derrière les courbes : début de Z2, Z3… (Z5a, Z5b et Z5c du cœur ne font qu'un Z5). Rien sans référence dans le profil.
  const ftpZones = Number(profil?.ftp) > 0 ? Number(profil?.ftp) : Number(seance.ftp_at_time) > 0 ? Number(seance.ftp_at_time) : null;
  const zonesPuissance = ftpZones ? calculerZones('puissance', ftpZones) : null;
  const seuilKmh = Number(extrasProfil.threshold_speed) || null;
  const zonesAllure = seuilKmh ? calculerZones('allure', seuilKmh) : null;
  const bandesZones = {
    ...(zonesCardio ? { fc: zonesCardio.slice(1, 5).map((z) => z.de) } : {}),
    ...(zonesPuissance ? { watts: zonesPuissance.slice(1, 6).map((z) => z.de) } : {}),
    // Allure : seulement en course ; les zones sont en km/h, la courbe en secondes par km
    ...(zonesAllure && familleAffichage(seance.sport) === 'course' ? { allure: zonesAllure.slice(1).map((z) => 3600 / z.de) } : {}),
  };
  const notes = (seance.user_notes ?? '').trim();
  // La page 4 (course et vélo) : l'analyse de la sortie, calculée par le code à partir des flux, du profil et de la séance prévue du même jour
  const familleCoach = familleSortie === 'course' || familleSortie === 'velo' ? familleSortie : null;
  const seuilKmhAnalyse = Number(extrasProfil.threshold_speed) > 0 ? Number(extrasProfil.threshold_speed) : null;
  const analyse =
    familleCoach && liee.chargee
      ? analyserSortie({
          famille: familleCoach,
          type: typeDeSeance(seance.name, seance.moving_time ?? null),
          flux: flux1Hz(courbes?.brut),
          dureeS: seance.moving_time ?? null,
          distanceKm: seance.distance_km ?? null,
          deniveleM: seance.total_elevation_gain ?? null,
          derivePct: derive ? derive.pct : null,
          zonesCardio: zonesCardio ? zonesCardio.map((z) => z.de) : null,
          zonesEstimees: !!refCardio?.estimee,
          hrMaxProfil: Number(profil?.hr_max) > 0 ? Number(profil?.hr_max) : null,
          wattsMesures: seance.device_watts ?? null,
          tss: seance.tss ?? null,
          prevue: liee.prevue,
          courante: { id: seance.id, sport: seance.sport, date: String(seance.start_date_local), coeurMoyen: seance.avg_heartrate ?? null },
          historique,
          refs: { ftp: Number(profil?.ftp) > 0 ? Number(profil?.ftp) : null, hrMax: Number(profil?.hr_max) > 0 ? Number(profil?.hr_max) : null, allureBase: seuilKmhAnalyse ? 3600 / seuilKmhAnalyse : null },
        })
      : null;
  const avecPageCoach = !!analyse && analyse.lignes.length > 0;
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
        tours={
          <View style={{ gap: espace.e2 }}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>TOURS</Text>
            {tours ? <GrapheTours tours={tours} sport={seance.sport} couleur={couleur} altitude={courbes?.altitude ?? null} /> : null}
            <ListeTours lignes={lignes} chargement={chargementTours} erreur={erreurTours} />
          </View>
        }
        repartitions={mesuresZones.length ? <RepartitionSortie mesures={mesuresZones} couleur={couleur} /> : undefined}
        graphesHaut={courbes ? (hauteur, onGlisse) => <GraphesSynchro courbes={courbes} km={seance.distance_km ?? null} rythme={familleAffichage(seance.sport) === 'velo' ? 'vitesse' : 'allure'} couleur={couleur} dureeS={seance.moving_time ?? null} hauteur={hauteur} bandes={bandesZones} onGlisse={onGlisse} /> : undefined}
        pageCoach={avecPageCoach && analyse ? <PageAnalyseSortie couleur={couleur} analyse={analyse} nomPlan={liee.prevue ? liee.prevue.name || 'séance du calendrier' : null} /> : undefined}
        pageDetails={(onGlisse) => (
          <PageDetailsSortie
            chiffres={chiffres}
            ecarte={(cle) => chiffreEcarte(seance, cle)}
            altitude={trace && trace.altitudeMin != null && trace.altitudeMax != null ? { min: trace.altitudeMin, max: trace.altitudeMax } : null}
            couleur={couleur}
            records={familleSortie === 'course' || familleSortie === 'velo' ? <RecordsSortie brut={courbes?.brut} famille={familleSortie} iso={String(seance.start_date_local).slice(0, 10)} couleur={couleur} /> : undefined}
          >
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
