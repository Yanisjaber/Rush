import { Stack } from 'expo-router';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Santé : un écran principal (l'état du jour et les chiffres clés), puis le détail de chaque sujet (état de forme, sommeil) et les écrans de saisie (check-in, corps, nutrition).
export default function SanteLayout() {
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
      <Stack.Screen name="sommeil" options={{ title: 'Sommeil' }} />
      <Stack.Screen name="forme" options={{ title: 'État de forme' }} />
      <Stack.Screen name="pilier" options={{ title: 'Détail' }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in du matin' }} />
      <Stack.Screen name="corps" options={{ title: 'Corps' }} />
      <Stack.Screen name="nutrition" options={{ title: 'Nutrition' }} />
    </Stack>
  );
}
