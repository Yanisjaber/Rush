import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Sur iOS 26 et plus : le vrai symbole d'Apple « ellipsis » (trois points) animé par le système (effet « variableColor », les points s'allument l'un après l'autre).
// Sinon, ou si le module natif est absent (app non recompilée), on garde les trois points dessinés et animés plus bas.
type Natif = { ui: typeof import('@expo/ui/swift-ui'); modifs: typeof import('@expo/ui/swift-ui/modifiers') };
function chargerNatif(): Natif | null {
  try {
    const { isLiquidGlassAvailable } = require('expo-glass-effect') as typeof import('expo-glass-effect');
    if (!isLiquidGlassAvailable()) return null;
    return { ui: require('@expo/ui/swift-ui'), modifs: require('@expo/ui/swift-ui/modifiers') };
  } catch {
    return null;
  }
}
const NATIF = chargerNatif();

// Les trois points de « le coach écrit », comme dans Messages d'iOS : ils s'allument l'un après l'autre en boucle.
// Avec « réduire les animations » activé, ils restent fixes.
const DUREE = 420;
const DECALAGE = 160;

function Point({ rang, couleur, anime }: { rang: number; couleur: string; anime: boolean }) {
  const niveau = useSharedValue(0.35);
  useEffect(() => {
    if (!anime) {
      niveau.value = 0.6;
      return;
    }
    niveau.value = withDelay(
      rang * DECALAGE,
      withRepeat(withSequence(withTiming(1, { duration: DUREE, easing: Easing.inOut(Easing.quad) }), withTiming(0.35, { duration: DUREE, easing: Easing.inOut(Easing.quad) }), withTiming(0.35, { duration: DECALAGE * 2 })), -1),
    );
    return () => cancelAnimation(niveau);
  }, [anime, niveau, rang]);
  const style = useAnimatedStyle(() => ({ opacity: niveau.value, transform: [{ scale: 0.85 + 0.15 * ((niveau.value - 0.35) / 0.65) }] }));
  return <Animated.View style={[styles.point, { backgroundColor: couleur }, style]} />;
}

export function PointsEcriture() {
  const p = usePalette();
  const reduit = useReducedMotion();
  if (NATIF) {
    const { Host, Image } = NATIF.ui;
    const { symbolEffect } = NATIF.modifs;
    return (
      <View accessible accessibilityLabel="Le coach écrit" style={styles.natif}>
        <Host matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
          <Image
            systemName="ellipsis"
            size={26}
            color={p.texteDoux}
            modifiers={reduit ? [] : [symbolEffect({ effect: 'variableColor', fillStyle: 'iterative', inactiveLayers: 'dim' }, { options: { repeat: 'continuous' } })]}
          />
        </Host>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel="Le coach écrit" style={styles.ligne}>
      {[0, 1, 2].map((i) => (
        <Point key={i} rang={i} couleur={p.texteDoux} anime={!reduit} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  natif: { minHeight: 24, justifyContent: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 24, paddingHorizontal: 4 },
  point: { width: 9, height: 9, borderRadius: 5 },
});
