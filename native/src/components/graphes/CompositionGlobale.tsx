import Svg, { G, Rect, Text as TexteSvg } from 'react-native-svg';
import { PILIERS, type NiveauGlobalAnnee } from '@/data/bilan/piliers-niveau';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ce qui compose le score global de chaque année : une barre par année, faite d'un bloc par pilier mesuré. La hauteur d'un bloc est la note du pilier divisée par le nombre
// de piliers : les blocs s'additionnent au score global (écrit au-dessus de la barre). De bas en haut : puissance, endurance, durabilité, répétabilité, charge.
interface Props {
  annees: NiveauGlobalAnnee[];
  couleur: string;
}

const LARGEUR = 300;
const HAUTEUR = 170;
const HAUT = 20;
const BAS = 26;

export function CompositionGlobale({ annees, couleur }: Props) {
  const p = usePalette();
  const y = (v: number): number => HAUTEUR - BAS - (v / 100) * (HAUTEUR - BAS - HAUT);
  const pas = (LARGEUR - 12) / annees.length;
  const largeur = Math.min(46, pas * 0.62);
  const etiquette = `Ce qui compose le score global : ${annees.map((a) => `${a.an}, ${a.global}`).join(' ; ')}.`;

  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
      {annees.map((a, i) => {
        const cx = 6 + (i + 0.5) * pas;
        const mesures = PILIERS.filter((pi) => a.piliers[pi.cle] !== null);
        let cumul = 0;
        return (
          <G key={a.an}>
            {mesures.map((pi) => {
              const hauteur = a.piliers[pi.cle]! / mesures.length;
              const y0 = y(cumul);
              const y1 = y(cumul + hauteur);
              cumul += hauteur;
              const rang = PILIERS.findIndex((q) => q.cle === pi.cle);
              return <Rect key={pi.cle} x={cx - largeur / 2} y={y1} width={largeur} height={Math.max(0, y0 - y1 - 1)} rx={3} fill={couleur} fillOpacity={0.3 + 0.7 * (rang / 4)} />;
            })}
            <TexteSvg x={cx} y={y(cumul) - 6} fontSize={12} fontFamily={police.texte600} fill={p.texte} textAnchor="middle">{Math.round(cumul)}</TexteSvg>
            <TexteSvg x={cx} y={HAUTEUR - 6} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{a.an}</TexteSvg>
          </G>
        );
      })}
    </Svg>
  );
}
