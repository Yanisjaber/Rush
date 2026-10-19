import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CORPS_SVG } from '@/data/corps-svg';
import type { ResumeMuscle } from '@/data/muscu';
import { melange } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le corps humain dessiné (de face et de dos), chaque muscle teinté selon son pourcentage de la zone visée.
// Port de components/charts/SilhouetteCorps.svelte, en lecture seule (le choix d'un muscle viendra avec l'écran d'analyse).
// Les tracés viennent du paquet « react-native-body-highlighter » (licence MIT, voir data/corps-svg.ts).
interface Props {
  muscles: Record<string, ResumeMuscle>;
  /** Phrase lue par VoiceOver. */
  etiquette?: string;
  legendes?: boolean;
}

// Les épaules : l'avant du deltoïde se lit de face et l'arrière de dos (le faisceau latéral se lit dans le détail)
const FAISCEAU_DE_LA_VUE: Record<string, string> = { Face: 'avant', Dos: 'arriere' };
// Les tracés du dessin portent le nom d'un muscle ; les tibias sont rattachés aux mollets, le reste (tête, mains, pieds…) ne compte pas.
const ALIAS: Record<string, string> = { tibialis: 'calves' };

export function SilhouetteCorps({ muscles, etiquette = 'Corps humain', legendes = true }: Props) {
  const p = usePalette();

  // Du gris (jamais travaillé) au corail de la muscu (130 % de la zone visée ou plus)
  const teinte = (pct: number | undefined) => melange(p.sportMuscu, p.traitFort, Math.round((Math.min(Math.max(pct ?? 0, 0), 130) / 130) * 100));
  const pctPiece = (slug: string, vue: string): number => {
    const m = muscles[slug];
    if (slug === 'deltoids') return m.portions?.find((po) => po.cle === FAISCEAU_DE_LA_VUE[vue])?.pct ?? m.pct;
    return m.pct;
  };
  const vues = [
    { nom: 'Face', ...CORPS_SVG.face },
    { nom: 'Dos', ...CORPS_SVG.dos },
  ].map((v) => ({ ...v, pieces: v.zones.map((z) => ({ ...z, muscle: ALIAS[z.slug] || z.slug })) }));

  return (
    <View style={styles.silhouettes}>
      {vues.map((v) => (
        <View key={v.nom} style={styles.figure}>
          <Svg accessible accessibilityRole="image" accessibilityLabel={`${etiquette}, vue de ${v.nom.toLowerCase()}`} width="100%" viewBox={v.viewBox} style={{ aspectRatio: 724 / 1448 }}>
            <Path d={v.contour} fill="none" stroke={p.traitFort} strokeWidth={4} strokeLinejoin="round" />
            {v.pieces
              .filter((z) => !muscles[z.muscle])
              .map((z) => (
                <Path key={z.slug} d={z.d} fill={melange(p.traitFort, p.surface2, 40)} stroke={p.surface2} strokeWidth={3} />
              ))}
            {v.pieces
              .filter((z) => muscles[z.muscle])
              .map((z) => (
                <Path key={z.slug} d={z.d} fill={teinte(pctPiece(z.muscle, v.nom))} stroke={p.surface2} strokeWidth={3} strokeLinejoin="round" />
              ))}
          </Svg>
          {legendes ? <Text style={[typo.micro, styles.legende, { color: p.texteMuet }]}>{v.nom}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  silhouettes: { flexDirection: 'row', gap: 8 },
  figure: { flex: 1, alignItems: 'center' },
  legende: { marginTop: 4, textAlign: 'center' },
});
