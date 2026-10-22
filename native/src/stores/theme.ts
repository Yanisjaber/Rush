import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { lireChoixTheme, schemaDe, type ChoixTheme } from '@/data/theme-choisi';

// Le thème choisi dans Paramètres, gardé sur le téléphone seulement (rien n'est écrit en base).
// On passe par Appearance.setColorScheme : tout ce qui suit le schéma du téléphone (palette, barre d'état, barre du bas native) suit le choix.
// Tant que rien n'est choisi, l'app suit le réglage du téléphone.
const CLE = 'rush-theme';

/** Au démarrage : applique le choix gardé (s'il y en a un). */
export async function chargerTheme(): Promise<void> {
  try {
    const choix = lireChoixTheme(await SecureStore.getItemAsync(CLE));
    if (choix) Appearance.setColorScheme(schemaDe(choix));
  } catch {
    // Lecture impossible : on reste sur le réglage du téléphone
  }
}

/** Applique tout de suite le thème choisi et le garde pour les prochains lancements. */
export function definirTheme(choix: ChoixTheme): void {
  Appearance.setColorScheme(schemaDe(choix));
  void SecureStore.setItemAsync(CLE, choix).catch(() => {});
}
