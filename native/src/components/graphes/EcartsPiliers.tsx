import Svg, { G, Line, Rect, Text as TexteSvg } from 'react-native-svg';
import { PILIERS, type PilierCle } from '@/data/bilan/piliers-niveau';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ce qui a bougé depuis l'année d'avant : une barre par pilier, vers la droite (vert) quand il monte, vers la gauche (orange) quand il baisse, avec « avant → maintenant ».
// Jamais la couleur seule : le signe (+ ou −) est écrit à côté de chaque barre.
interface Props {
  ecarts: { cle: PilierCle; avant: number; maintenant: number; ecart: number }[];
}

const LARGEUR = 300;
const LIGNE = 38;
const ZERO = 168;
const ECHELLE = 1.1; // points de dessin par point de score

export function EcartsPiliers({ ecarts }: Props) {
  const p = usePalette();
  const hauteur = ecarts.length * LIGNE + 4;
  const nom = (cle: PilierCle): string => PILIERS.find((q) => q.cle === cle)!.nom;
  const etiquette = `Évolution de chaque pilier : ${ecarts.map((e) => `${nom(e.cle)} ${e.ecart >= 0 ? 'plus' : 'moins'} ${Math.abs(e.ecart)} points, de ${e.avant} à ${e.maintenant}`).join(' ; ')}.`;

  return (
    <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${hauteur}`} style={{ aspectRatio: LARGEUR / hauteur }}>
      <Line x1={ZERO} x2={ZERO} y1={0} y2={hauteur} stroke={p.texte} strokeWidth={1.2} />
      {ecarts.map((e, j) => {
        const y = j * LIGNE + 2;
        const largeur = Math.max(2, Math.min(ZERO - 4, Math.abs(e.ecart) * ECHELLE));
        const monte = e.ecart >= 0;
        const couleur = monte ? p.ok : p.alerte;
        return (
          <G key={e.cle}>
            <TexteSvg x={0} y={y + 14} fontSize={12} fontFamily={police.texte600} fill={p.texte}>{nom(e.cle)}</TexteSvg>
            <TexteSvg x={LARGEUR} y={y + 14} fontSize={12} fontFamily={police.texte400} fill={p.texteDoux} textAnchor="end">{`${e.avant} → ${e.maintenant}`}</TexteSvg>
            <Rect x={monte ? ZERO : ZERO - largeur} y={y + 20} width={largeur} height={10} rx={4} fill={couleur} fillOpacity={0.85} />
            <TexteSvg x={monte ? ZERO + largeur + 5 : ZERO - largeur - 5} y={y + 30} fontSize={12} fontFamily={police.titre700} fill={p.texte} textAnchor={monte ? 'start' : 'end'}>
              {`${e.ecart > 0 ? '+' : e.ecart < 0 ? '−' : ''}${Math.abs(e.ecart)}`}
            </TexteSvg>
          </G>
        );
      })}
    </Svg>
  );
}
