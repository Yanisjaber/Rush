import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { usePalette } from '@/theme/usePalette';

// Anneau segmenté (répartition entre sports, score…). Le contenu du centre se passe en enfant.
// Port de components/charts/Anneau.svelte : même géométrie, même petit vide entre deux arcs.
interface Segment {
  valeur: number;
  couleur: string;
}
interface Props {
  segments: Segment[];
  taille?: number;
  epaisseur?: number;
  /** Valeur d'un tour complet (score sur 100…). Par défaut : la somme des segments. */
  total?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
  children?: ReactNode;
}

const RAYON = 54;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

export function Anneau({ segments, taille = 160, epaisseur = 16, total, etiquette, children }: Props) {
  const p = usePalette();
  const somme = total ?? (segments.reduce((s, x) => s + x.valeur, 0) || 1);

  // Chaque segment : longueur de l'arc et décalage de départ, avec un petit vide entre deux arcs
  let cumul = 0;
  const arcs = segments.map((s) => {
    const longueur = Math.max((s.valeur / somme) * CIRCONFERENCE - 3, 0);
    const depart = cumul;
    cumul += (s.valeur / somme) * CIRCONFERENCE;
    return { couleur: s.couleur, longueur, decalage: -depart };
  });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille} viewBox="0 0 140 140">
        <G rotation={-90} originX={70} originY={70}>
          <Circle cx={70} cy={70} r={RAYON} fill="none" stroke={p.surface2} strokeWidth={epaisseur} />
          {arcs.map((a, i) => (
            <Circle
              key={i}
              cx={70}
              cy={70}
              r={RAYON}
              fill="none"
              stroke={a.couleur}
              strokeWidth={epaisseur}
              strokeDasharray={`${a.longueur.toFixed(1)} ${(CIRCONFERENCE - a.longueur).toFixed(1)}`}
              strokeDashoffset={a.decalage}
            />
          ))}
        </G>
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
