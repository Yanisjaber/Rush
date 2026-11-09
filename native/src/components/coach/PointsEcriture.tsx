import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { usePalette } from '@/theme/usePalette';

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
  return (
    <View accessible accessibilityLabel="Le coach écrit" style={styles.ligne}>
      {[0, 1, 2].map((i) => (
        <Point key={i} rang={i} couleur={p.texteDoux} anime={!reduit} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 24, paddingHorizontal: 4 },
  point: { width: 9, height: 9, borderRadius: 5 },
});
