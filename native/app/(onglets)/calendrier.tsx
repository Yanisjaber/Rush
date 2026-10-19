import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bientot } from '@/actions/bientot';
import { BarreSports } from '@/components/BarreSports';
import { BlocDate } from '@/components/BlocDate';
import { Bouton } from '@/components/Bouton';
import { decalerMois, grilleMois, jourAffiche, type JourGrille } from '@/data/calendrier';
import { couleurNote, libelleNote } from '@/data/annotations';
import { familleAffichage, garderSeance } from '@/data/familles';
import { formatDuree } from '@/data/format';
import { useDonneesCalendrier } from '@/hooks/useDonneesCalendrier';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const nomSport = (sport: string) => SPORTS[familleAffichage(sport) as CleSport]?.court ?? SPORTS.autre.court;
const BARRE_ONGLETS = 72;

// Le calendrier d'un mois, en liste (une ligne par jour) : comme ton site sur téléphone. Les jours vides sont masqués.
// Séance faite : aplat de la couleur du sport. Séance prévue : contour en pointillés. Compétition : petit dossard.
// Lecture seule pour l'instant : ajouter une séance, une note ou un repos arrive avec leurs panneaux.
export default function Calendrier() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre } = useMenu();
  const maintenant = useMemo(() => new Date(), []);
  const [cible, setCible] = useState({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() });
  const { donnees, chargement, erreur, actualisation, recharger } = useDonneesCalendrier(cible.annee, cible.mois);

  const grille = useMemo(() => {
    const garde = (x: { sport?: string; discipline?: string | null }) => garderSeance(x, filtre);
    return grilleMois(
      cible.annee,
      cible.mois,
      {
        seances: donnees.seances.filter(garde),
        planifiees: donnees.planifiees.filter(garde),
        objectifs: donnees.objectifs,
        notes: donnees.notes,
        repos: donnees.repos,
      },
      maintenant,
    );
  }, [cible, donnees, filtre, maintenant]);

  const seancesDuMois = grille.semaines.flat().filter((j) => j.dansMois).flatMap((j) => j.seances);
  const tempsDuMois = seancesDuMois.reduce((t, s) => t + (s.moving_time || 0), 0);
  const titre = grille.titre.charAt(0).toUpperCase() + grille.titre.slice(1);
  const semaines = grille.semaines.map((s) => s.filter(jourAffiche)).filter((s) => s.length);
  const estMoisCourant = cible.annee === maintenant.getFullYear() && cible.mois === maintenant.getMonth();

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <BarreSports />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        <View style={styles.navigation}>
          <Fleche sens={-1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, -1))} />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.titre2, styles.titreMois, { color: p.texte }]}>
            {titre}
          </Text>
          <Fleche sens={1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, 1))} />
        </View>
        <View style={styles.resume}>
          <Text style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>
            {seancesDuMois.length} séance{seancesDuMois.length > 1 ? 's' : ''} · {formatDuree(tempsDuMois)}
          </Text>
          {!estMoisCourant ? (
            <Bouton variante="discret" onPress={() => setCible({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })}>
              Aujourd'hui
            </Bouton>
          ) : null}
        </View>

        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        {chargement ? (
          <View accessible accessibilityLabel="Chargement du calendrier" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : semaines.length ? (
          semaines.map((jours, i) => (
            <View key={jours[0].iso} style={[styles.semaine, { backgroundColor: p.surface }, i === 0 && { marginTop: 0 }]}>
              {jours.map((j, k) => (
                <Jour key={j.iso} jour={j} premier={k === 0} />
              ))}
            </View>
          ))
        ) : (
          <Text style={[typo.corps, { color: p.texteDoux }]}>Rien ce mois-ci.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function Fleche({ sens, onPress }: { sens: -1 | 1; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sens < 0 ? 'Mois précédent' : 'Mois suivant'}
      hitSlop={4}
      style={({ pressed }) => [styles.fleche, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.chevron, { borderColor: p.texte, transform: [{ rotate: sens < 0 ? '-135deg' : '45deg' }] }]} />
    </Pressable>
  );
}

function Jour({ jour, premier }: { jour: JourGrille; premier: boolean }) {
  const p = usePalette();
  const label = [
    ...jour.objectifs.map((o) => `compétition : ${o.name}`),
    ...(jour.repos ? ['repos'] : []),
    ...jour.notes.map(libelleNote),
    ...jour.seances.map((s) => `${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`),
    ...jour.planifiees.map((x) => `séance prévue : ${x.name || nomSport(x.sport)}`),
  ].join(', ');

  return (
    <View
      accessible
      accessibilityLabel={`${jour.iso} ${label || 'rien'}`}
      style={[styles.jour, !premier && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, !jour.dansMois && { opacity: 0.7 }]}
    >
      <BlocDate iso={jour.iso} aujourdhui={jour.aujourdhui} />
      <View style={styles.contenuJour}>
        {jour.objectifs.map((o) => (
          <View key={o.id} style={[styles.objectif, { backgroundColor: p.dossardFond }]}>
            <Text numberOfLines={1} style={[styles.objectifTexte, { color: p.dossardTexte }]}>
              {o.name}
            </Text>
          </View>
        ))}
        {jour.repos ? (
          <View style={[styles.etiquette, { borderColor: p.traitFort, borderStyle: 'dashed', borderWidth: 1 }]}>
            <Text style={[typo.petit, { color: p.texteDoux }]}>Repos</Text>
          </View>
        ) : null}
        {jour.notes.map((n) => (
          <View key={n.id} style={[styles.note, { borderLeftColor: couleurNote(n.color), backgroundColor: p.surface2 }]}>
            <Text numberOfLines={2} style={[typo.petit, { color: p.texte }]}>
              {libelleNote(n)}
            </Text>
          </View>
        ))}
        <View style={styles.pastilles}>
          {jour.seances.slice(0, 3).map((s) => (
            <Pressable
              key={s.id}
              onPress={() => bientot('Le détail de la séance')}
              accessibilityRole="button"
              accessibilityLabel={`${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`}
              style={[styles.pastille, { backgroundColor: couleurSport(p, familleAffichage(s.sport)) }]}
            >
              <Text style={[typo.petit, styles.pastilleTexte, { color: p.encreSurCouleur }]}>
                {nomSport(s.sport)} · {formatDuree(s.moving_time)}
              </Text>
            </Pressable>
          ))}
          {jour.seances.length > 3 ? <Text style={[typo.petit, { color: p.texteDoux, alignSelf: 'center' }]}>+{jour.seances.length - 3}</Text> : null}
          {jour.planifiees.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => bientot('La modification de séance prévue')}
              accessibilityRole="button"
              accessibilityLabel={`Séance prévue : ${x.name || nomSport(x.sport)}`}
              style={[styles.pastille, { borderColor: couleurSport(p, familleAffichage(x.sport)), borderWidth: 2, borderStyle: 'dashed' }]}
            >
              <Text numberOfLines={1} style={[typo.petit, styles.pastilleTexte, { color: p.texte }]}>
                {x.name || nomSport(x.sport)}
                {x.duration ? ` · ${formatDuree(x.duration * 60)}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e3 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 12, height: 12, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  titreMois: { flex: 1, textAlign: 'center' },
  resume: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, minHeight: 44 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  semaine: { borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 4, marginTop: espace.e1 },
  jour: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  contenuJour: { flex: 1, gap: 6, minWidth: 0 },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastille: { minHeight: 36, borderRadius: rayon.base, paddingHorizontal: 10, justifyContent: 'center' },
  pastilleTexte: { fontFamily: police.texte600 },
  objectif: { borderRadius: rayon.base, paddingHorizontal: 10, paddingVertical: 6 },
  objectifTexte: { fontFamily: police.titre800, fontSize: 14, lineHeight: 18 },
  etiquette: { alignSelf: 'flex-start', borderRadius: rayon.base, paddingHorizontal: 10, paddingVertical: 6 },
  note: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 8 },
});
