import { FondDegrade } from '@/components/ui/FondDegrade';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/ui/Bouton';
import { ChampTexte } from '@/components/champs/ChampTexte';
import { connexion } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Écran de connexion : e-mail et mot de passe.
// Le mot de passe n'est jamais journalisé ni gardé ailleurs que dans le champ : il part directement à Supabase.
export default function Connexion() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [nonActive, setNonActive] = useState(false); // compte créé mais jamais activé par le code
  const [envoi, setEnvoi] = useState(false);
  const champMdp = useRef<ComponentRef<typeof TextInput>>(null);

  async function valider() {
    if (envoi) return;
    setErreur('');
    setNonActive(false);
    setEnvoi(true);
    const r = await connexion(email, motDePasse);
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.message);
      setNonActive(!!r.nonActive);
    }
    // En cas de succès, le changement de session fait basculer l'app vers l'Accueil tout seul
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, { backgroundColor: 'transparent' }]}>
      <FondDegrade />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + espace.e5 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>
          Rush
        </Text>
        <Text style={[typo.corps, { color: p.texteDoux, marginBottom: espace.e6 }]}>Ton entraînement et ta récupération, sport par sport.</Text>

        {/* Les mêmes champs que partout dans l'app (pastille centrée) */}
        <View style={{ gap: espace.e4 }}>
          <ChampTexte
            etiquette="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="toi@exemple.fr"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => champMdp.current?.focus()}
            accessibilityLabel="Adresse e-mail"
          />
          <ChampTexte
            ref={champMdp}
            etiquette="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="Ton mot de passe"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={valider}
            accessibilityLabel="Mot de passe"
          />
        </View>

        {erreur ? (
          <Text accessibilityRole="alert" style={[typo.corpsFort, { color: p.danger, marginTop: espace.e3 }]}>
            {erreur}
          </Text>
        ) : null}
        {nonActive ? (
          <Pressable
            onPress={() => router.push({ pathname: '/inscription', params: { email: email.trim(), etape: 'code' } })}
            accessibilityRole="link"
            style={styles.lien}
          >
            <Text style={[typo.corpsFort, { color: p.texte, textDecorationLine: 'underline' }]}>Entrer mon code d'activation</Text>
          </Pressable>
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

        <Text style={[typo.petit, { color: p.texteDoux, marginBottom: espace.e3 }]}>Pas encore de compte ?</Text>
        <Bouton variante="discret" onPress={() => router.push('/inscription')}>
          Créer un compte
        </Bouton>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e5, maxWidth: 520, width: '100%', alignSelf: 'center' },
  titre: { fontFamily: police.titre800, fontSize: 56, lineHeight: 56, marginBottom: espace.e2 },
  attente: { minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  separateur: { marginVertical: espace.e5, borderTopWidth: StyleSheet.hairlineWidth },
  lien: { minHeight: 44, justifyContent: 'center' },
});
