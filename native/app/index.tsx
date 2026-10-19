import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { clair, cibleTactile, espace, rayon, sombre } from '@/theme/couleurs';

// Écran de test : prouve que le thème et la structure marchent avant de refaire l'Accueil.
export default function Accueil() {
  const p = useColorScheme() === 'light' ? clair : sombre;

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <Text style={[styles.titre, { color: p.texte }]}>Rush</Text>
      <View style={styles.sports}>
        {[p.sportCourse, p.sportVelo, p.sportNatation, p.sportMuscu, p.sportHybride].map((c) => (
          <View key={c} style={[styles.pastille, { backgroundColor: c }]} />
        ))}
      </View>
      <Text style={{ color: p.texteDoux }}>Squelette React Native prêt.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace.e4 },
  titre: { fontSize: 40, fontWeight: '800' },
  sports: { flexDirection: 'row', gap: espace.e2 },
  pastille: { width: cibleTactile, height: cibleTactile, borderRadius: rayon.l },
});
