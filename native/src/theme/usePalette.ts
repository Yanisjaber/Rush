import { useColorScheme } from 'react-native';
import { clair, sombre, type Palette } from './couleurs';

// Palette courante. Pour l'instant elle suit le téléphone ; plus tard elle suivra le compte (user_preferences).
export function usePalette(): Palette {
  return useColorScheme() === 'light' ? clair : sombre;
}
