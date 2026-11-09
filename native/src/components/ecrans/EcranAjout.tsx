import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/ui/Bouton';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le gabarit des écrans d'ajout du « + » : les champs, l'erreur éventuelle et le bouton d'enregistrement (le titre est celui de l'en-tête de l'écran). Le clavier ne cache jamais les champs
// (on peut faire défiler, et toucher en dehors d'un champ le ferme).
// `entete` : un bandeau fixe au-dessus de la zone qui défile (le dossard et les onglets de la compétition restent en vue pendant la saisie).
// `supprimer` : en modification, un bouton « Supprimer » sous celui d'enregistrement, avec une confirmation ; une fois supprimé, on revient deux écrans en arrière (le formulaire et la fiche
// de l'élément supprimé). `onConfirmer` renvoie un message d'erreur, vide si tout s'est bien passé.
export interface Suppression {
  libelle: string;
  titre: string;
  message: string;
  onConfirmer: () => Promise<string>;
}

export function EcranAjout({ bouton, enCours, erreur, onValider, entete, supprimer, children }: { bouton: string; enCours: boolean; erreur: string; onValider: () => void; entete?: ReactNode; supprimer?: Suppression; children: ReactNode }) {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState('');
  const confirmer = () => {
    if (!supprimer || suppression) return;
    Alert.alert(supprimer.titre, supprimer.message, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSuppression(true);
            const e = await supprimer.onConfirmer();
            setSuppression(false);
            if (e) return setErreurSuppression(e);
            router.dismiss(2);
          })();
        },
      },
    ]);
  };
  return (
    <>
      {entete ? <View style={[styles.entete, { backgroundColor: p.fond }]}>{entete}</View> : null}
    <ScrollView contentContainerStyle={{ paddingBottom: bas + espace.e6 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      {/* Toucher à côté d'un champ ferme le clavier (le curseur disparaît, ce qui est tapé reste) ; les champs et les boutons gardent leur propre toucher */}
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.contenu}>
        {children}
        {erreur ? (
          <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
            {erreur}
          </Text>
        ) : null}
        <Bouton disabled={enCours || suppression} onPress={() => { if (!enCours && !suppression) onValider(); }}>{enCours ? 'Enregistrement…' : bouton}</Bouton>
        {supprimer ? (
          <View style={{ gap: espace.e2 }}>
            {erreurSuppression ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreurSuppression}
              </Text>
            ) : null}
            <Pressable
              onPress={confirmer}
              disabled={suppression}
              accessibilityRole="button"
              accessibilityLabel={supprimer.libelle}
              style={({ pressed }) => [styles.supprimer, { borderColor: p.danger, opacity: pressed || suppression ? 0.6 : 1 }]}
            >
              <Text style={[typo.corpsFort, { color: p.danger }]}>{suppression ? 'Suppression…' : supprimer.libelle}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, gap: espace.e4 },
  entete: { paddingHorizontal: espace.e4, paddingTop: espace.e2, paddingBottom: espace.e3, gap: espace.e3 },
  supprimer: { minHeight: 44, borderRadius: rayon.base, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
