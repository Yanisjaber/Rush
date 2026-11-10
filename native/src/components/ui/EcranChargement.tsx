import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Écran de chargement du démarrage : « À vos marques » → « Prêt » → « Rush » (en orange course), comme un départ de course.
// Il passe par-dessus l'app le temps que la session soit lue, puis s'efface en fondu.
// Toute l'animation tourne sur le fil natif (une seule valeur 0 → 1 qui pilote les trois mots) : même quand l'app monte
// l'Accueil et lance ses requêtes, elle ne prend pas de retard, ce que faisaient des minuteries JS.
const MOTS = ['À vos marques', 'Prêt', 'Rush'] as const;
const DUREE_SEQUENCE = 2350; // ms, du premier mot à « Rush » affiché
const FONDU_SORTIE = 150; // 2350 + 150 = 2,5 s au total, au minimum
// Tranche de la ligne de temps (0 → 1) où chaque mot est visible ; le dernier reste jusqu'à la fin
const TRANCHES: [number, number][] = [
  [0, 0.38],
  [0.38, 0.7],
  [0.7, 1],
];

export function EcranChargement({ pret, onFin }: { pret: boolean; onFin: () => void }) {
  const p = usePalette();
  const temps = useRef(new Animated.Value(0)).current;
  const opaciteEcran = useRef(new Animated.Value(1)).current;
  const [sequenceFinie, setSequenceFinie] = useState(false);

  useEffect(() => {
    let annule = false;
    // Mouvement réduit (réglage d'accessibilité) : « Rush » directement, sans enchaînement
    void AccessibilityInfo.isReduceMotionEnabled().then((reduit) => {
      if (annule) return;
      if (reduit) {
        temps.setValue(1);
        setSequenceFinie(true);
        return;
      }
      Animated.timing(temps, { toValue: 1, duration: DUREE_SEQUENCE, easing: Easing.linear, useNativeDriver: true }).start(() => {
        if (!annule) setSequenceFinie(true);
      });
    });
    return () => {
      annule = true;
    };
  }, [temps]);

  // Séquence terminée ET app prête : fondu de sortie, puis on retire l'écran
  useEffect(() => {
    if (!sequenceFinie || !pret) return;
    Animated.timing(opaciteEcran, { toValue: 0, duration: FONDU_SORTIE, useNativeDriver: true }).start(() => onFin());
  }, [sequenceFinie, pret, opaciteEcran, onFin]);

  return (
    <Animated.View accessible accessibilityLabel="Rush, chargement" style={[styles.page, { backgroundColor: p.fond, opacity: opaciteEcran }]}>
      <View style={styles.centre}>
        {MOTS.map((mot, i) => {
          const [debut, fin] = TRANCHES[i];
          const dernier = i === MOTS.length - 1;
          const marge = 0.06;
          // Apparaît en fondu au début de sa tranche, disparaît à la fin (sauf « Rush », qui reste)
          const opacite = temps.interpolate(
            dernier ? { inputRange: [debut - marge, debut, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' } : i === 0 ? { inputRange: [0, fin - marge, fin], outputRange: [1, 1, 0], extrapolate: 'clamp' } : { inputRange: [debut - marge, debut, fin - marge, fin], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' },
          );
          return (
            <Animated.Text
              key={mot}
              style={[dernier ? styles.grand : styles.mot, styles.empile, { color: dernier ? p.sportCourse : p.texteDoux, opacity: opacite }]}
            >
              {mot}
            </Animated.Text>
          );
        })}
      </View>
      <Text style={[styles.pied, { color: p.texteDoux }]}>CHARGEMENT…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, zIndex: 10 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empile: { position: 'absolute' },
  mot: { fontFamily: police.titre800, fontSize: 30, lineHeight: 34 },
  grand: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60 },
  pied: { position: 'absolute', bottom: 56, alignSelf: 'center', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 1 },
});
