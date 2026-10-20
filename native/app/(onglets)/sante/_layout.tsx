import { Stack } from 'expo-router';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Santé : un écran principal (l'état du jour et les chiffres clés), puis le détail de chaque sujet : l'état de forme et le sommeil.
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
    </Stack>
  );
}
