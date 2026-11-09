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
            <Line x1={0} y1={hauteur - 1} x2={largeur} y2={hauteur - 1} stroke={p.trait} strokeWidth={1} />
            <Line x1={0} y1={hauteur / 2} x2={largeur} y2={hauteur / 2} stroke={p.trait} strokeWidth={1} strokeDasharray="3 4" />
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
        // Les repères de la maquette : départ, milieu et arrivée, petits et discrets (le « km » n'est dit qu'au départ)
        <View style={[styles.axe, { paddingHorizontal: MARGE }]}>
          <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'left' }]}>0 km</Text>
          <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'center' }]}>{formatKm(km / 2, km >= 100 ? 0 : 1)}</Text>
          <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'right' }]}>{formatKm(km, km >= 100 ? 0 : 1)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const MARGE = 12; // assez pour que le rond du curseur (rayon 6 + contour 3) ne soit jamais coupé, au point haut comme au point bas

const styles = StyleSheet.create({
  axe: { flexDirection: 'row', marginTop: 4 },
  repere: { flex: 1, fontSize: 11, lineHeight: 14 },
});
