import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { echelleRonde } from '@/data/outils/echelle';
import { formatNum } from '@/data/outils/format';
import { DUREE_MAX, DUREE_MIN, indexDureeProche, type PointCourbe } from '@/data/bilan/records';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de puissance : la meilleure puissance de chaque durée, de 1 s à 5 h, les durées sur une échelle logarithmique (comme partout en cyclisme : les efforts courts seraient
// sinon écrasés). La courbe pleine est la période choisie, les pointillés l'autre période. Poser le doigt (ou le faire glisser) choisit une durée : un point et un trait la marquent.
interface Props {
  courbe: PointCourbe[];
  /** L'autre période, en pointillés. */
  autre?: PointCourbe[];
  /** La durée touchée (indice dans `courbe`), ou null. */
  selection: number | null;
  onSelection: (index: number | null) => void;
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LARGEUR = 330;
const HAUTEUR = 210;
const GAUCHE = 40;
const DROITE = 10;
const HAUT = 14;
const BAS = 26; // la ligne de base, au-dessus des durées écrites
const REPERES_DUREE: [number, string][] = [
  [1, '1 s'],
  [10, '10 s'],
  [60, '1 min'],
  [600, '10 min'],
  [3600, '1 h'],
  [18000, '5 h'],
];

const x = (secondes: number) => GAUCHE + ((Math.log(secondes) - Math.log(DUREE_MIN)) / (Math.log(DUREE_MAX) - Math.log(DUREE_MIN))) * (LARGEUR - GAUCHE - DROITE);
/** La durée sous un point de l'axe (le contraire de x), pour le toucher. */
const secondesDeX = (px: number) => Math.exp(Math.log(DUREE_MIN) + ((px - GAUCHE) / (LARGEUR - GAUCHE - DROITE)) * (Math.log(DUREE_MAX) - Math.log(DUREE_MIN)));

export function CourbePuissance({ courbe, autre, selection, onSelection, couleur, etiquette }: Props) {
  const p = usePalette();
  const meilleurs = (c: PointCourbe[]) => c.filter((pt) => pt.top.length).map((pt) => ({ duree: pt.duree, watts: pt.top[0].watts }));
  const a = meilleurs(courbe);
  const b = autre ? meilleurs(autre) : [];
  const { haut, pas } = echelleRonde(Math.max(0, ...a.map((pt) => pt.watts), ...b.map((pt) => pt.watts)));
  const plafond = Math.max(1, haut);
  const y = (w: number) => HAUTEUR - BAS - (w / plafond) * (HAUTEUR - BAS - HAUT);
  const trace = (pts: { duree: number; watts: number }[]) => pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.duree).toFixed(1)} ${y(pt.watts).toFixed(1)}`).join(' ');
  const reperes = pas > 0 ? [pas, 2 * pas, 3 * pas] : [];
  const choisi = selection != null ? courbe[selection] : null;
  const dessin = (
    <Svg width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }} accessible accessibilityRole="image" accessibilityLabel={etiquette}>
      {[0, ...reperes].map((w) => (
        <Line key={w} x1={GAUCHE - 4} x2={LARGEUR - DROITE} y1={y(w)} y2={y(w)} stroke={p.trait} strokeWidth={1} />
      ))}
      {[0, ...reperes].map((w) => (
        <TexteSvg key={`v${w}`} x={GAUCHE - 8} y={y(w) + 3} fontSize={9.5} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">
          {formatNum(w, 0)}
        </TexteSvg>
      ))}
      {REPERES_DUREE.map(([s, t]) => (
        <TexteSvg key={s} x={x(s)} y={HAUTEUR - 8} fontSize={10} fontFamily={police.texte400} fill={p.texteDoux} textAnchor="middle">
          {t}
        </TexteSvg>
      ))}
      {b.length > 1 ? <Path d={trace(b)} fill="none" stroke={p.texteMuet} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {a.length > 1 ? <Path d={`${trace(a)} L${x(a[a.length - 1].duree).toFixed(1)} ${y(0)} L${x(a[0].duree).toFixed(1)} ${y(0)} Z`} fill={couleur} fillOpacity={0.13} /> : null}
      {a.length ? <Path d={trace(a)} fill="none" stroke={couleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {choisi && choisi.top.length ? (
        <>
          <Line x1={x(choisi.duree)} x2={x(choisi.duree)} y1={HAUT} y2={y(0)} stroke={p.texte} strokeWidth={1.2} strokeDasharray="2 3" />
          <Circle cx={x(choisi.duree)} cy={y(choisi.top[0].watts)} r={5} fill={couleur} stroke={p.surface} strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
  return (
    <ZoneTactile selection={selection} onSelection={onSelection} indexDe={(px, largeur) => (courbe.length ? indexDureeProche(courbe, secondesDeX((px / largeur) * LARGEUR)) : null)}>
      {dessin}
    </ZoneTactile>
  );
}
