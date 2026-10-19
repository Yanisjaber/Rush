import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { clair, espace, sombre } from '@/theme/couleurs';
import { typo, type NomTypo } from '@/theme/typo';

// Écran de test : montre l'échelle typographique de la charte avant de refaire l'Accueil.
const lignes: { nom: NomTypo; exemple: string }[] = [
  { nom: 'display', exemple: '42,2' },
  { nom: 'titre1', exemple: 'Séance de seuil' },
  { nom: 'titre2', exemple: 'Charge 7 jours' },
  { nom: 'titre3', exemple: 'Séries par groupe' },
  { nom: 'corps', exemple: 'Dix kilomètres à allure marathon, puis retour au calme.' },
  { nom: 'corpsFort', exemple: 'Valider la séance' },
  { nom: 'petit', exemple: 'Dernière synchronisation il y a 4 min' },
  { nom: 'micro', exemple: 'Distance totale' },
];

export default function Accueil() {
  const p = useColorScheme() === 'light' ? clair : sombre;

  return (
    <ScrollView
      style={{ backgroundColor: p.fond }}
      contentContainerStyle={styles.contenu}
      contentInsetAdjustmentBehavior="automatic"
    >
      {lignes.map(({ nom, exemple }) => (
        <View key={nom} style={[styles.ligne, { borderBottomColor: p.trait }]}>
          <Text style={[typo.micro, { color: p.texteMuet }]}>{nom}</Text>
          <Text style={[typo[nom], { color: p.texte }]}>{exemple}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, paddingTop: 72, paddingBottom: espace.e7, gap: espace.e2 },
  ligne: { paddingVertical: espace.e3, borderBottomWidth: StyleSheet.hairlineWidth, gap: espace.e1 },
});
