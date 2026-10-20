import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { clair, sombre, type Palette } from './couleurs';

// Palette courante. Pour l'instant elle suit le téléphone ; plus tard elle suivra le compte (user_preferences).
// Un contexte peut la surcharger pour une zone de l'écran : le premier widget d'une page (look dossard) y met la palette
// inverse du thème, et tout ce qu'il contient s'adapte sans rien changer (voir CadreWidget).
export const ContextePalette = createContext<Palette | null>(null);

export function usePalette(): Palette {
  const surcharge = useContext(ContextePalette);
  const systeme = useColorScheme() === 'light' ? clair : sombre;
  return surcharge ?? systeme;
}
