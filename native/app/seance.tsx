import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { IconeSport } from '@/components/IconeSport';
import { StatCle } from '@/components/StatCle';
import { familleAffichage } from '@/data/familles';
import { formatDateLongue } from '@/data/format';
import { chiffresSeance, lignesTours } from '@/data/seance-detail';
import { useSeance } from '@/hooks/useSeance';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le détail d'une séance faite, en lecture : son nom, ses chiffres (selon le sport), ses notes et ses tours (laps) quand la montre en a marqué.
// On y arrive depuis le calendrier. Modifier une séance arrivera avec la saisie ; les tours serviront à détailler une séance Hyrox.
export default function Seance() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { seance, tours, chargement, chargementTours, erreur, erreurTours } = useSeance(String(id ?? ''));

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

  const famille = familleAffichage(seance.sport);
  const couleur = couleurSport(p, famille);
  const nomSport = SPORTS[famille as CleSport]?.nom ?? SPORTS.autre.nom;
  const chiffres = chiffresSeance(seance);
  const lignes = tours ? lignesTours(tours, seance.sport) : [];
  const notes = (seance.user_notes ?? '').trim();

  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e5 }]} contentInsetAdjustmentBehavior="automatic">
      <View style={[styles.entete, { backgroundColor: p.surface, borderLeftColor: couleur }]}>
        <View style={styles.sport}>
          <IconeSport sport={seance.sport} />
          <Text style={[typo.petit, { color: p.texteDoux }]}>{nomSport}</Text>
        </View>
        <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
          {seance.name || nomSport}
        </Text>
        <Text style={[typo.corps, { color: p.texteDoux }]}>{formatDateLongue(String(seance.start_date_local).slice(0, 10))}</Text>
      </View>

      {chiffres.length ? (
        <Bloc titre="Les chiffres">
          <View style={styles.grille}>
            {chiffres.map((c) => (
              <View key={c.cle} style={styles.case}>
                <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} note={c.note} petit />
              </View>
            ))}
          </View>
        </Bloc>
      ) : null}

      {notes ? (
        <Bloc titre="Notes">
          <Text style={[typo.corps, { color: p.texte }]}>{notes}</Text>
        </Bloc>
      ) : null}

      <Bloc titre={lignes.length ? `Tours (${lignes.length})` : 'Tours'}>
        {chargementTours ? (
          <View accessible accessibilityLabel="Chargement des tours" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Chargement des tours…</Text>
          </View>
        ) : erreurTours ? (
          <Text style={[typo.corps, { color: p.texteDoux }]}>{erreurTours}</Text>
        ) : lignes.length ? (
          lignes.map((l, i) => (
            <View
              key={l.cle}
              accessible
              accessibilityLabel={`Tour ${l.numero}${l.nom ? `, ${l.nom}` : ''}, ${l.duree}${l.distance ? `, ${l.distance}` : ''}${l.rythme ? `, ${l.rythme}` : ''}`}
              style={[styles.tour, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
            >
              <Text style={[typo.petit, styles.numero, { color: p.texteDoux }]}>{l.numero}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.duree, { color: p.texte }]}>{l.duree}</Text>
                {l.nom || l.distance ? (
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
                    {[l.nom, l.distance].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {l.rythme ? <Text style={[typo.corpsFort, { color: p.texte }]}>{l.rythme}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas de tour sur cette séance. Ils apparaissent quand ta montre en marque (bouton « lap »).</Text>
        )}
      </Bloc>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  contenu: { padding: espace.e4, gap: espace.e3 },
  entete: { borderRadius: rayon.bloc, borderLeftWidth: 6, padding: espace.e4, gap: 4 },
  sport: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e4 },
  case: { width: '50%', paddingRight: espace.e3 },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  tour: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, minHeight: 52, paddingVertical: 6 },
  numero: { width: 24, fontFamily: police.texte600, fontVariant: ['tabular-nums'] },
  duree: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
});
