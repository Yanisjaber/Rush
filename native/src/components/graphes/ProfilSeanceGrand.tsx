import { StyleSheet, Text, View } from 'react-native';
import { ProfilSeance } from '@/components/graphes/ProfilSeance';
import { COULEURS_ZONE, profilStructure, texteDuree, ZONES, type Bloc } from '@/data/calendrier/structure';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le profil d'intensité d'une séance prévue, EN GRAND : le héros de la première page quand la séance a des blocs et pas de parcours (maquette 2 du 14 nov.).
// Une barre par segment, plus large quand il est long, plus haute et plus chaude quand la zone est forte ; dessous, les zones qu'on y trouve (Z2 Endurance…) et la durée totale.
// Un bandeau à la couleur du sport en haut, comme les dossards.
export function ProfilSeanceGrand({ blocs, couleur }: { blocs: Bloc[]; couleur: string }) {
  const p = usePalette();
  const segments = profilStructure(blocs);
  if (!segments.length) return null;
  const total = segments.reduce((t, s) => t + s.min, 0);
  const metrique = blocs[0]?.metric ?? 'power';
  const presentes = [...new Set(segments.map((s) => s.zone))].sort((a, b) => a - b);
  const nomZone = (z: number): string => ZONES[metrique].noms[Math.min(z, ZONES[metrique].noms.length - 1)] ?? `Z${z + 1}`;
  const etiquette = `Profil de la séance, ${texteDuree(total)}. Zones : ${presentes.map(nomZone).join(', ')}.`;
  return (
    <View accessible accessibilityLabel={etiquette} style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View style={[styles.bandeau, { backgroundColor: couleur }]} />
      <ProfilSeance blocs={blocs} hauteur={150} />
      <View style={styles.legende}>
        {presentes.map((z) => (
          <View key={z} style={styles.zone}>
            <View style={[styles.carre, { backgroundColor: COULEURS_ZONE[Math.min(z, COULEURS_ZONE.length - 1)] }]} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>{nomZone(z)}</Text>
          </View>
        ))}
        <Text style={[typo.petit, { color: p.texte, marginLeft: 'auto' }]}>{texteDuree(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.bloc, borderWidth: 1, padding: espace.e4, paddingTop: espace.e4 + 4, gap: espace.e3, overflow: 'hidden' },
  bandeau: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  legende: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espace.e3, rowGap: espace.e1 },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
});
