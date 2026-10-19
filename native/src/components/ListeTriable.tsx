import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { decalages, indiceCible, vitesseDefilement, type Boite } from '@/data/glisse';
import { usePalette } from '@/theme/usePalette';

// Une liste verticale dont on réordonne les éléments en les MAINTENANT puis en les glissant (comme l'écran d'accueil de l'iPhone).
// Les éléments gardent leur forme finale. Un appui bref les sélectionne. Près du haut ou du bas de l'écran, la liste défile toute seule.
// Pour VoiceOver : deux actions « Monter » et « Descendre » sur chaque élément.
interface Defilement {
  /** Position actuelle du défilement (mise à jour par le ScrollView parent). */
  decalage: RefObject<number>;
  /** Fait défiler le ScrollView parent à cette position. */
  vers: (y: number) => void;
  /** Zone visible à l'écran où le doigt peut aller avant que la liste défile (coordonnées de l'écran). */
  haut: number;
  bas: number;
}

interface Props {
  ids: string[];
  selection: string;
  onSelection: (id: string) => void;
  /** Appelé une fois l'élément lâché : de l'index `de` vers l'index `vers`. */
  onDeplacer: (de: number, vers: number) => void;
  /** Dit au parent qu'un glissement est en cours (pour couper le défilement à la main). */
  onGlisse: (enCours: boolean) => void;
  defilement: Defilement;
  nom: (id: string) => string;
  rendre: (id: string) => ReactNode;
}

const MAINTIEN_MS = 350;

export function ListeTriable({ ids, selection, onSelection, onDeplacer, onGlisse, defilement, nom, rendre }: Props) {
  const boites = useRef<Record<string, Boite>>({});
  const ty = useSharedValue(0);
  const [actif, setActif] = useState<{ id: string; de: number; vers: number } | null>(null);
  const [pousses, setPousses] = useState<number[]>([]);
  // Le dernier état du glissement, lu par la boucle de défilement automatique
  const suivi = useRef<{ id: string; de: number; vers: number; dy: number; doigtY: number; decalageDepart: number } | null>(null);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  const liste = useCallback((): Boite[] => ids.map((id) => boites.current[id] ?? { y: 0, h: 0 }), [ids]);

  const recalculer = useCallback(() => {
    const s = suivi.current;
    if (!s) return;
    const total = s.dy + ((defilement.decalage.current ?? 0) - s.decalageDepart);
    ty.value = total;
    const b = liste();
    const centre = (b[s.de]?.y ?? 0) + (b[s.de]?.h ?? 0) / 2 + total;
    const vers = indiceCible(b, s.de, centre);
    if (vers !== s.vers) {
      s.vers = vers;
      setActif({ id: s.id, de: s.de, vers });
      setPousses(decalages(b, s.de, vers));
    }
  }, [defilement.decalage, liste, ty]);

  const arreterDefilement = () => {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
  };
  useEffect(() => arreterDefilement, []);

  const debut = useCallback(
    (id: string, index: number) => {
      suivi.current = { id, de: index, vers: index, dy: 0, doigtY: 0, decalageDepart: defilement.decalage.current ?? 0 };
      ty.value = 0;
      setPousses(ids.map(() => 0));
      setActif({ id, de: index, vers: index });
      onSelection(id);
      onGlisse(true);
      arreterDefilement();
      // Près du bord de l'écran, la liste défile toute seule tant que le doigt y reste
      minuteur.current = setInterval(() => {
        const s = suivi.current;
        if (!s) return;
        const v = vitesseDefilement(s.doigtY, defilement.haut, defilement.bas);
        if (v === 0) return;
        defilement.vers(Math.max(0, (defilement.decalage.current ?? 0) + v));
        recalculer();
      }, 16);
    },
    [defilement, ids, onGlisse, onSelection, recalculer, ty],
  );

  const bouge = useCallback(
    (dy: number, doigtY: number) => {
      const s = suivi.current;
      if (!s) return;
      s.dy = dy;
      s.doigtY = doigtY;
      recalculer();
    },
    [recalculer],
  );

  const fin = useCallback(() => {
    const s = suivi.current;
    suivi.current = null;
    arreterDefilement();
    setActif(null);
    setPousses([]);
    ty.value = 0;
    onGlisse(false);
    if (s && s.vers !== s.de) onDeplacer(s.de, s.vers);
  }, [onDeplacer, onGlisse, ty]);

  return (
    <View>
      {ids.map((id, index) => (
        <Triable
          key={id}
          id={id}
          index={index}
          total={ids.length}
          nom={nom(id)}
          leve={actif?.id === id}
          decalage={actif && actif.id !== id ? (pousses[index] ?? 0) : 0}
          ty={ty}
          selectionne={selection === id}
          onSelection={onSelection}
          onDeplacer={onDeplacer}
          onMesure={(b) => {
            boites.current[id] = b;
          }}
          onDebut={debut}
          onBouge={bouge}
          onFin={fin}
        >
          {rendre(id)}
        </Triable>
      ))}
    </View>
  );
}

interface TriableProps {
  id: string;
  index: number;
  total: number;
  nom: string;
  leve: boolean;
  decalage: number;
  ty: SharedValue<number>;
  selectionne: boolean;
  onSelection: (id: string) => void;
  onDeplacer: (de: number, vers: number) => void;
  onMesure: (b: Boite) => void;
  onDebut: (id: string, index: number) => void;
  onBouge: (dy: number, doigtY: number) => void;
  onFin: () => void;
  children: ReactNode;
}

function Triable({ id, index, total, nom, leve, decalage, ty, selectionne, onSelection, onDeplacer, onMesure, onDebut, onBouge, onFin, children }: TriableProps) {
  const p = usePalette();
  const pan = usePanGesture({
    activateAfterLongPress: MAINTIEN_MS,
    runOnJS: true,
    onActivate: () => onDebut(id, index),
    onUpdate: (e) => onBouge(e.translationY, e.absoluteY),
    onFinalize: () => onFin(),
  });
  // Pas de tableau de dépendances : sur mobile Reanimated suit tout seul ce que le style lit (`leve`, `decalage`, `ty`)
  const style = useAnimatedStyle(() => ({
      transform: [{ translateY: leve ? ty.value : withTiming(decalage, { duration: 160 }) }, { scale: withTiming(leve ? 1.03 : 1, { duration: 120 }) }],
      zIndex: leve ? 10 : 0,
      opacity: leve ? 0.92 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => onMesure({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        style={[styles.element, style]}
        accessible
        accessibilityLabel={`${nom}, position ${index + 1} sur ${total}`}
        accessibilityHint="Touche pour sélectionner. Maintiens et glisse pour déplacer."
        accessibilityState={{ selected: selectionne }}
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'moveUp', label: 'Monter' }] : []),
          ...(index < total - 1 ? [{ name: 'moveDown', label: 'Descendre' }] : []),
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'moveUp') onDeplacer(index, index - 1);
          if (e.nativeEvent.actionName === 'moveDown') onDeplacer(index, index + 1);
        }}
      >
        <Pressable onPress={() => onSelection(selectionne ? '' : id)} style={[styles.contour, selectionne && { borderColor: p.texte, borderStyle: 'dashed' }]}>
          <View style={styles.inerte}>{children}</View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // La marge du bas fait partie de la hauteur mesurée : c'est elle qui sépare deux éléments pendant le glissement
  element: { paddingBottom: 16 },
  // Le contenu d'un widget est inerte en édition : un appui n'atteint que l'élément (qui se sélectionne)
  inerte: { pointerEvents: 'none' },
  contour: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, padding: 2 },
});
