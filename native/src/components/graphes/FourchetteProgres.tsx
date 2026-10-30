import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as TexteSvg } from 'react-native-svg';
import type { Statut } from '@/data/bilan/progression';
import { formatPct } from '@/data/bilan/progression-texte';
import { echelleFourchette } from '@/data/bilan/progression-velo-affichage';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La fourchette de l'évolution (vélo, course) sur une règle graduée : à gauche le recul, à droite la hausse, une bande « stable » (±1 %) autour de zéro.
// Le vrai écart est dans la barre ; si elle touche zéro, l'app ne tranche pas.
interface Props {
  pct: number;
  bas: number;
  haut: number;
  statut: Statut;
}

const LARGEUR = 300;
const HAUTEUR = 96;
const MARGE = 14;
const Y = 46;

const ecritNombre = (v: number): string => formatPct(v);

export function FourchetteProgres({ pct, bas, haut, statut }: Props) {
  const p = usePalette();
  const demi = echelleFourchette(bas, haut);
  const x = (v: number): number => MARGE + ((v + demi) / (2 * demi)) * (LARGEUR - 2 * MARGE);
  const couleur = statut === 'hausse' ? p.ok : statut === 'baisse' ? p.alerte : p.texteDoux;
  const etiquette = `Fourchette de l'évolution : entre ${ecritNombre(bas)} et ${ecritNombre(haut)}, estimation ${ecritNombre(pct)}.`;

  return (
    <View>
      <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
        <Rect x={MARGE} y={Y - 22} width={x(0) - MARGE} height={44} rx={6} fill={avecAlpha(p.alerte, 0.12)} />
        <Rect x={x(0)} y={Y - 22} width={LARGEUR - MARGE - x(0)} height={44} rx={6} fill={avecAlpha(p.ok, 0.12)} />
        <Rect x={x(-1)} y={Y - 22} width={x(1) - x(-1)} height={44} fill={avecAlpha(p.texteMuet, 0.3)} />
        <Line x1={x(0)} x2={x(0)} y1={Y - 26} y2={Y + 26} stroke={p.texte} strokeWidth={1.5} />
        <Line x1={x(bas)} x2={x(haut)} y1={Y} y2={Y} stroke={couleur} strokeWidth={7} strokeLinecap="round" strokeOpacity={0.55} />
        <Line x1={x(bas)} x2={x(bas)} y1={Y - 9} y2={Y + 9} stroke={couleur} strokeWidth={2.5} />
        <Line x1={x(haut)} x2={x(haut)} y1={Y - 9} y2={Y + 9} stroke={couleur} strokeWidth={2.5} />
        <Circle cx={x(pct)} cy={Y} r={6.5} fill={couleur} stroke={p.surface} strokeWidth={2} />
        <TexteSvg x={x(pct)} y={Y - 30} fontSize={13} fontFamily={police.titre700} fill={couleur} textAnchor="middle">{ecritNombre(pct)}</TexteSvg>
        <TexteSvg x={x(bas)} y={Y + 42} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{ecritNombre(bas)}</TexteSvg>
        <TexteSvg x={x(haut)} y={Y + 42} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{ecritNombre(haut)}</TexteSvg>
      </Svg>
      <View style={styles.sens}>
        <Text style={[typo.petit, { color: p.alerte }]}>← recul</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>bande grise : stable (±1 %)</Text>
        <Text style={[typo.petit, { color: p.ok }]}>hausse →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sens: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4 },
});
