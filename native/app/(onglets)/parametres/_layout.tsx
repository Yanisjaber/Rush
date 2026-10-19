import { Stack } from 'expo-router';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Paramètres : une liste, puis un écran par section (Profil, Physiologie, Zones, Sports, Connexions).
export default function ParametresLayout() {
  const p = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: p.fond },
        headerTintColor: p.texte,
        headerTitleStyle: { fontFamily: police.titre700 },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: p.fond },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profil" options={{ title: 'Profil' }} />
      <Stack.Screen name="physiologie" options={{ title: 'Physiologie' }} />
      <Stack.Screen name="zones" options={{ title: 'Zones' }} />
      <Stack.Screen name="sports" options={{ title: 'Mes sports' }} />
      <Stack.Screen name="connexions" options={{ title: 'Connexions' }} />
    </Stack>
  );
}
