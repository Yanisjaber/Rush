import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
// On importe chaque graisse par son chemin : ça n'embarque que les 6 fichiers utiles.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { EcranChargement } from '@/components/ui/EcranChargement';
import { ZoneClavier } from '@/components/champs/ZoneClavier';
import { initAuth, useAuth } from '@/stores/auth';
import { chargerTheme } from '@/stores/theme';
import { clair, sombre } from '@/theme/couleurs';

// On garde l'écran de lancement natif affiché jusqu'à ce que tout soit prêt : pas de trou vide entre lui et l'app.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Le thème est celui choisi dans Paramètres (gardé sur le téléphone) ; sans choix, il suit le téléphone.
  const palette = useColorScheme() === 'light' ? clair : sombre;
  const { pret, session, demo } = useAuth();

  // Lit le thème choisi avant le premier affichage : sinon l'écran clignoterait dans l'autre thème
  const [themePret, setThemePret] = useState(false);
  useEffect(() => {
    void chargerTheme().finally(() => setThemePret(true));
  }, []);

  // Lit la session gardée dans le Trousseau, puis suit ses changements
  useEffect(() => {
    void initAuth();
  }, []);

  const [policesPretes, erreurPolices] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });

  // Si une police échoue, useFonts reste à false pour toujours : on affiche l'app quand même
  // avec les polices du système plutôt que de bloquer sur un écran vide.
  useEffect(() => {
    if (erreurPolices) console.warn('[polices] chargement impossible :', erreurPolices.message);
  }, [erreurPolices]);

  // Polices et thème prêts : on peut retirer l'écran de lancement natif, l'écran de chargement prend le relais par-dessus
  const decorPret = (policesPretes || !!erreurPolices) && themePret;
  useEffect(() => {
    if (decorPret) void SplashScreen.hideAsync().catch(() => {});
  }, [decorPret]);

  // L'écran de chargement (« À vos marques… ») reste tant que la session n'est pas lue : sinon l'écran de connexion clignoterait avant l'Accueil
  const [chargementFini, setChargementFini] = useState(false);
  const finChargement = useCallback(() => setChargementFini(true), []);

  if (!decorPret) return null;
  const connecte = !!session || demo;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={palette === clair ? 'dark' : 'light'} />
      {/* Toucher à côté d'un champ texte, n'importe où dans l'app, ferme le clavier et retire le curseur */}
      <ZoneClavier style={{ flex: 1 }}>
      {pret ? (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.fond },
        }}
      >
        {/* Sans compte (ni démo), seul l'écran de connexion existe : aucune autre adresse de l'app n'est atteignable */}
        <Stack.Protected guard={connecte}>
          <Stack.Screen name="(onglets)" />
          {/* Le détail d'une séance : un écran poussé par-dessus les onglets, avec son bouton retour */}
          <Stack.Screen
            name="seance"
            options={{
              headerShown: true,
              title: 'Séance',
              headerStyle: { backgroundColor: palette.fond },
              headerTintColor: palette.texte,
              headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
            }}
          />
          {/* Une séance prévue ou une compétition en lecture, avec Modifier et Supprimer */}
          <Stack.Screen
            name="prevue"
            options={{
              headerShown: true,
              title: 'Séance prévue',
              headerStyle: { backgroundColor: palette.fond },
              headerTintColor: palette.texte,
              headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
            }}
          />
          {/* Les cycles d'entraînement : la liste, puis le formulaire pour en créer ou en modifier un */}
          <Stack.Screen name="cycles" options={{ headerShown: true, title: 'Cycles', headerStyle: { backgroundColor: palette.fond }, headerTintColor: palette.texte, headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }} />
          {/* Les écrans d'ajout du « + » du calendrier : un par type d'ajout, tous avec le même en-tête */}
          {['ajout-seance', 'ajout-sortie', 'ajout-import', 'ajout-competition', 'ajout-note'].map((nom) => (
            <Stack.Screen
              key={nom}
              name={`(ajouts)/${nom}`}
              options={{
                headerShown: true,
                title: { 'ajout-seance': 'Séance prévue', 'ajout-sortie': 'Activité déjà faite', 'ajout-import': 'Importer une séance', 'ajout-competition': 'Compétition', 'ajout-note': 'Note' }[nom],
                headerStyle: { backgroundColor: palette.fond },
                headerTintColor: palette.texte,
                headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' },
                headerBackButtonDisplayMode: 'minimal',
                headerShadowVisible: false,
              }}
            />
          ))}
          {/* Un objectif annuel du Bilan : créer, modifier ou supprimer */}
          <Stack.Screen name="objectif" options={{ headerShown: true, title: 'Objectif', headerStyle: { backgroundColor: palette.fond }, headerTintColor: palette.texte, headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }} />
          <Stack.Screen name="cycle" options={{ headerShown: true, title: 'Cycle', headerStyle: { backgroundColor: palette.fond }, headerTintColor: palette.texte, headerTitleStyle: { fontFamily: 'BricolageGrotesque_700Bold' }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }} />
          {/* Les Paramètres : plein écran par-dessus les onglets, ouverts par la roue dentée (en haut à droite). Leur propre pile gère ses en-têtes. */}
          <Stack.Screen name="parametres" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!connecte}>
          <Stack.Screen name="connexion" />
        </Stack.Protected>
      </Stack>
      ) : null}
      </ZoneClavier>
      {chargementFini ? null : <EcranChargement pret={pret} onFin={finChargement} />}
    </GestureHandlerRootView>
  );
}
