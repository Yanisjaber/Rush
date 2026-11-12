import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import type { StatAthlete } from '@/data/reglages/bilan-athlete';
import { avecAlpha, type Palette } from '@/theme/couleurs';

interface Props {
  stats: StatAthlete[];
  palette: Palette;
  accent: string;
}

const CENTRE = 104;
const RAYON = 74;
const ANGLE_DEPART = -Math.PI / 2;

function point(index: number, rayon: number): [number, number] {
  const angle = ANGLE_DEPART + (index * 2 * Math.PI) / 5;
  return [CENTRE + Math.cos(angle) * rayon, CENTRE + Math.sin(angle) * rayon];
}

function pointsPour(rayon: number): string {
  return Array.from({ length: 5 }, (_, index) => point(index, rayon).map((v) => v.toFixed(2)).join(',')).join(' ');
}

/** Radar compact des cinq caractéristiques de la carte athlète. */
export function RadarAthlete({ stats, palette, accent }: Props) {
  const valeurs = useMemo(() => stats.map((stat) => Math.max(0, Math.min(100, stat.valeur))), [stats]);
  return (
    <View accessible accessibilityLabel={`Radar des caractéristiques : ${stats.map((stat) => `${stat.label} ${stat.valeur} sur 100`).join(', ')}`} style={styles.conteneur}>
      <Svg width={208} height={208} viewBox="0 0 208 208">
        {[20, 40, 60, 80, 100].map((niveau) => (
          <Polygon key={niveau} points={pointsPour((RAYON * niveau) / 100)} fill="none" stroke={avecAlpha(palette.texte, niveau === 100 ? 0.22 : 0.11)} strokeWidth={niveau === 100 ? 1.5 : 1} />
        ))}
        {stats.map((stat, index) => {
          const [x, y] = point(index, RAYON);
          return <Line key={stat.cle} x1={CENTRE} y1={CENTRE} x2={x} y2={y} stroke={avecAlpha(palette.texte, 0.16)} strokeWidth={1} />;
        })}
        <Polygon points={valeurs.map((valeur, index) => point(index, (RAYON * valeur) / 100).map((v) => v.toFixed(2)).join(',')).join(' ')} fill={avecAlpha(accent, 0.26)} stroke={accent} strokeWidth={2.5} strokeLinejoin="round" />
        {valeurs.map((valeur, index) => {
          const [x, y] = point(index, (RAYON * valeur) / 100);
          return <Circle key={stats[index]?.cle ?? index} cx={x} cy={y} r={4} fill={accent} stroke={palette.fond} strokeWidth={2} />;
        })}
        <Circle cx={CENTRE} cy={CENTRE} r={3} fill={palette.texte} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ conteneur: { width: 208, height: 208, alignItems: 'center', justifyContent: 'center' } });
