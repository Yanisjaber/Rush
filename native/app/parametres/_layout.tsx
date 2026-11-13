import { Stack } from 'expo-router';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Paramètres : une liste, puis un écran par section (Profil, Physiologie, Zones, Sports, Connexions).
export default function ParametresLayout() {
  const p = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTransparent: true, // le dégradé du fond passe derrière l'en-tête (pas de bandeau noir)
        headerTintColor: p.texte,
        headerTitleStyle: { fontFamily: police.titre700 },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: p.fond },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profil" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="physiologie" options={{ title: 'Physiologie' }} />
      <Stack.Screen name="zones" options={{ title: 'Zones' }} />
      <Stack.Screen name="sports" options={{ title: 'Mes sports' }} />
      <Stack.Screen name="connexions" options={{ title: 'Connexions' }} />
      <Stack.Screen name="synchro" options={{ title: 'Synchro Strava' }} />
      <Stack.Screen name="compte" options={{ title: 'Mon compte' }} />
      <Stack.Screen name="confidentialite" options={{ title: 'Confidentialité' }} />
      <Stack.Screen name="widgets" options={{ title: 'Catalogue des widgets' }} />
    </Stack>
  );
}
