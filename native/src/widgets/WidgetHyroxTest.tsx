import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte } from '@/data/format';
import { analyserTest, ciblesSegments, ecrireTemps, formatEcartLong, SEGMENTS } from '@/data/hyrox';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ton dernier test, segment par segment : chaque case de la bande est large comme le temps passé dessus.
// Sur téléphone, les 16 temps ne tiennent pas dans la boîte : la bande donne la forme du test, les totaux le résumé.
// tuile : le temps total du dernier test en gros, l'objectif en note.
export function WidgetHyroxTest({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const test = contexte.hyrox.tests[0] ?? null;
  const objectif = contexte.hyrox.objectif;
  const analyse = test ? analyserTest(test.segments) : null;
  const cibles = ciblesSegments(objectif, test);
  const ecart = objectif && test ? test.total_s - objectif.total_s : null;

  if (tuile) {
    return (
      <Tuile
        titre="Dernier test Hyrox"
        valeur={test ? ecrireTemps(test.total_s) : '—'}
        note={test ? (objectif ? `Objectif ${ecrireTemps(objectif.total_s)}` : formatDateCourte(test.date)) : 'Aucun test'}
      />
    );
  }

  return (
    <Bloc titre="Ton dernier test, course par course">
      {test && analyse ? (
        <>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: -8, marginBottom: 12 }]}>
            {test.label} · {formatDateCourte(test.date)}
          </Text>
          <View style={styles.legende}>
            <View style={[styles.pastille, { backgroundColor: p.surface2, borderColor: p.traitFort, borderWidth: 1 }]} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Run 1 km</Text>
            <View style={[styles.pastille, { backgroundColor: p.sportHybride, marginLeft: 8 }]} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Station</Text>
          </View>

          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Temps de chaque segment du test, ${SEGMENTS.map((s, i) => `${s.nom} ${ecrireTemps(test.segments[i])}`).join(', ')}`}
            style={styles.bande}
          >
            {SEGMENTS.map((s, i) => (
              <View key={s.i} style={{ flexGrow: test.segments[i], flexBasis: 0, minWidth: 0, borderRadius: 4, backgroundColor: s.type === 'run' ? p.surface2 : p.sportHybride }} />
            ))}
          </View>

          <View style={styles.totaux}>
            <Total etiquette="Temps total" valeur={ecrireTemps(analyse.total)} />
            <Total etiquette="Runs" valeur={ecrireTemps(analyse.runs)} />
            <Total etiquette="Stations" valeur={ecrireTemps(analyse.stations)} />
            <Total
              etiquette="Écart objectif"
              valeur={ecart != null ? formatEcartLong(ecart) : '—'}
              couleur={ecart == null ? undefined : ecart > 0 ? p.sportCourse : p.ok}
            />
          </View>
          {!cibles ? <Text style={[typo.petit, { color: p.texteDoux, marginTop: 14 }]}>Fixe un objectif de temps dans tes tests Hyrox pour voir l'écart.</Text> : null}
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de test enregistré. Saisis ta première simulation pour voir tes 16 segments.</Text>
      )}
    </Bloc>
  );
}

function Total({ etiquette, valeur, couleur }: { etiquette: string; valeur: string; couleur?: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`${etiquette} ${valeur}`} style={styles.total}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{etiquette}</Text>
      <Text style={[styles.valeur, { color: couleur ?? p.texte }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  pastille: { width: 9, height: 9, borderRadius: 2 },
  bande: { flexDirection: 'row', gap: 3, height: 44 },
  totaux: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 14, marginTop: 20 },
  total: { width: '47%' },
  valeur: { fontFamily: police.titre700, fontSize: 28, lineHeight: 32, marginTop: 4, fontVariant: ['tabular-nums'] },
});
