import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { SelecteurSports } from '@/components/SelecteurSports';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Premier écran d'un compte neuf : on coche ses sports, l'Accueil se compose ensuite tout seul.
// « Passer » enregistre une liste vide : la question n'est plus reposée, on peut changer plus tard dans Paramètres › Mes sports.
export function Onboarding() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { choisis, setChoisis, erreur, envoi, appliquer } = useSportsChoisis();
  const liste = choisis ?? [];
  const basculer = (cle: string) => setChoisis(liste.includes(cle) ? liste.filter((s) => s !== cle) : [...liste, cle]);

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e5, paddingBottom: insets.bottom + 96 }]}>
      <Text style={[typo.micro, { color: p.sportCourse }]}>Bienvenue sur Rush</Text>
      <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>
        Quels sports pratiques-tu ?
      </Text>
      <Text style={[typo.corps, { color: p.texteDoux }]}>
        Coche tout ce que tu pratiques : ton accueil se compose tout seul avec les bons widgets et les bons onglets. Triathlon ? Coche course, vélo et natation. Tu pourras changer ça quand tu veux dans Paramètres.
      </Text>
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreur}
        </Text>
      ) : null}
      <SelecteurSports choisis={liste} onBasculer={basculer} desactive={envoi} />
      <View style={{ gap: espace.e3 }}>
        <Bouton onPress={() => void appliquer(liste)}>{envoi ? 'Enregistrement…' : liste.length ? 'Continuer' : 'Continuer sans choisir'}</Bouton>
        {liste.length ? (
          <Bouton variante="discret" onPress={() => void appliquer([])}>
            Passer
          </Bouton>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  titre: { fontFamily: police.titre800, fontSize: 40, lineHeight: 42 },
});
