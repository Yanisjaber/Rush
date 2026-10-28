import Svg, { Circle, Path } from 'react-native-svg';
import { echelle, lisse } from '@/data/outils/courbes';
import { usePalette } from '@/theme/usePalette';

// Deux courbes sur la même échelle : la principale en trait plein, la secondaire en tirets (la condition et la fatigue, ton test et ton objectif…).
// Un point sur la dernière valeur de chacune.
interface Props {
  principale: number[];
  secondaire: number[];
  /** Couleur du trait plein (par défaut le texte). */
  couleur?: string;
  largeur?: number;
  hauteur?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

export function DeuxCourbes({ principale, secondaire, couleur, largeur = 300, hauteur = 90, etiquette }: Props) {
  const p = usePalette();
  const tout = [...principale, ...secondaire];
  const min = Math.min(...tout);
  const max = Math.max(...tout);
  const ptsC = echelle(principale, largeur, hauteur, 8, min, max);
  const ptsF = echelle(secondaire, largeur, hauteur, 8, min, max);
  const finC = ptsC[ptsC.length - 1];
  const finF = ptsF[ptsF.length - 1];
  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${largeur} ${hauteur}`} style={{ aspectRatio: largeur / hauteur }}>
      <Path d={lisse(ptsF)} fill="none" stroke={p.texteDoux} strokeWidth={2.4} strokeDasharray="6 5" strokeLinecap="round" />
      <Path d={lisse(ptsC)} fill="none" stroke={couleur ?? p.texte} strokeWidth={3} strokeLinecap="round" />
      {finF ? <Circle cx={finF[0]} cy={finF[1]} r={4} fill={p.texteDoux} /> : null}
      {finC ? <Circle cx={finC[0]} cy={finC[1]} r={4.5} fill={couleur ?? p.texte} /> : null}
    </Svg>
  );
}
