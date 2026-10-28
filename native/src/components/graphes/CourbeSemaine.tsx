import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La semaine type : une courbe sur 7 jours (lundi → dimanche), une zone teintée dessous, la moyenne en pointillés, et le jour fort mis en évidence avec sa valeur.
interface Props {
  /** 7 valeurs, lundi → dimanche. */
  valeurs: number[];
  couleur: string;
  /** Écrit la valeur du jour fort (« 28 », « 1 040 km »…). */
  formater: (v: number) => string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const LARGEUR = 320;
const HAUTEUR = 120;
const BAS = 14; // la ligne de base, au-dessus des lettres
const HAUT = 30; // la place de la valeur du jour fort, au-dessus de la courbe

export function CourbeSemaine({ valeurs, couleur, formater, etiquette }: Props) {
  const p = usePalette();
  const maximum = Math.max(1, ...valeurs);
  const fort = valeurs.indexOf(Math.max(...valeurs));
  const moyenne = valeurs.reduce((t, v) => t + v, 0) / 7;
  const x = (i: number) => 14 + (i * (LARGEUR - 28)) / 6;
  const y = (v: number) => HAUTEUR - BAS - (v / maximum) * (HAUTEUR - BAS - HAUT);
  const points = valeurs.map((v, i) => [x(i), y(v)] as const);
  const trait = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const zone = `${trait} L${x(6).toFixed(1)} ${HAUTEUR - BAS} L${x(0).toFixed(1)} ${HAUTEUR - BAS} Z`;
  return (
    <Svg width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR + 8}`} style={{ aspectRatio: LARGEUR / (HAUTEUR + 8) }} accessible accessibilityRole="image" accessibilityLabel={etiquette}>
      <Line x1={0} x2={LARGEUR} y1={HAUTEUR - BAS} y2={HAUTEUR - BAS} stroke={p.trait} strokeWidth={1} />
      <Line x1={0} x2={LARGEUR} y1={y(moyenne)} y2={y(moyenne)} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" />
      <Path d={zone} fill={couleur} fillOpacity={0.16} />
      <Path d={trait} fill="none" stroke={couleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map(([px, py], i) => (
        <Circle key={i} cx={px} cy={py} r={i === fort ? 5 : 3.5} fill={i === fort ? couleur : p.surface} stroke={couleur} strokeWidth={2} />
      ))}
      <TexteSvg x={points[fort][0] + (fort === 0 ? -6 : fort === 6 ? 6 : 0)} y={points[fort][1] - 10} fontSize={12} fontFamily={police.titre800} fill={p.texte} textAnchor={fort === 0 ? 'start' : fort === 6 ? 'end' : 'middle'}>
        {formater(valeurs[fort])}
      </TexteSvg>
      {LETTRES.map((l, i) => (
        <TexteSvg key={i} x={x(i)} y={HAUTEUR + 5} fontSize={11} fontFamily={i === fort ? police.texte600 : police.texte400} fill={i === fort ? p.texte : p.texteMuet} textAnchor="middle">
          {l}
        </TexteSvg>
      ))}
    </Svg>
  );
}
