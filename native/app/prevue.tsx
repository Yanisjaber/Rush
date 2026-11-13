import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { VueSortie } from '@/components/graphes/VueSortie';
import { ProfilSeance } from '@/components/graphes/ProfilSeance';
import { GrapheSeancePrevue } from '@/components/graphes/GrapheSeancePrevue';
import { TempsParZone } from '@/components/graphes/TempsParZone';
import { minutesParZone } from '@/data/calendrier/graphe-prevue';
import { StatCle } from '@/components/ui/StatCle';
import { apercuDeGpx } from '@/data/calendrier/apercu-import';
import { blocsDePrevue } from '@/data/calendrier/ajouts';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { nomDuBloc } from '@/data/calendrier/blocs-formulaire';
import { dateIsoLocale, formatDateCourte } from '@/data/outils/format';
import { chiffresPrevue, completerAvecStructure } from '@/data/calendrier/prevue-detail';
import { choisirChiffres, ordrePrevue } from '@/data/calendrier/quatre-chiffres';
import { TuileChiffre } from '@/components/ui/TuileChiffre';
import { COULEURS_ZONE, estimationDeBlocs, indiceZone, milieu, NOM_TYPE, resume, texteCible, texteDuree, tousSegments, type Bloc as BlocSeance } from '@/data/calendrier/structure';
import { usePrevue } from '@/hooks/usePrevue';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une séance prévue ou une compétition, en lecture, avec le même modèle que la sortie réalisée (VueSortie) : page 1 = le graphique des blocs, ou le dessin du sport en fond sans bloc
// ; page 2 = le temps par zone, tous les chiffres et les notes ; page 3 = la carte du GPX et son profil (s'il y en a un) ;
// Le crayon du haut ouvre le formulaire (modifier, supprimer). On y arrive depuis le détail d'un jour du calendrier.
// Les dix tuiles de la page 2, toujours là dans cet ordre (un « - » quand la séance n'a pas la donnée) ; les autres chiffres (puissance, cardio, énergie…) suivent, seulement s'ils existent
const TUILES_FIXES = ['duree', 'distance', 'allure', 'dplus', 'charge', 'effort', 'if', 'kcal', 'glucides', 'hydratation'];
const LIBELLE_FIXE: Record<string, string> = { duree: 'Durée', distance: 'Distance', allure: 'Allure', charge: 'Charge', effort: 'Effort', if: 'Intensité', kcal: 'Calories', glucides: 'Glucides', hydratation: 'Hydratation', dplus: 'D+' };

// Le libellé d'une tuile : « Allure prévue » → « Allure », « Vitesse prévue » → « Vitesse »…
const libelleTuile = (l: string): string =>
  l.replace(/^Allure (cible|prévue)$/, 'Allure').replace(/^Vitesse (moy\.|prévue|cible)$/, 'Vitesse').replace('Dénivelé +', 'D+').replace('Temps cible', 'Objectif').replace('Charge estimée', 'Charge').replace('Effort estimé', 'Effort');

// Les tuiles de la page 2 : pour une séance, une ligne de 4 puis des lignes de 3 (10 tuiles = 4, 3, 3, aucune seule) ; pour une compétition, des lignes de 3
function rangeesDeTuiles<T>(liste: T[], premiereDe4: boolean): { taille: number; tuiles: T[] }[] {
  const sortie: { taille: number; tuiles: T[] }[] = [];
  let i = 0;
  while (i < liste.length) {
    const taille = i === 0 && premiereDe4 ? 4 : 3;
    sortie.push({ taille, tuiles: liste.slice(i, i + taille) });
    i += taille;
  }
  return sortie;
}

export default function Prevue() {
  const p = usePalette();
  const router = useRouter();
  const { id, competition: estCompetition } = useLocalSearchParams<{ id: string; competition?: string }>();
  const { prevue, chargement, erreur } = usePrevue(String(id ?? ''));
  const reference = useReferences();
  // Le titre de l'en-tête est juste dès l'ouverture (l'écran qui nous ouvre sait si c'est une compétition), pas seulement une fois la ligne chargée
  const titreEntete = (prevue ? prevue.category === 'competition' : estCompetition === '1') ? 'Compétition' : 'Séance prévue';

  const blocs = useMemo(() => (prevue ? blocsDePrevue(prevue) : []), [prevue]);
  const parcours = useMemo(() => (prevue?.gpx_content ? apercuDeGpx(prevue.gpx_content) : null), [prevue?.gpx_content]);

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
  // Une allure cible et une durée donnent une distance (et des watts, un cardio, une énergie) : ce que la séance n'a pas enregistré se calcule depuis ses blocs
  const chiffres = chiffresPrevue(completerAvecStructure(prevue, blocs.length ? resume(blocs, reference, prevue.sport) : null), estimationDeBlocs(blocs, reference, prevue.sport), reference);
  const notes = (prevue.notes ?? '').trim();
  const dureeBloc = (b: BlocSeance) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);
  // « J−25 » à côté de la date d'une compétition à venir ; « Aujourd'hui » le jour même
  const jours = Math.round((Date.parse(`${prevue.date}T00:00:00Z`) - Date.parse(`${dateIsoLocale(new Date())}T00:00:00Z`)) / 86_400_000);
  const decompte = competition && Number.isFinite(jours) && jours >= 0 ? (jours === 0 ? "AUJOURD'HUI" : `J−${jours}`) : '';
  const date = `${formatDateCourte(prevue.date).replace(/\./g, '')}${heure ? ` · ${heure}` : ''}${decompte ? ` · ${decompte}` : ''}`.toUpperCase();

  const modifier = () => router.push({ pathname: competition ? '/ajout-competition' : '/ajout-seance', params: { id: prevue.id } });

  // Page 1 : la carte et le profil d'altitude du GPX ; sans GPX, le dessin du sport en fond et, sous les chiffres, le profil des blocs (s'il y en a)
  const { ordre, repli } = ordrePrevue(competition);
  const quatre = choisirChiffres(chiffres, ordre, repli);
  // Sans parcours, mais avec des blocs : le graphique de la séance (axes, cible de chaque bloc) et le tableau de ses intervalles sont le héros de la page 1, à la place de la silhouette du sport
  // Le parcours GPX a toujours sa page (la 3, carte et profil d'altitude) ; la page 1 montre le graphique des blocs, ou la silhouette du sport sans bloc
  const profilEnGrand = blocs.length > 0;
  const minutes = minutesParZone(blocs, reference, prevue.sport);
  // La page 2 : les dix tuiles fixes (une ligne de 4, deux de 3, vide = « - »), puis les autres chiffres éventuels de la compétition
  const tuilesPage2 = competition ? chiffres : [
    ...TUILES_FIXES.map((cle) => chiffres.find((c) => c.cle === cle) ?? { cle, libelle: cle === 'allure' && !['Run', 'TrailRun', 'Walk', 'Hike', 'Swim'].includes(prevue.sport) ? 'Vitesse' : LIBELLE_FIXE[cle], valeur: '-', unite: undefined }),
  ];
  const autres = tuilesPage2;

  return (
    <View style={styles.page}>
      {/* Retour par balayage depuis le bord gauche seulement : glisser sur la courbe du profil ne ferme pas l'écran */}
      <Stack.Screen options={{ title: titreEntete, headerShown: false, fullScreenGestureEnabled: false }} />
      <VueSortie
        parcours={null}
        carteEnPage={parcours ? { ...parcours } : null}
        km={prevue.km ?? null}
        couleur={couleur}
        sport={prevue.sport}
        titre={nom}
        nomSport={`${nomSport} · ${competition ? 'compétition' : 'prévue'}`}
        date={date}
        onModifier={modifier}
        heros={profilEnGrand ? <GrapheSeancePrevue blocs={blocs} couleur={couleur} reference={reference} sport={prevue.sport} /> : undefined}
        avecPageCourbes={false}
        chiffres={
          <>
            {quatre.length ? (
              <View style={styles.tuiles}>
                {quatre.map((c) => (
                  <TuileChiffre key={c.cle} etiquette={libelleTuile(c.libelle)} valeur={c.valeur} unite={c.unite} />
                ))}
              </View>
            ) : null}
          </>
        }
        pageDetails={() => (
          <>
            <TempsParZone minutes={minutes} />
            {autres.length ? (
              <View style={{ gap: espace.e2 }}>
                {rangeesDeTuiles(tuilesPage2, !competition).map((rangee, r) => (
                  <View key={r} style={styles.tuiles}>
                    {Array.from({ length: rangee.taille }, (_, k) => {
                      const c = rangee.tuiles[k];
                      return c ? <TuileChiffre key={c.cle} etiquette={libelleTuile(c.libelle)} valeur={c.valeur} unite={c.unite} /> : <View key={k} style={{ flex: 1 }} />;
                    })}
                  </View>
                ))}
              </View>
            ) : null}
            {notes ? (
              <View style={[styles.notes, { backgroundColor: p.surface }]}>
                <Text style={[typo.micro, { color: p.texteDoux }]}>NOTES</Text>
                <Text style={[typo.corps, { color: p.texte }]}>{notes}</Text>
              </View>
            ) : null}
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
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e4, borderRadius: rayon.base, padding: espace.e3 },
  case: { width: '50%', paddingRight: espace.e3 },
  blocs: { borderRadius: rayon.base, padding: espace.e3, gap: espace.e2 },
  notes: { borderRadius: rayon.base, padding: espace.e3, gap: 4 },
  ligneBloc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 },
  barreZone: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
});
