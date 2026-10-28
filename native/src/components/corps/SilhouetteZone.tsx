import Svg, { Circle, Path } from 'react-native-svg';
import { ZONES } from '@/data/sante/sante-notes';
import { usePalette } from '@/theme/usePalette';

// Une petite silhouette de face : la zone choisie s'allume d'un point corail. Elle ne se touche pas (on choisit dans le menu), elle montre où ça fait mal.
export function SilhouetteZone({ zone }: { zone?: string }) {
  const p = usePalette();
  const z = ZONES.find((x) => x.cle === zone);
  return (
    <Svg width={96} height={150} viewBox="0 0 96 150" accessibilityLabel={z ? `Zone touchée : ${z.nom}` : 'Silhouette'}>
      <Circle cx={48} cy={14} r={9} fill="none" stroke={p.contourChamp} strokeWidth={1.5} />
      <Path d="M34 28h28l6 6 4 38-6 2-3-24-2 30 3 44h-9l-4-42-4 42h-9l3-44-2-30-3 24-6-2 4-38z" fill="none" stroke={p.contourChamp} strokeWidth={1.5} strokeLinejoin="round" />
      {z ? (
        <>
          <Circle cx={z.x} cy={z.y} r={11} fill={p.sportMuscu} opacity={0.25} />
          <Circle cx={z.x} cy={z.y} r={6} fill={p.sportMuscu} />
        </>
      ) : null}
    </Svg>
  );
}
