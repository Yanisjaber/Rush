import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Keyboard, TextInput, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

// Une zone où toucher à côté d'un champ texte ferme le clavier et retire le curseur.
// Posée autour de toute l'app (_layout.tsx) et dans chaque fenêtre qui contient un champ (une fenêtre s'ouvre à part : elle n'est pas couverte par celle de l'app).
//
// Important : ce n'est PAS un Pressable. Un parent qui réagit au toucher peut garder le geste sur iPhone
// et empêcher tous les ScrollView en dessous de défiler. Ici on ne fait qu'écouter les doigts qui passent
// (onTouchStart / onTouchEnd), sans jamais devenir « responder » : le défilement et les boutons gardent leur toucher.
export function ZoneClavier({ children, style, modale }: { children: ReactNode; style?: StyleProp<ViewStyle>; modale?: boolean }) {
  const depart = useRef<{ x: number; y: number } | null>(null);

  const debut = (e: GestureResponderEvent) => {
    // Un seul doigt : sinon c'est un zoom ou un geste à deux doigts, pas un tap
    depart.current = e.nativeEvent.touches.length === 1 ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : null;
  };

  const fin = (e: GestureResponderEvent) => {
    const d = depart.current;
    depart.current = null;
    if (!d) return;
    const { pageX, pageY } = e.nativeEvent;
    // Un doigt qui a bougé = un défilement ou un balayage, pas un tap : on ne ferme rien
    if (Math.abs(pageX - d.x) > 8 || Math.abs(pageY - d.y) > 8) return;
    const champ = TextInput.State.currentlyFocusedInput?.();
    if (!champ) return; // aucun clavier ouvert
    // Un tap dans le champ lui-même garde le clavier (déplacer le curseur, sélectionner)
    champ.measure((_x, _y, largeur, hauteur, px, py) => {
      const dedans = pageX >= px && pageX <= px + largeur && pageY >= py && pageY <= py + hauteur;
      if (!dedans) Keyboard.dismiss();
    });
  };

  return (
    <View accessible={false} accessibilityViewIsModal={modale} onTouchStart={debut} onTouchEnd={fin} style={style}>
      {children}
    </View>
  );
}
