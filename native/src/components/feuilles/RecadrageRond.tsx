import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Circle, Defs, Line, Path } from 'react-native-svg';
import { bornerCadre, echelleBase, rectangleDecoupe, type Cadre, type Rectangle } from '@/data/reglages/recadrage';
import { police } from '@/theme/typo';

// Recadrer la photo de profil dans un cercle : la photo se déplace et se zoome sous le cercle, et ce qui est dedans est exactement
// ce qui apparaîtra dans le rond. Une grille des tiers aide à cadrer, elle ne s'affiche que pendant qu'on touche la photo.
// Cet écran est toujours sombre (comme le sélecteur d'Apple) : il ne suit pas le thème de l'app.
interface Props {
  uri: string;
  /** Taille de la photo d'origine, en pixels. */
  largeur: number;
  hauteur: number;
  onAnnuler: () => void;
  /** Le carré à découper dans la photo d'origine. */
  onValider: (zone: Rectangle) => void;
}

const FOND_VOILE = 'rgba(0,0,0,0.72)';

export function RecadrageRond({ uri, largeur, hauteur, onAnnuler, onValider }: Props) {
  const { width: ecranL } = useWindowDimensions();
  const haut = useSafeAreaInsets().top;
  const bas = useSafeAreaInsets().bottom;
  const d = Math.round(ecranL * 0.84);
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const [actif, setActif] = useState(false);

  // L'état de référence vit ici (lisible à tout instant) ; les valeurs partagées en sont le miroir pour l'animation
  const etat = useRef<Cadre>({ w: largeur, h: hauteur, d, zoom: 1, tx: 0, ty: 0 });
  const debut = useRef({ zoom: 1, tx: 0, ty: 0 });
  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const appliquer = (z: number, x: number, y: number) => {
    const c = bornerCadre({ ...etat.current, zoom: z, tx: x, ty: y });
    etat.current = c;
    zoom.value = c.zoom;
    tx.value = c.tx;
    ty.value = c.ty;
  };

  const pan = usePanGesture({
    runOnJS: true,
    onBegin: () => {
      debut.current = { zoom: etat.current.zoom, tx: etat.current.tx, ty: etat.current.ty };
      setActif(true);
    },
    onUpdate: (e) => appliquer(etat.current.zoom, debut.current.tx + e.translationX, debut.current.ty + e.translationY),
    onFinalize: () => setActif(false),
  });
  const pincement = usePinchGesture({
    runOnJS: true,
    onBegin: () => {
      debut.current = { zoom: etat.current.zoom, tx: etat.current.tx, ty: etat.current.ty };
      setActif(true);
    },
    onUpdate: (e) => appliquer(debut.current.zoom * e.scale, etat.current.tx, etat.current.ty),
    onFinalize: () => setActif(false),
  });
  const geste = useSimultaneousGestures(pan, pincement);

  const s0 = echelleBase(largeur, hauteur, d);
  const styleImage = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }],
  }));

  const cx = zone.w / 2;
  const cy = zone.h / 2;
  const r = d / 2;
  // Un rectangle plein avec un trou rond (règle « pair-impair ») : le voile couvre tout sauf le cercle
  const trou = `M0 0H${zone.w}V${zone.h}H0Z M${cx - r} ${cy}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 ${-d} 0Z`;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onAnnuler}>
      <GestureHandlerRootView style={styles.racine}>
        <View style={{ height: haut + 8 }} />
        <GestureDetector gesture={geste}>
          <View
            style={styles.zone}
            onLayout={(e) => setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            accessible
            accessibilityLabel="Recadrage de la photo de profil. Glisse pour déplacer la photo, pince pour zoomer."
            accessibilityActions={[
              { name: 'increment', label: 'Zoomer' },
              { name: 'decrement', label: 'Dézoomer' },
            ]}
            onAccessibilityAction={(e) => appliquer(etat.current.zoom * (e.nativeEvent.actionName === 'increment' ? 1.25 : 0.8), etat.current.tx, etat.current.ty)}
          >
            {zone.w > 0 ? (
              <>
                <Animated.Image
                  source={{ uri }}
                  resizeMode="cover"
                  style={[{ position: 'absolute', width: largeur * s0, height: hauteur * s0, left: cx - (largeur * s0) / 2, top: cy - (hauteur * s0) / 2 }, styleImage]}
                />
                <Svg width={zone.w} height={zone.h} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Path d={trou} fill={FOND_VOILE} fillRule="evenodd" />
                  {actif ? (
                    <>
                      <Defs>
                        <ClipPath id="rond">
                          <Circle cx={cx} cy={cy} r={r} />
                        </ClipPath>
                      </Defs>
                      {[1, 2].map((i) => (
                        <Line key={`v${i}`} x1={cx - r + (d * i) / 3} y1={cy - r} x2={cx - r + (d * i) / 3} y2={cy + r} stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1} clipPath="url(#rond)" />
                      ))}
                      {[1, 2].map((i) => (
                        <Line key={`h${i}`} x1={cx - r} y1={cy - r + (d * i) / 3} x2={cx + r} y2={cy - r + (d * i) / 3} stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1} clipPath="url(#rond)" />
                      ))}
                    </>
                  ) : null}
                  <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeWidth={2} />
                </Svg>
              </>
            ) : null}
          </View>
        </GestureDetector>
        <View style={[styles.barre, { paddingBottom: bas + 8 }]}>
          <Pressable onPress={onAnnuler} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.action}>
            <Text style={styles.texte}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={() => onValider(rectangleDecoupe(etat.current))}
            accessibilityRole="button"
            accessibilityLabel="Choisir cette photo"
            style={styles.action}
          >
            <Text style={[styles.texte, styles.choisir]}>Choisir</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: '#000000' },
  zone: { flex: 1, overflow: 'hidden' },
  barre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#111111' },
  action: { minHeight: 44, minWidth: 88, paddingHorizontal: 12, justifyContent: 'center' },
  texte: { fontFamily: police.texte600, fontSize: 16, color: '#f3f2ee' },
  choisir: { textAlign: 'right' },
});
