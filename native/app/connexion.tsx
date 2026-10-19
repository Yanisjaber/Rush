import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { connexion, entrerDemo } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Adresse du site, où l'on crée un compte (la confirmation par e-mail passe par le web pour l'instant).
const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';

// Écran de connexion : e-mail et mot de passe, ou la démo sans compte.
// Le mot de passe n'est jamais journalisé ni gardé ailleurs que dans le champ : il part directement à Supabase.
export default function Connexion() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const champMdp = useRef<ComponentRef<typeof TextInput>>(null);

  async function valider() {
    if (envoi) return;
    setErreur('');
    setEnvoi(true);
    const r = await connexion(email, motDePasse);
    setEnvoi(false);
    if (!r.ok) setErreur(r.message);
    // En cas de succès, le changement de session fait basculer l'app vers l'Accueil tout seul
  }

  const champ = [styles.champ, typo.corps, { color: p.texte, backgroundColor: p.surface, borderColor: p.contourChamp }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, { backgroundColor: p.fond }]}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + espace.e5 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>
          Rush
        </Text>
        <Text style={[typo.corps, { color: p.texteDoux, marginBottom: espace.e6 }]}>Ton entraînement et ta récupération, sport par sport.</Text>

        <Text style={[typo.micro, { color: p.texteDoux }]}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={champ}
          placeholder="toi@exemple.fr"
          placeholderTextColor={p.texteMuet}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => champMdp.current?.focus()}
          accessibilityLabel="Adresse e-mail"
        />

        <Text style={[typo.micro, { color: p.texteDoux, marginTop: espace.e4 }]}>Mot de passe</Text>
        <TextInput
          ref={champMdp}
          value={motDePasse}
          onChangeText={setMotDePasse}
          style={champ}
          placeholder="Ton mot de passe"
          placeholderTextColor={p.texteMuet}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={valider}
          accessibilityLabel="Mot de passe"
        />

        {erreur ? (
          <Text accessibilityRole="alert" style={[typo.corpsFort, { color: p.danger, marginTop: espace.e3 }]}>
            {erreur}
          </Text>
        ) : null}

        <View style={{ marginTop: espace.e5 }}>
          {envoi ? (
            <View style={[styles.attente, { backgroundColor: p.texte }]} accessibilityLabel="Connexion en cours">
              <ActivityIndicator color={p.fond} />
            </View>
          ) : (
            <Bouton variante="principal" onPress={valider}>
              Se connecter
            </Bouton>
          )}
        </View>

        <View style={[styles.separateur, { borderTopColor: p.trait }]} />

        <Text style={[typo.petit, { color: p.texteDoux }]}>Pas encore de compte ? Crée-le sur le site, puis reviens te connecter ici.</Text>
        <Pressable onPress={() => void Linking.openURL(ADRESSE_SITE)} accessibilityRole="link" style={styles.lien}>
          <Text style={[typo.corpsFort, { color: p.texte, textDecorationLine: 'underline' }]}>Ouvrir le site</Text>
        </Pressable>

        <View style={{ marginTop: espace.e4 }}>
          <Bouton variante="discret" onPress={entrerDemo}>
            Essayer la démo, sans compte
          </Bouton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e5, maxWidth: 520, width: '100%', alignSelf: 'center' },
  titre: { fontFamily: police.titre800, fontSize: 56, lineHeight: 56, marginBottom: espace.e2 },
  // 48 pt de haut : au-dessus des 44 pt de cible tactile
  champ: { marginTop: espace.e1, minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: espace.e3 },
  attente: { minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  separateur: { marginVertical: espace.e5, borderTopWidth: StyleSheet.hairlineWidth },
  lien: { minHeight: 44, justifyContent: 'center' },
});
