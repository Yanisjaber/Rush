import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChampTexte } from '@/components/champs/ChampTexte';
import { Bouton } from '@/components/ui/Bouton';
import { Dossard } from '@/components/ui/Dossard';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { evaluerMotDePasse } from '@/data/acces/mot-de-passe';
import { inscription, renvoyerCode, terminerBienvenue, verifierCode } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Créer un compte, sans quitter l'app, en trois temps :
//   1. le formulaire (e-mail, mot de passe guidé, case « 15 ans + confidentialité ») ;
//   2. le code à 6 chiffres reçu par e-mail (il remplace le lien de confirmation, qui ouvrait le site) ;
//   3. « Compte activé » : le numéro de dossard du nouveau compte, puis l'Accueil.
// Aussi ouvert depuis la connexion quand un compte créé n'a jamais été activé (paramètres `email` et `etape=code`).
const ADRESSE_CONFIDENTIALITE = 'https://yanisjaber.github.io/Rush/confidentialite.html';
const PAUSE_RENVOI_S = 30;

type Etape = 'formulaire' | 'code' | 'bienvenue';

export default function Inscription() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; etape?: string }>();

  const [etape, setEtape] = useState<Etape>(params.etape === 'code' && params.email ? 'code' : 'formulaire');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [accord, setAccord] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [code, setCode] = useState('');
  const [attente, setAttente] = useState(0); // secondes avant de pouvoir redemander un code
  const [info, setInfo] = useState('');
  const [numero, setNumero] = useState<number | null>(null);
  const champMdp = useRef<ComponentRef<typeof TextInput>>(null);
  const champCode = useRef<ComponentRef<typeof TextInput>>(null);

  const eval_ = evaluerMotDePasse(motDePasse, email);
  const pret = eval_.valide && accord && email.trim().length > 0;

  // Le minuteur du renvoi du code
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  // Arrivé depuis la connexion avec un compte non activé : on envoie tout de suite un nouveau code
  useEffect(() => {
    if (params.etape === 'code' && params.email) {
      void renvoyerCode(String(params.email)).then((r) => {
        if (r.ok) setAttente(PAUSE_RENVOI_S);
        else setErreur(r.message);
      });
    }
    // une seule fois à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function creer() {
    if (envoi || !pret) return;
    setErreur('');
    setEnvoi(true);
    const r = await inscription(email, motDePasse);
    setEnvoi(false);
    if (!r.ok) return setErreur(r.message);
    setCode('');
    setInfo('');
    setAttente(PAUSE_RENVOI_S);
    setEtape('code');
  }

  async function valider(valeur: string) {
    if (envoi) return;
    setErreur('');
    setEnvoi(true);
    const r = await verifierCode(email, valeur);
    setEnvoi(false);
    if (!r.ok) {
      setCode('');
      setErreur(r.message);
      champCode.current?.focus();
      return;
    }
    setNumero(r.numero);
    setEtape('bienvenue');
  }

  async function renvoyer() {
    if (attente > 0 || envoi) return;
    setErreur('');
    setInfo('');
    const r = await renvoyerCode(email);
    if (!r.ok) return setErreur(r.message);
    setInfo(`Un nouveau code vient d'être envoyé à ${email.trim()}.`);
    setCode('');
    setAttente(PAUSE_RENVOI_S);
  }

  const gerer = (t: string) => {
    const chiffres = t.replace(/\D/g, '').slice(0, 6);
    setCode(chiffres);
    if (chiffres.length === 6) void valider(chiffres);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <Stack.Screen
        options={{
          headerShown: etape !== 'bienvenue',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: p.texte,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          title: '',
          gestureEnabled: etape !== 'bienvenue',
        }}
      />
      <FondDegrade />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + espace.e5 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {etape === 'formulaire' ? (
          <View style={{ gap: espace.e4 }}>
            <View style={{ gap: espace.e2 }}>
              <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>Créer un compte</Text>
              <Text style={[typo.corps, { color: p.texteDoux }]}>Ton entraînement et ta récupération, sport par sport.</Text>
            </View>

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

            <View>
              <ChampTexte
                ref={champMdp}
                etiquette="Mot de passe"
                value={motDePasse}
                onChangeText={setMotDePasse}
                placeholder="Choisis un mot de passe"
                secureTextEntry={!afficher}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                accessibilityLabel="Mot de passe"
                style={{ paddingRight: 96 }}
              />
              <Pressable
                onPress={() => setAfficher((a) => !a)}
                accessibilityRole="button"
                accessibilityLabel={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={styles.oeil}
              >
                <Text style={[typo.petit, { color: p.texteDoux, fontFamily: police.texte600 }]}>{afficher ? 'Masquer' : 'Afficher'}</Text>
              </Pressable>
            </View>

            {/* La jauge et les règles qui se cochent en direct */}
            <View accessibilityLiveRegion="polite" style={{ gap: espace.e2 }}>
              <View style={styles.jauge} accessible accessibilityLabel={`Solidité du mot de passe : ${eval_.force} sur 4`}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.segment, { backgroundColor: i <= eval_.force ? p.ok : p.trait }]} />
                ))}
              </View>
              {eval_.regles.map((r) => (
                <Text key={r.id} style={[typo.petit, { color: r.ok ? p.ok : p.texteMuet }]}>
                  {r.ok ? '✓ ' : '○ '}
                  {r.texte}
                </Text>
              ))}
            </View>

            <Pressable
              onPress={() => setAccord((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accord }}
              accessibilityLabel="J'ai 15 ans ou plus et j'accepte la politique de confidentialité"
              style={styles.accord}
            >
              <View style={[styles.case, { borderColor: p.contourChamp, backgroundColor: accord ? p.texte : 'transparent' }]}>
                {accord ? <Text style={{ color: p.fond, fontFamily: police.texte600, fontSize: 14 }}>✓</Text> : null}
              </View>
              <Text style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>
                {"J'ai 15 ans ou plus et j'accepte la "}
                <Text onPress={() => void Linking.openURL(ADRESSE_CONFIDENTIALITE).catch(() => {})} style={{ color: p.texte, textDecorationLine: 'underline' }}>
                  politique de confidentialité
                </Text>
                .
              </Text>
            </Pressable>

            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.corpsFort, { color: p.danger }]}>{erreur}</Text>
            ) : null}

            {envoi ? (
              <View style={[styles.attente, { backgroundColor: p.texte }]} accessibilityLabel="Création en cours">
                <ActivityIndicator color={p.fond} />
              </View>
            ) : (
              <Bouton variante="principal" disabled={!pret} onPress={() => void creer()}>
                Créer mon compte
              </Bouton>
            )}
            <Pressable onPress={() => router.back()} accessibilityRole="link" style={styles.lien}>
              <Text style={[typo.corpsFort, { color: p.texte, textDecorationLine: 'underline' }]}>J'ai déjà un compte</Text>
            </Pressable>
          </View>
        ) : null}

        {etape === 'code' ? (
          <View style={{ gap: espace.e4 }}>
            <View style={{ gap: espace.e2 }}>
              <Text accessibilityRole="header" style={[styles.titre, { color: p.texte }]}>Entre ton code</Text>
              <Text style={[typo.corps, { color: p.texteDoux }]}>Envoyé à {email.trim()}. Il est valable 1 heure.</Text>
            </View>

            {/* Un seul champ caché reçoit la saisie (et le code proposé par le clavier) ; les 6 cases l'affichent */}
            <View style={styles.codeZone}>
              <View style={styles.codeLigne} accessible={false} importantForAccessibility="no-hide-descendants">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={[styles.codeCase, { backgroundColor: p.surface, borderColor: i === Math.min(code.length, 5) ? p.texte : p.trait }]}>
                    <Text style={[styles.codeChiffre, { color: p.texte }]}>{code[i] ?? ''}</Text>
                  </View>
                ))}
              </View>
              <TextInput
                ref={champCode}
                value={code}
                onChangeText={gerer}
                autoFocus
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                caretHidden
                accessibilityLabel="Code à 6 chiffres reçu par e-mail"
                style={styles.codeChamp}
              />
            </View>

            {info ? <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.texteDoux }]}>{info}</Text> : null}
            {erreur ? <Text accessibilityRole="alert" style={[typo.corpsFort, { color: p.danger }]}>{erreur}</Text> : null}

            {envoi ? (
              <View style={[styles.attente, { backgroundColor: p.texte }]} accessibilityLabel="Vérification en cours">
                <ActivityIndicator color={p.fond} />
              </View>
            ) : (
              <Bouton variante="principal" disabled={code.length !== 6} onPress={() => void valider(code)}>
                Valider
              </Bouton>
            )}
            <Bouton variante="discret" disabled={attente > 0} onPress={() => void renvoyer()}>
              {attente > 0 ? `Renvoyer le code dans 0:${String(attente).padStart(2, '0')}` : 'Renvoyer le code'}
            </Bouton>

            <View style={[styles.astuce, { backgroundColor: p.surface, borderColor: p.trait }]}>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                <Text style={{ fontFamily: police.texte600, color: p.texte }}>Pas de mail ?</Text> Regarde dans tes spams, ou vérifie l'adresse.
              </Text>
              <Pressable
                onPress={() => {
                  setErreur('');
                  setInfo('');
                  setEtape('formulaire');
                }}
                accessibilityRole="link"
                style={styles.lien}
              >
                <Text style={[typo.petit, { color: p.texte, textDecorationLine: 'underline', fontFamily: police.texte600 }]}>Changer d'adresse e-mail</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {etape === 'bienvenue' ? (
          <View style={{ gap: espace.e5 }}>
            <Dossard etiquette="Bienvenue, dossard n°" valeur={numero != null ? String(numero).padStart(4, '0') : 'Rush'} detail="Compte activé" />
            <Text style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>Ton compte est prêt. Ensuite, on règle ton profil et tes sports.</Text>
            <Bouton variante="principal" onPress={terminerBienvenue}>
              Commencer
            </Bouton>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  contenu: { paddingHorizontal: espace.e5, maxWidth: 520, width: '100%', alignSelf: 'center' },
  titre: { fontFamily: police.titre800, fontSize: 36, lineHeight: 40 },
  oeil: { position: 'absolute', right: 6, bottom: 0, height: 48, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  jauge: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  accord: { flexDirection: 'row', gap: espace.e3, alignItems: 'flex-start', minHeight: 44 },
  case: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  attente: { minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  lien: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  codeZone: { height: 64 },
  codeLigne: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  codeCase: { width: 46, height: 60, borderRadius: rayon.l, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  codeChiffre: { fontFamily: police.titre800, fontSize: 30, fontVariant: ['tabular-nums'] },
  codeChamp: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, fontSize: 40 },
  astuce: { borderWidth: 1, borderRadius: rayon.l, padding: espace.e3, gap: espace.e1 },
});
