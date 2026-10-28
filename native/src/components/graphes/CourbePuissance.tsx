import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { echelleRonde } from '@/data/outils/echelle';
import { formatNum } from '@/data/outils/format';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de puissance : la meilleure puissance de chaque durée (5 s, 1 min, 5 min, 20 min, 1 h), les durées sur une échelle logarithmique (comme partout en cyclisme :
// les efforts courts seraient sinon écrasés). La courbe pleine est la période choisie, les pointillés l'autre période. Une durée sans valeur n'a pas de point.
export interface PointPuissance {
  secondes: number;
  court: string;
  watts: number | null;
}

interface Props {
  courbe: PointPuissance[];
  /** L'autre période, en pointillés. */
  autre?: PointPuissance[];
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LARGEUR = 330;
const HAUTEUR = 168;
const GAUCHE = 38;
const BAS = 24; // la ligne de base, au-dessus des durées écrites
const HAUT = 16; // la place de la valeur du point le plus haut

export function CourbePuissance({ courbe, autre, couleur, etiquette }: Props) {
  const p = usePalette();
  const valeurs = [...courbe, ...(autre ?? [])].map((c) => c.watts ?? 0);
  const { haut, pas } = echelleRonde(Math.max(0, ...valeurs));
  const plafond = Math.max(1, haut);
  // Le premier point est décalé de 16 pt : sa valeur écrite au-dessus ne doit pas toucher celles de l'échelle
  const x = (s: number) => GAUCHE + 16 + ((Math.log(s) - Math.log(5)) / (Math.log(3600) - Math.log(5))) * (LARGEUR - GAUCHE - 30);
  const y = (w: number) => HAUTEUR - BAS - (w / plafond) * (HAUTEUR - BAS - HAUT);
  const trace = (c: PointPuissance[]) =>
    c
      .filter((pt) => pt.watts != null)
      .map((pt, i) => `${i ? 'L' : 'M'}${x(pt.secondes).toFixed(1)} ${y(pt.watts as number).toFixed(1)}`)
      .join(' ');
  const reperes = pas > 0 ? [0, pas, 2 * pas, 3 * pas] : [];
  const points = courbe.filter((pt) => pt.watts != null);
  const dessin = trace(courbe);
  return (
    <Svg width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }} accessible accessibilityRole="image" accessibilityLabel={etiquette}>
      {reperes.map((w) => (
        <Line key={w} x1={GAUCHE - 4} x2={LARGEUR} y1={y(w)} y2={y(w)} stroke={p.trait} strokeWidth={1} />
      ))}
      {reperes.map((w) => (
        <TexteSvg key={`v${w}`} x={GAUCHE - 8} y={y(w) + 3} fontSize={9.5} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">
          {formatNum(w, 0)}
        </TexteSvg>
      ))}
      {autre && trace(autre) ? <Path d={trace(autre)} fill="none" stroke={p.texteMuet} strokeWidth={1.8} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {points.length > 1 ? <Path d={`${dessin} L${x(points[points.length - 1].secondes).toFixed(1)} ${y(0)} L${x(points[0].secondes).toFixed(1)} ${y(0)} Z`} fill={couleur} fillOpacity={0.14} /> : null}
      {dessin ? <Path d={dessin} fill="none" stroke={couleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {points.map((pt) => (
        <Circle key={pt.secondes} cx={x(pt.secondes)} cy={y(pt.watts as number)} r={4} fill={couleur} stroke={p.surface} strokeWidth={2} />
      ))}
      {points.map((pt) => (
        <TexteSvg key={`t${pt.secondes}`} x={x(pt.secondes)} y={y(pt.watts as number) - 9} fontSize={10.5} fontFamily={police.titre700} fill={p.texte} textAnchor="middle">
          {formatNum(pt.watts as number, 0)}
        </TexteSvg>
      ))}
      {courbe.map((pt) => (
        <TexteSvg key={`d${pt.secondes}`} x={x(pt.secondes)} y={HAUTEUR - 6} fontSize={10.5} fontFamily={police.texte400} fill={p.texteDoux} textAnchor="middle">
          {pt.court}
        </TexteSvg>
      ))}
    </Svg>
  );
}
