import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { aireSousCourbe, echelle, lisse } from '@/data/outils/courbes';
import { formatKm, formatNombre } from '@/data/outils/format';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le profil d'altitude avec un curseur qu'on glisse au doigt : il donne la distance et l'altitude du point touché, et prévient la carte (`onChange`, fraction de 0 à 1 de la distance).
// Au départ, le curseur est posé sur le point le plus haut. Au clavier ou à VoiceOver : « augmenter » et « diminuer » le déplacent d'un pas.
interface Props {
  profil: number[];
  min: number;
  max: number;
  /** Longueur du parcours en km (pour la distance du curseur et l'axe). */
  km: number | null;
  couleur: string;
  hauteur?: number;
  onChange?: (fraction: number) => void;
}

export function ProfilCurseur({ profil, min, max, km, couleur, hauteur = 110, onChange }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const n = profil.length;
  const indexHaut = useMemo(() => profil.indexOf(Math.max(...profil)), [profil]);
  const [index, setIndex] = useState(indexHaut);
  const [touche, setTouche] = useState(false); // le curseur a-t-il déjà bougé ? (sinon on dit « point haut »)
  const refs = useRef({ largeur: 0, n, onChange });
  refs.current = { largeur, n, onChange };

  // Le curseur démarre sur le point haut : on prévient la carte une fois
  useEffect(() => {
    onChange?.(n > 1 ? indexHaut / (n - 1) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexHaut, n]);

  const aller = (i: number) => {
    const borne = Math.min(refs.current.n - 1, Math.max(0, Math.round(i)));
    setIndex(borne);
    setTouche(true);
    refs.current.onChange?.(refs.current.n > 1 ? borne / (refs.current.n - 1) : 0);
  };
  const versX = (x: number) => {
    const { largeur: l, n: total } = refs.current;
    if (l <= 0 || total < 2) return 0;
    return ((x - MARGE) / (l - 2 * MARGE)) * (total - 1);
  };

  const gestes = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => aller(versX(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => aller(versX(e.nativeEvent.locationX)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const points = largeur > 0 ? echelle(profil, largeur, hauteur, MARGE, min, max) : [];
  const ligne = lisse(points);
  const zone = aireSousCourbe(ligne, points, hauteur);
  const curseur = points[index];
  const distance = km != null && km > 0 && n > 1 ? (index / (n - 1)) * km : null;
  const altitude = profil[index];
  const idFondu = 'fondu-curseur';

  return (
    <View>
      <View style={styles.ligne}>
        <Text style={[typo.micro, { color: p.texteMuet, letterSpacing: 1.2 }]}>PROFIL D'ALTITUDE</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>
          {distance != null ? `km ${formatKm(distance, 1)} · ` : ''}
          {formatNombre(altitude ?? min)} m{!touche ? ' (point haut)' : ''}
        </Text>
      </View>
      <View
        {...gestes.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Profil d'altitude, de ${formatNombre(min)} à ${formatNombre(max)} mètres`}
        accessibilityValue={{ text: `${distance != null ? `kilomètre ${formatKm(distance, 1)}, ` : ''}${formatNombre(altitude ?? min)} mètres` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => aller(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1) * Math.max(1, Math.round(n / 20)))}
        style={{ height: hauteur }}
      >
        {largeur > 0 ? (
          <Svg width={largeur} height={hauteur} pointerEvents="none">
            <Defs>
              <LinearGradient id={idFondu} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={couleur} stopOpacity={0.35} />
                <Stop offset="1" stopColor={couleur} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {zone ? <Path d={zone} fill={`url(#${idFondu})`} /> : null}
            {ligne ? <Path d={ligne} fill="none" stroke={couleur} strokeWidth={2.6} strokeLinecap="round" /> : null}
            {curseur ? (
              <>
                <Line x1={curseur[0]} y1={0} x2={curseur[0]} y2={hauteur} stroke={p.texte} strokeWidth={1.5} />
                <Circle cx={curseur[0]} cy={curseur[1]} r={6} fill={p.texte} stroke={couleur} strokeWidth={3} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
      {km != null && km > 0 ? (
        <View style={styles.ligne}>
          <Text style={[typo.petit, { color: p.texteMuet }]}>0 km</Text>
          <Text style={[typo.petit, { color: p.texteMuet }]}>{formatKm(km, km >= 100 ? 0 : 1)} km</Text>
        </View>
      ) : null}
    </View>
  );
}

const MARGE = 6;

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
