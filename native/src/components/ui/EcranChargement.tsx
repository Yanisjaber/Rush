import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Écran de chargement du démarrage : « À vos marques » → « Prêt » → « Rush » (en orange course), comme un départ de course.
// Il passe par-dessus l'app le temps que la session soit lue, puis s'efface en fondu.
const MOTS = ['À vos marques', 'Prêt', 'Rush'] as const;
// Durée d'affichage des deux premiers mots (ms) ; le dernier reste jusqu'à ce que tout soit prêt.
const DUREES = [500, 450];
const FONDU_SORTIE = 350;

export function EcranChargement({ pret, onFin }: { pret: boolean; onFin: () => void }) {
  const p = usePalette();
  const [etape, setEtape] = useState(0);
  const [sequenceFinie, setSequenceFinie] = useState(false);
  const opaciteMot = useRef(new Animated.Value(0)).current;
  const opaciteEcran = useRef(new Animated.Value(1)).current;
  const reduit = useRef(false);

  // Mouvement réduit (réglage d'accessibilité) : on montre directement « Rush », sans enchaînement
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduit.current = v;
      if (v) setEtape(MOTS.length - 1);
    });
  }, []);

  // Chaque mot apparaît en fondu, puis le suivant prend la place
  useEffect(() => {
    opaciteMot.setValue(0);
    Animated.timing(opaciteMot, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (etape >= MOTS.length - 1) {
      const t = setTimeout(() => setSequenceFinie(true), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setEtape((e) => e + 1), DUREES[etape]);
    return () => clearTimeout(t);
  }, [etape, opaciteMot]);

  // Séquence terminée ET app prête : fondu de sortie, puis on retire l'écran
  useEffect(() => {
    if (!sequenceFinie || !pret) return;
    Animated.timing(opaciteEcran, { toValue: 0, duration: FONDU_SORTIE, useNativeDriver: true }).start(() => onFin());
  }, [sequenceFinie, pret, opaciteEcran, onFin]);

  const dernier = etape === MOTS.length - 1;
  return (
    <Animated.View
      accessible
      accessibilityLabel="Rush, chargement"
      style={[styles.page, { backgroundColor: p.fond, opacity: opaciteEcran }]}
    >
      <View style={styles.centre}>
        <Animated.Text
          style={[
            dernier ? styles.grand : styles.mot,
            { color: dernier ? p.sportCourse : p.texteDoux, opacity: opaciteMot, transform: [{ translateY: opaciteMot.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
          ]}
        >
          {MOTS[etape]}
        </Animated.Text>
      </View>
      <Text style={[styles.pied, { color: p.texteDoux }]}>CHARGEMENT…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, zIndex: 10 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mot: { fontFamily: police.titre800, fontSize: 30, lineHeight: 34 },
  grand: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60 },
  pied: { position: 'absolute', bottom: 56, alignSelf: 'center', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 1 },
});
