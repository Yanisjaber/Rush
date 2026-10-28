import type { ReactNode } from 'react';
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from 'react-native';

// Une zone où toucher à côté d'un champ texte ferme le clavier et retire le curseur. Les boutons et les champs gardent leur propre toucher.
// Posée autour de toute l'app (_layout.tsx) et dans chaque fenêtre qui contient un champ (une fenêtre s'ouvre à part : elle n'est pas couverte par celle de l'app).
export function ZoneClavier({ children, style, modale }: { children: ReactNode; style?: StyleProp<ViewStyle>; modale?: boolean }) {
  return (
    <Pressable accessible={false} accessibilityViewIsModal={modale} onPress={Keyboard.dismiss} style={style}>
      {children}
    </Pressable>
  );
}
