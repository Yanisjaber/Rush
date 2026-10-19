import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { clair, sombre } from '@/theme/couleurs';

export default function RootLayout() {
  // Pour l'instant le thème suit le téléphone ; plus tard il suivra le compte (user_preferences).
  const palette = useColorScheme() === 'light' ? clair : sombre;

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
