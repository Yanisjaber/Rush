import { StyleSheet, View } from 'react-native';
import { COULEURS_ZONE, profilStructure, type Bloc } from '@/data/calendrier/structure';
import { rayon } from '@/theme/couleurs';

// Le profil d'une séance à blocs : une barre par segment (travail, récupération…), plus large quand le segment est long, plus haute et plus chaude quand la zone est forte.
// Purement décoratif : le texte des blocs dit la même chose, donc il est ignoré des lecteurs d'écran.
export function ProfilSeance({ blocs, hauteur = 34, largeur }: { blocs: Bloc[]; hauteur?: number; largeur?: number }) {
  const segments = profilStructure(blocs);
  if (!segments.length) return null;
  const total = segments.reduce((t, s) => t + s.min, 0) || 1;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.profil, { height: hauteur }, largeur ? { width: largeur } : { alignSelf: 'stretch' }]}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            flex: Math.max(s.min / total, 0.01),
            height: Math.max(4, hauteur * (0.3 + 0.7 * Math.min(1, (s.zone + 1) / 6))),
            backgroundColor: COULEURS_ZONE[Math.min(s.zone, COULEURS_ZONE.length - 1)],
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  profil: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, borderRadius: rayon.base },
});
