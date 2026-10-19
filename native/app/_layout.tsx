import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
// On importe chaque graisse par son chemin : ça n'embarque que les 6 fichiers utiles.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { clair, sombre } from '@/theme/couleurs';

export default function RootLayout() {
  // Pour l'instant le thème suit le téléphone ; plus tard il suivra le compte (user_preferences).
  const palette = useColorScheme() === 'light' ? clair : sombre;

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

  if (!policesPretes && !erreurPolices) return null;

  return (
    <>
      <StatusBar style={palette === clair ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.fond },
        }}
      />
    </>
  );
}
