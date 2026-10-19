import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { construireGraphe, indiceTouche, jj, lectureGraphe, LARGEUR_GRAPHE, type ParamsGraphe } from '@/data/graphe-series';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Graphique de séries (cumul sur plusieurs années, nuits de sommeil…). Port de components/charts/GrapheNuits.svelte.
// Poser le doigt dessus (et le faire glisser à l'horizontale) écrit au-dessus la date pointée et les valeurs.
interface Props extends ParamsGraphe {
  /** Phrase lue par VoiceOver à la place du dessin. */
  titre: string;
  formater?: (valeur: number, nomSerie: string) => string;
}

export function GrapheSeries({ titre, formater, ...params }: Props) {
  const p = usePalette();
  const [survol, setSurvol] = useState<number | null>(null);
  const [largeur, setLargeur] = useState(0);
  const g = construireGraphe(params);
  const lecture = lectureGraphe(params, survol, formater);
  const hauteur = g.hauteur;
  const toucher = (x: number) => setSurvol(indiceTouche(x, largeur, g.n));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={titre}>
      <Text style={[typo.petit, styles.lecture, { color: p.texteDoux }]} accessibilityLiveRegion="none">
        {lecture || ' '}
      </Text>
      <View
        onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
        onTouchStart={(e) => toucher(e.nativeEvent.locationX)}
        onTouchMove={(e) => toucher(e.nativeEvent.locationX)}
        onTouchEnd={() => setSurvol(null)}
        onTouchCancel={() => setSurvol(null)}
      >
        <Svg width="100%" viewBox={`0 0 ${LARGEUR_GRAPHE} ${hauteur}`} style={{ aspectRatio: LARGEUR_GRAPHE / hauteur }}>
          {g.reperesY.map((y, i) => (
            <Line key={i} x1={0} x2={LARGEUR_GRAPHE} y1={y} y2={y} stroke={p.traitFort} strokeWidth={1.5} strokeDasharray="8 10" />
          ))}
          {g.zoneBande ? <Path d={g.zoneBande} fill={p.trait} opacity={0.6} /> : null}
          {g.rects.map((r, k) => (
            <Rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} fill={r.couleur} opacity={survol !== null && survol !== r.i ? 0.45 : 1} />
          ))}
          {g.chemins.map((c, k) => (
            <Path key={k} d={c.d} fill="none" stroke={c.couleur} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={c.pointille ? '12 12' : undefined} />
          ))}
          {survol !== null && survol < g.n ? (
            <Line x1={g.cx(survol)} x2={g.cx(survol)} y1={0} y2={hauteur} stroke={p.texteDoux} strokeWidth={1.5} strokeDasharray="6 8" />
          ) : null}
        </Svg>
      </View>
      <View style={styles.axe} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {g.repereDates.map((i) => (
          <Text key={i} style={[typo.petit, styles.date, { color: p.texteMuet, left: `${(g.cx(i) / LARGEUR_GRAPHE) * 100}%` }]}>
            {jj(params.etiquettes[i])}
          </Text>
        ))}
      </View>
      {params.reperes?.some((r) => r.etiquette) ? (
        <Text style={[typo.petit, { color: p.texteMuet, marginTop: 2 }]}>{params.reperes.filter((r) => r.etiquette).map((r) => r.etiquette).join(' · ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lecture: { minHeight: 20, marginBottom: 4 },
  axe: { height: 20, position: 'relative' },
  // L'étiquette est centrée sur sa position : un décalage de la moitié de sa largeur (44 pt / 2)
  date: { position: 'absolute', top: 2, width: 44, marginLeft: -22, textAlign: 'center' },
});
