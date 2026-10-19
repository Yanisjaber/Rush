import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { deconnexion, quitterDemo, useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Paramètres : pour l'instant seulement le compte (se déconnecter). Le reste (profil, sports, connexions) arrive ensuite.
export default function Parametres() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { session, demo } = useAuth();

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e4, paddingBottom: insets.bottom + 72 }]}>
      <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
        Paramètres
      </Text>
      <Bloc titre="Compte">
        <Text style={[typo.petit, { color: p.texteDoux }]}>{demo ? 'Tu es en mode démo : des données d\'exemple, aucun compte.' : 'Connecté en tant que'}</Text>
        {!demo ? <Text style={[typo.corpsFort, { color: p.texte, marginTop: 2 }]}>{session?.user.email ?? ''}</Text> : null}
        <View style={{ marginTop: espace.e4 }}>
          <Bouton variante="discret" onPress={demo ? quitterDemo : () => void deconnexion()}>
            {demo ? 'Quitter la démo' : 'Se déconnecter'}
          </Bouton>
        </View>
      </Bloc>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
});
