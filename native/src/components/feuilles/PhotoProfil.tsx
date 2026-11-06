import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { Bouton } from '@/components/ui/Bouton';
import { RondProfil } from '@/components/ui/RondProfil';
import { envoyerAvatar, retirerAvatar } from '@/data/acces/api/avatar';
import { definirAvatar, useAvatar } from '@/stores/avatar';
import { useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Choisir, changer ou retirer sa photo de profil. Le sélecteur d'iOS ne donne accès qu'à la photo choisie (aucune permission à demander).
// La photo est recadrée en carré avant l'envoi et enregistrée tout de suite (pas besoin du bouton Enregistrer du formulaire).
export function PhotoProfil() {
  const p = usePalette();
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const url = useAvatar();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  async function choisir() {
    if (envoi || !userId) return;
    setErreur('');
    setMessage('');
    // Chargé au clic (pas à l'ouverture de l'écran) : une app installée avant l'ajout du module natif ne plante pas, elle dit quoi faire
    let choix: import('expo-image-picker').ImagePickerResult;
    try {
      const ImagePicker = await import('expo-image-picker');
      choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, allowsMultipleSelection: false });
    } catch {
      setErreur("Le sélecteur de photos n'est pas dans cette version de l'app : il faut la réinstaller.");
      return;
    }
    if (choix.canceled || !choix.assets[0]) return;
    setEnvoi(true);
    const r = await envoyerAvatar(userId, choix.assets[0].uri);
    setEnvoi(false);
    if (r.erreur || !r.data) {
      setErreur(r.erreur);
      return;
    }
    definirAvatar(userId, r.data);
    setMessage('Photo enregistrée.');
  }

  async function retirer() {
    if (envoi || !userId) return;
    setErreur('');
    setMessage('');
    setEnvoi(true);
    const r = await retirerAvatar(userId);
    setEnvoi(false);
    if (r.erreur) {
      setErreur(r.erreur);
      return;
    }
    definirAvatar(userId, null);
    setMessage('Photo retirée.');
  }

  return (
    <Bloc titre="Photo de profil">
      <View style={styles.ligne}>
        <RondProfil url={url} taille={72} />
        <View style={styles.actions}>
          {demo ? (
            <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : la photo n'est pas disponible.</Text>
          ) : (
            <>
              <Bouton variante="discret" onPress={() => void choisir()} disabled={envoi}>
                {envoi ? 'Envoi…' : url ? 'Changer la photo' : 'Choisir une photo'}
              </Bouton>
              {url ? (
                <Bouton variante="discret" onPress={() => void retirer()} disabled={envoi}>
                  Retirer la photo
                </Bouton>
              ) : null}
            </>
          )}
        </View>
      </View>
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginTop: espace.e2 }]}>
          {erreur}
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, marginTop: espace.e2 }]}>
          {message}
        </Text>
      ) : null}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e4, marginTop: espace.e2 },
  actions: { flex: 1, gap: espace.e2 },
});
