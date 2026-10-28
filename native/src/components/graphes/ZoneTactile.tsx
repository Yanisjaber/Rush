import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

// Rend un graphique sensible au toucher : poser le doigt (ou le faire glisser) choisit l'élément visé (un mois, une semaine, un jour), le toucher une seconde fois le désélectionne.
// Le graphique est dessiné dedans, sans réagir lui-même au toucher (pointerEvents none) : la position du doigt est alors toujours celle de la zone entière.
interface Props {
  /** L'élément (0, 1, 2…) sous la position `x` (en pt depuis le bord gauche de la zone) dans une zone large de `largeur` ; null si aucun. */
  indexDe: (x: number, largeur: number) => number | null;
  selection: number | null;
  onSelection: (index: number | null) => void;
  children: ReactNode;
}

export function ZoneTactile({ indexDe, selection, onSelection, children }: Props) {
  const [largeur, setLargeur] = useState(0);
  // Après avoir désélectionné d'un second toucher, un léger glissement du doigt ne doit pas resélectionner aussitôt
  const ignorer = useRef(false);
  const lire = (x: number) => (largeur > 0 ? indexDe(x, largeur) : null);
  return (
    <View
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      onTouchStart={(e) => {
        const i = lire(e.nativeEvent.locationX);
        if (i == null) return;
        ignorer.current = i === selection;
        onSelection(i === selection ? null : i);
      }}
      onTouchMove={(e) => {
        if (ignorer.current) return;
        const i = lire(e.nativeEvent.locationX);
        if (i != null && i !== selection) onSelection(i);
      }}
    >
      <View pointerEvents="none">{children}</View>
    </View>
  );
}
