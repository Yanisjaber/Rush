import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
// On importe chaque graisse par son chemin : ça n'embarque que les 6 fichiers utiles.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { initAuth, useAuth } from '@/stores/auth';
import { chargerTheme } from '@/stores/theme';
import { clair, sombre } from '@/theme/couleurs';

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

  // On attend les polices, le thème et la lecture de la session : sinon l'écran de connexion clignoterait avant l'Accueil
  if ((!policesPretes && !erreurPolices) || !pret || !themePret) return null;
  const connecte = !!session || demo;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={palette === clair ? 'dark' : 'light'} />
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
        </Stack.Protected>
        <Stack.Protected guard={!connecte}>
          <Stack.Screen name="connexion" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
