import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { echelle, lisse, type Point } from '@/data/courbes';
import { niveauDe, type PointForme } from '@/data/forme-sante';
import { avecAlpha } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de l'état de forme (0 à 100) sur les derniers jours. Trois bandes de lecture derrière : en dessous de 40 « à ménager »,
// de 40 à 65 « moyen », au-dessus de 65 « bien récupéré ». Le trait s'interrompt quand l'indice n'est pas calculable (données manquantes).
const L = 320;
const H = 170;
const MARGE = 10;
const DROITE = 22; // la place des repères 40 et 65 à droite

export function CourbeForme({ points, etiquette }: { points: PointForme[]; etiquette: string }) {
  const p = usePalette();
  const y = (v: number) => H - MARGE - (v / 100) * (H - 2 * MARGE);
  const valeurs = points.map((pt) => pt.indice);
  const xs = echelle(
    points.map((_, i) => i),
    L - DROITE,
    H,
    MARGE,
  ).map((pt) => pt[0]);

  // Le trait est coupé en tronçons : une suite de jours avec un indice
  const troncons: Point[][] = [];
  let courant: Point[] = [];
  valeurs.forEach((v, i) => {
    if (v == null) {
      if (courant.length) troncons.push(courant);
      courant = [];
    } else courant.push([xs[i], y(v)]);
  });
  if (courant.length) troncons.push(courant);

  const dernier = points[points.length - 1];
  const niveau = niveauDe(dernier?.indice);
  const couleurFin = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.texteDoux;
  const point = dernier?.indice != null ? ([xs[points.length - 1], y(dernier.indice)] as Point) : null;

  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${L} ${H}`} style={{ aspectRatio: L / H }}>
      <Rect x={0} y={y(100)} width={L - DROITE} height={y(65) - y(100)} fill={avecAlpha(p.ok, 0.12)} />
      <Rect x={0} y={y(65)} width={L - DROITE} height={y(40) - y(65)} fill={avecAlpha(p.alerte, 0.1)} />
      <Rect x={0} y={y(40)} width={L - DROITE} height={y(0) - y(40)} fill={avecAlpha(p.danger, 0.12)} />
      {[65, 40].map((v) => (
        <Line key={v} x1={0} x2={L - DROITE} y1={y(v)} y2={y(v)} stroke={p.traitFort} strokeWidth={1} strokeDasharray="4 4" />
      ))}
      {[65, 40].map((v) => (
        <TexteSvg key={`t${v}`} x={L - DROITE + 4} y={y(v) + 4} fontFamily={police.texte500} fontSize={11} fill={p.texteDoux}>
          {v}
        </TexteSvg>
      ))}
      {troncons.map((t, i) => (t.length > 1 ? <Path key={i} d={lisse(t)} fill="none" stroke={p.texte} strokeWidth={2.6} strokeLinecap="round" /> : <Circle key={i} cx={t[0][0]} cy={t[0][1]} r={2.5} fill={p.texte} />))}
      {point ? <Circle cx={point[0]} cy={point[1]} r={5} fill={couleurFin} stroke={p.fond} strokeWidth={2} /> : null}
    </Svg>
  );
}
