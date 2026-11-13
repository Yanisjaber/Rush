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
import { COULEURS_ZONE, indiceZone, milieu, NOM_TYPE, resume, texteCible, texteDuree, tousSegments, type Bloc as BlocSeance } from '@/data/calendrier/structure';
import { usePrevue } from '@/hooks/usePrevue';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une séance prévue ou une compétition, en lecture, avec le même modèle que la sortie réalisée (VueSortie) : page 1 = la carte et le profil du GPX, ou, sans GPX, le dessin du sport en fond
// et le profil des blocs sous les chiffres ; page 2 = le temps par zone, tous les chiffres, les notes; page 3 = la carte du GPX s'il y a aussi des blocs ;
// Le crayon du haut ouvre le formulaire (modifier, supprimer). On y arrive depuis le détail d'un jour du calendrier.
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
  const chiffres = chiffresPrevue(completerAvecStructure(prevue, blocs.length ? resume(blocs, reference, prevue.sport) : null));
  const notes = (prevue.notes ?? '').trim();
  const dureeBloc = (b: BlocSeance) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);
  // « J−25 » à côté de la date d'une compétition à venir ; « Aujourd'hui » le jour même
  const jours = Math.round((Date.parse(`${prevue.date}T00:00:00Z`) - Date.parse(`${dateIsoLocale(new Date())}T00:00:00Z`)) / 86_400_000);
  const decompte = competition && Number.isFinite(jours) && jours >= 0 ? (jours === 0 ? "AUJOURD'HUI" : `J−${jours}`) : '';
  const date = `${formatDateCourte(prevue.date).replace(/\./g, '')}${heure ? ` · ${heure}` : ''}${decompte ? ` · ${decompte}` : ''}`.toUpperCase();

  const modifier = () => router.push({ pathname: competition ? '/ajout-competition' : '/ajout-seance', params: { id: prevue.id } });

  // Page 1 : la carte et le profil d'altitude du GPX ; sans GPX, le dessin du sport en fond et, sous les chiffres, le profil des blocs (s'il y en a)
  const avecProfilGpx = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;
  const { ordre, repli } = ordrePrevue(competition);
  const quatre = choisirChiffres(chiffres, ordre, repli);
  // Sans parcours, mais avec des blocs : le graphique de la séance (axes, cible de chaque bloc) et le tableau de ses intervalles sont le héros de la page 1, à la place de la silhouette du sport
  // Avec des blocs, le graphique est toujours le héros de la page 1 ; le parcours GPX a alors sa page (la 3)
  const profilEnGrand = blocs.length > 0;
  const carteEnPage = !!parcours && profilEnGrand;
  const minutes = minutesParZone(blocs, reference, prevue.sport);
  const autres = chiffres; // la page 2 reprend tous les chiffres, ceux de la page 1 compris

  return (
    <View style={styles.page}>
      {/* Retour par balayage depuis le bord gauche seulement : glisser sur la courbe du profil ne ferme pas l'écran */}
      <Stack.Screen options={{ title: titreEntete, headerShown: false, fullScreenGestureEnabled: false }} />
      <VueSortie
        parcours={parcours && !carteEnPage ? { ...parcours } : null}
        carteEnPage={carteEnPage && parcours ? { ...parcours } : null}
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
                  <TuileChiffre key={c.cle} etiquette={c.libelle.replace(/^Allure (cible|prévue)$/, 'Allure').replace('Dénivelé +', 'D+').replace('Temps cible', 'Objectif').replace('Charge estimée', 'Charge').replace('Effort estimé', 'Effort')} valeur={c.valeur} unite={c.unite} />
                ))}
              </View>
            ) : null}
            {!avecProfilGpx && !profilEnGrand && blocs.length ? <ProfilSeance blocs={blocs} hauteur={56} /> : null}
          </>
        }
        pageDetails={() => (
          <>
            <TempsParZone minutes={minutes} />
            {autres.length ? (
              <View style={{ gap: espace.e2 }}>
                {Array.from({ length: Math.ceil(autres.length / 3) }, (_, r) => (
                  <View key={r} style={styles.tuiles}>
                    {[0, 1, 2].map((k) => {
                      const c = autres[r * 3 + k];
                      return c ? <TuileChiffre key={c.cle} etiquette={c.libelle.replace(/^Allure (cible|prévue)$/, 'Allure').replace('Dénivelé +', 'D+').replace('Temps cible', 'Objectif').replace('Charge estimée', 'Charge').replace('Effort estimé', 'Effort').replace(' estimé', '').replace(' estimée', '')} valeur={c.valeur} unite={c.unite} /> : <View key={k} style={{ flex: 1 }} />;
                    })}
                  </View>
                ))}
              </View>
            ) : null}
            {!autres.length && !minutes.length ? <Text style={[typo.corps, { color: p.texteMuet }]}>Rien d'autre de renseigné sur cette séance.</Text> : null}
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
