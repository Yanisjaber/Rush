import { Fragment } from 'react';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { amincirReperes } from '@/data/bilan/niveau-annees-affichage';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le score global année après année : une courbe de 0 à 100, la ligne des 100 en pointillés, le score écrit au-dessus de chaque point et le meilleur année cerclé.
interface Props {
  points: { an: number; score: number }[];
  meilleurAn: number;
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LARGEUR = 300;
const HAUTEUR = 170;
const G = 34;
const D = 14;
const H = 22;
const B = 26;
const MARGE = 14;

export function CourbeGlobale({ points, meilleurAn, couleur, etiquette }: Props) {
  const p = usePalette();
  const plusBas = Math.min(...points.map((pt) => pt.score)) - 10;
  const pas = 100 - plusBas > 50 ? 20 : 10;
  const min = Math.max(0, Math.floor(plusBas / pas) * pas);
  // Un peu d'air de chaque côté : le premier point ne touche pas l'axe, le dernier ne sort pas du cadre
  const x = (i: number): number => G + MARGE + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (LARGEUR - G - D - 2 * MARGE);
  const y = (v: number): number => H + ((100 - v) / (100 - min)) * (HAUTEUR - H - B);
  // Les années écrites sous la courbe : une sur deux quand elles se serrent (le score, lui, reste écrit sur chaque point)
  const anneesEcrites = new Set(amincirReperes(points.map((pt, i) => ({ an: pt.an, x: x(i) })), 36).map((r) => r.an));
  const reperes: number[] = [];
  for (let v = min; v <= 100; v += pas) reperes.push(v);

  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
      {reperes.map((v) => (
        <Fragment key={v}>
          <Line x1={G} x2={LARGEUR - D} y1={y(v)} y2={y(v)} stroke={v === 100 ? couleur : p.trait} strokeWidth={v === 100 ? 1.4 : 1} strokeDasharray={v === 100 ? '4 4' : undefined} />
          <TexteSvg x={G - 7} y={y(v) + 4} fontSize={12} fontFamily={v === 100 ? police.texte600 : police.texte400} fill={v === 100 ? couleur : p.texteMuet} textAnchor="end">{v}</TexteSvg>
        </Fragment>
      ))}
      {points.length > 1 ? (
        <Path d={points.map((pt, i) => `${i ? 'L' : 'M'}${x(i)} ${y(pt.score)}`).join(' ')} fill="none" stroke={couleur} strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {points.map((pt, i) => (
        <Fragment key={pt.an}>
          <Circle cx={x(i)} cy={y(pt.score)} r={4.4} fill={couleur} />
          {pt.an === meilleurAn ? <Circle cx={x(i)} cy={y(pt.score)} r={8} fill="none" stroke={p.texte} strokeWidth={1.5} /> : null}
          <TexteSvg x={x(i)} y={y(pt.score) - 11} fontSize={12} fontFamily={police.texte600} fill={p.texte} textAnchor="middle">{Math.round(pt.score)}</TexteSvg>
          {anneesEcrites.has(pt.an) ? <TexteSvg x={x(i)} y={HAUTEUR - 6} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{pt.an}</TexteSvg> : null}
        </Fragment>
      ))}
    </Svg>
  );
}
