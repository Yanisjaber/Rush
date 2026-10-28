import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { aireSousCourbe, echelle, lisse } from '@/data/outils/courbes';

// Courbe lissée avec un fondu qui s'efface sous la courbe et un point sur la dernière valeur.
// Port de components/charts/CourbeLissee.svelte. `etiquette` décrit le graphique pour VoiceOver.
interface Props {
  valeurs: number[];
  couleur: string;
  largeur?: number;
  hauteur?: number;
  marge?: number;
  epaisseur?: number;
  aire?: boolean;
  pointFinal?: boolean;
  min?: number;
  max?: number;
  etiquette: string;
}

export function CourbeLissee({ valeurs, couleur, largeur = 300, hauteur = 80, marge = 6, epaisseur = 2.6, aire = true, pointFinal = true, min, max, etiquette }: Props) {
  // Identifiant propre à ce graphique (le fondu SVG en a besoin, plusieurs graphiques coexistent)
  const idFondu = `fondu-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const points = echelle(valeurs, largeur, hauteur, marge, min, max);
  const ligne = lisse(points);
  const zone = aireSousCourbe(ligne, points, hauteur);
  const dernier = points[points.length - 1];

  return (
    <Svg
      accessible
      accessibilityRole="image"
      accessibilityLabel={etiquette}
      width="100%"
      viewBox={`0 0 ${largeur} ${hauteur}`}
      style={{ aspectRatio: largeur / hauteur }}
    >
      <Defs>
        <LinearGradient id={idFondu} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={couleur} stopOpacity={0.35} />
          <Stop offset="1" stopColor={couleur} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {aire && zone ? <Path d={zone} fill={`url(#${idFondu})`} /> : null}
      {ligne ? <Path d={ligne} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" /> : null}
      {pointFinal && dernier ? <Circle cx={dernier[0]} cy={dernier[1]} r={4.5} fill={couleur} /> : null}
    </Svg>
  );
}
