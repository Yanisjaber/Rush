import Svg, { Circle, Path } from 'react-native-svg';
import { familleAffichage } from '@/data/familles';
import { couleurSport } from '@/theme/sports';
import { usePalette } from '@/theme/usePalette';

// Le petit logo d'un sport (course, vélo, natation, muscu, Hyrox, autre), en traits, dans la couleur du sport.
// Dessiné à la main sur une grille de 24 : simple et lisible dès 16 pt. Décoratif : le nom du sport est toujours écrit à côté.
interface Props {
  /** Le sport brut (Run, Ride…) ou une famille (course, velo…). */
  sport: string;
  taille?: number;
}

type Dessin = 'course' | 'velo' | 'natation' | 'muscu' | 'hyrox' | 'autre';
const DESSIN: Record<string, Dessin> = { course: 'course', velo: 'velo', natation: 'natation', muscu: 'muscu', hyrox: 'hyrox', crossfit: 'hyrox' };

export function IconeSport({ sport, taille = 18 }: Props) {
  const p = usePalette();
  const famille = familleAffichage(sport) === 'autre' ? sport : familleAffichage(sport);
  const dessin: Dessin = DESSIN[familleAffichage(sport)] ?? DESSIN[sport] ?? 'autre';
  const couleur = couleurSport(p, familleAffichage(sport) === 'autre' ? sport : famille);
  const trait = { stroke: couleur, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {dessin === 'course' ? (
        <>
          <Circle cx={15} cy={4.5} r={2} {...trait} />
          <Path d="M13 8.5 L9.5 12.5 L12.5 15 L11 20 M9.5 12.5 L6 12 M13 8.5 L17 10.5 L19 9 M12.5 15 L16.5 16.5 L17 20" {...trait} />
        </>
      ) : dessin === 'velo' ? (
        <>
          <Circle cx={6} cy={16} r={3.5} {...trait} />
          <Circle cx={18} cy={16} r={3.5} {...trait} />
          <Path d="M6 16 L9.5 9.5 H15 L18 16 M9.5 9.5 L12.5 16 L15 9.5 M15 9.5 L14 7 H16" {...trait} />
        </>
      ) : dessin === 'natation' ? (
        <>
          <Circle cx={17} cy={6.5} r={2} {...trait} />
          <Path d="M4 11.5 L10 8.5 L14.5 11 M3 16 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0 M3 20 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0" {...trait} />
        </>
      ) : dessin === 'muscu' ? (
        <Path d="M6.5 7.5 V16.5 M17.5 7.5 V16.5 M3.5 10 V14 M20.5 10 V14 M6.5 12 H17.5" {...trait} />
      ) : dessin === 'hyrox' ? (
        <>
          <Circle cx={12} cy={15} r={5.5} {...trait} />
          <Path d="M8.5 10 a3.5 4 0 0 1 7 0" {...trait} />
        </>
      ) : (
        <Path d="M13 3 L6 13.5 H11 L10 21 L18 10.5 H13 Z" {...trait} />
      )}
    </Svg>
  );
}
