import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { RondProfil } from '@/components/ui/RondProfil';
import { useAvatar } from '@/stores/avatar';

// Le rond de profil qui ouvre les Paramètres (plein écran, avec un bouton retour). Il est en haut à droite de la barre des sports
// et dans l'en-tête de Santé : la photo du compte, ou une silhouette. Toujours visible, même pour un compte sans sport :
// c'est par là qu'on se déconnecte et qu'on gère son compte.
export function BoutonReglages() {
  const router = useRouter();
  const url = useAvatar();
  return (
    <Pressable
      onPress={() => router.push('/parametres')}
      accessibilityRole="button"
      accessibilityLabel="Paramètres et profil"
      hitSlop={{ top: 0, bottom: 0, left: 0, right: 4 }}
      style={({ pressed }) => [styles.bouton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <RondProfil url={url} taille={38} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
});
