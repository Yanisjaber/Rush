import { ScrollView, StyleSheet } from 'react-native';
import { Dossard } from '@/components/Dossard';
import { espace } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Écran de test : tous les cas du dossard avant de refaire l'Accueil.
export default function Accueil() {
  const p = usePalette();

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={styles.contenu}>
      <Dossard
        sport="course"
        etiquette="Prochain objectif"
        nom="Semi-marathon de Lyon"
        valeur="J-63"
        detail="Dimanche 21 décembre · objectif 1h32"
      />
      <Dossard sport="muscu" taille="m" etiquette="Séance du jour" nom="Haut du corps" valeur="PUSH" detail="6 exercices · environ 55 min" />
      <Dossard sport="velo" taille="m" etiquette="Dernière sortie" nom="Sortie longue" valeur={'1h13\'42"'} detail="Hier · 38,4 km" />
      <Dossard sport="hyrox" taille="m" etiquette="Record" nom="Hyrox solo" valeur="1h09'58&quot; en un très long texte" detail="Test de débordement du chiffre" />
      <Dossard compact etiquette="Objectif" nom="Aucun objectif" detail="Ajoute une course pour voir le compte à rebours." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, paddingTop: 72, paddingBottom: espace.e7, gap: espace.e4 },
});
