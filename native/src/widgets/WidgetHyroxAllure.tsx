import { StyleSheet, Text as TexteRN, View } from 'react-native';
import Svg, { Circle, Path, Text } from 'react-native-svg';
import { CadreWidget } from '@/components/CadreWidget';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { analyserTest, ciblesSegments, ecrireTemps } from '@/data/hyrox';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const L = 400;
const H = 170;
const MARGE = 14;

// Le temps de chacun des 8 runs d'1 km : ton dernier test (trait plein) et ton objectif (pointillés).
// tuile : le temps moyen d'un run en gros + les 8 runs en barres.
export function WidgetHyroxAllure({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const test = contexte.hyrox.tests[0] ?? null;
  const runs = test ? analyserTest(test.segments).allures : [];
  const cibles = ciblesSegments(contexte.hyrox.objectif, test);
  const runsCibles = cibles ? cibles.filter((_, i) => i % 2 === 0) : [];

  const tous = [...runs, ...runsCibles];
  const mini = tous.length ? Math.floor((Math.min(...tous) - 10) / 10) * 10 : 0;
  const maxi = tous.length ? Math.ceil((Math.max(...tous) + 10) / 10) * 10 : 1;
  const x = (i: number) => MARGE + (i * (L - 2 * MARGE)) / 7;
  const y = (v: number) => MARGE + ((v - mini) / Math.max(1, maxi - mini)) * (H - 2 * MARGE); // plus lent = plus bas
  const trace = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  if (tuile) {
    const moyenne = runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0;
    return (
      <Tuile titre="Allure des 8 runs" valeur={runs.length ? ecrireTemps(moyenne) : '—'} note={runs.length ? 'par km en moyenne' : 'Aucun test'}>
        {runs.length ? <MiniBarres valeurs={runs} couleur={p.sportHybride} etiquette="Temps de chacun des 8 runs du dernier test" /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Allure des 8 runs">
      {runs.length ? (
        <>
          <View style={styles.legende}>
            <View style={styles.item}>
              <View style={[styles.traitPlein, { backgroundColor: p.sportHybride }]} />
              <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Ton test</TexteRN>
            </View>
            {runsCibles.length ? (
              <View style={styles.item}>
                <View style={[styles.traitTirets, { borderColor: p.texteDoux }]} />
                <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Objectif</TexteRN>
              </View>
            ) : null}
          </View>
          <Svg
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Temps des 8 runs : de ${ecrireTemps(runs[0])} à ${ecrireTemps(runs[7])}`}
            width="100%"
            viewBox={`0 0 ${L} ${H}`}
            style={{ aspectRatio: L / H, overflow: 'visible' }}
          >
            {/* Les repères de l'axe sont en 15 unités de dessin : environ 12 pt à l'écran */}
            <Text x={0} y={12} fontFamily={police.texte400} fontSize={15} fill={p.texteDoux}>
              {ecrireTemps(mini)}
            </Text>
            <Text x={0} y={H - 2} fontFamily={police.texte400} fontSize={15} fill={p.texteDoux}>
              {ecrireTemps(maxi)}
            </Text>
            {runsCibles.length ? (
              <Path d={trace(runsCibles)} fill="none" stroke={p.texteDoux} strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            <Path d={trace(runs)} fill="none" stroke={p.sportHybride} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {runs.map((v, i) => (
              <Circle key={i} cx={x(i)} cy={y(v)} r={4} fill={p.surface} stroke={p.sportHybride} strokeWidth={2.5} />
            ))}
          </Svg>
          <View style={styles.bas}>
            <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Run 1</TexteRN>
            <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Run 8</TexteRN>
          </View>
        </>
      ) : (
        <TexteRN style={[typo.corps, { color: p.texteDoux }]}>Saisis un test pour voir l'allure de tes 8 runs.</TexteRN>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  traitPlein: { width: 18, height: 3, borderRadius: 2 },
  traitTirets: { width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  bas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
