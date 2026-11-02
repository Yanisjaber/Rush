import { Fragment } from 'react';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import type { RepereRecit } from '@/data/bilan/recit-niveau';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le score global année après année, en récit : une aire pâle sous la courbe, la ligne des 100 en pointillés, et quelques repères écrits
// (creux, reprise, record : voir data/bilan/recit-niveau.ts) au lieu d'un chiffre sur chaque point. Première et dernière années sous la courbe.
interface Props {
  points: { an: number; score: number }[];
  reperes: RepereRecit[];
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LARGEUR = 334;
const HAUTEUR = 200;
const HAUT = 30;
const BAS = 176;
const MARGE = 10;

export function CourbeGlobale({ points, reperes, couleur, etiquette }: Props) {
  const p = usePalette();
  const min = Math.max(0, Math.floor((Math.min(...points.map((pt) => pt.score)) - 10) / 10) * 10);
  // Chaque point est placé selon son année (pas son rang) : une année sans score laisse un trou visible
  const premier = points[0]?.an ?? 0;
  const dernier = points[points.length - 1]?.an ?? premier;
  const etendue = dernier - premier;
  const x = (an: number): number => MARGE + (etendue === 0 ? 0.5 : (an - premier) / etendue) * (LARGEUR - 2 * MARGE);
  const y = (v: number): number => HAUT + ((100 - v) / (100 - min)) * (BAS - HAUT);
  const ligne = points.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.an)} ${y(pt.score)}`).join(' ');
  const aire = points.length > 1 ? `${ligne} L${x(dernier)} ${BAS} L${x(premier)} ${BAS} Z` : '';
  // Le texte d'un repère : calé à gauche près du bord gauche, à droite près du bord droit, centré ailleurs
  const ancre = (an: number): 'start' | 'middle' | 'end' => (x(an) < 60 ? 'start' : x(an) > LARGEUR - 60 ? 'end' : 'middle');
  const decalage = (an: number): number => (ancre(an) === 'start' ? -4 : ancre(an) === 'end' ? 4 : 0);

  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
      <Line x1={0} x2={LARGEUR} y1={y(100)} y2={y(100)} stroke={p.trait} strokeWidth={1} strokeDasharray="3 4" />
      {aire ? <Path d={aire} fill={couleur} fillOpacity={0.12} /> : null}
      {points.length > 1 ? <Path d={ligne} fill="none" stroke={couleur} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {points.length === 1 ? <Circle cx={x(premier)} cy={y(points[0].score)} r={4.5} fill={couleur} /> : null}
      {reperes.map((r) => {
        const cx = x(r.an);
        const cy = y(r.score);
        const tx = cx + decalage(r.an);
        // Au-dessus : titre puis détail, au-dessus du point ; en dessous : titre puis détail, sous le point
        // (un sommet trop près du haut du dessin s'écrit en dessous, pour ne pas être coupé)
        const y1 = r.dessus && cy - 26 >= 14 ? cy - 26 : cy + 22;
        return (
          <Fragment key={`${r.titre}-${r.an}`}>
            <Circle cx={cx} cy={cy} r={4.5} fill={p.surface} stroke={p.texte} strokeWidth={2} />
            <TexteSvg x={tx} y={y1} fontSize={12} fontFamily={police.texte600} fill={p.texte} textAnchor={ancre(r.an)}>{r.titre}</TexteSvg>
            <TexteSvg x={tx} y={y1 + 14} fontSize={12} fontFamily={police.texte400} fill={p.texteDoux} textAnchor={ancre(r.an)}>{r.detail}</TexteSvg>
          </Fragment>
        );
      })}
      <TexteSvg x={x(premier) - MARGE + 2} y={HAUTEUR - 4} fontSize={12} fontFamily={police.texte500} fill={p.texteMuet} textAnchor="start">{premier}</TexteSvg>
      {etendue > 0 ? <TexteSvg x={x(dernier) + MARGE - 2} y={HAUTEUR - 4} fontSize={12} fontFamily={police.texte500} fill={p.texteMuet} textAnchor="end">{dernier}</TexteSvg> : null}
    </Svg>
  );
}
