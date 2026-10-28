import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatChrono, formatDateCourte } from '@/data/outils/format';
import { partsRunsStations, type PartTest } from '@/data/sports/hyrox-suivi';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où passe ton temps pendant un Hyrox : à courir (les 8 runs) ou sur les stations. La couleur dit lequel : orange = course, corail = force.
//  - XS : la part des runs et celle des stations du dernier test ; S : + la barre ; M : + le temps de chacun en liste ;
//  - L : les cinq derniers tests, une barre chacun, pour voir la part bouger d'un test à l'autre.
export function WidgetHyroxRunsStations({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const parts = partsRunsStations(contexte.hyrox.tests);
  const dernier = parts.length ? parts[parts.length - 1] : null;

  const barre = (t: PartTest, epaisseur = 12) => (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t.pctRuns} % de runs, ${100 - t.pctRuns} % de stations`}
      style={[styles.barre, { height: epaisseur }]}
    >
      <View style={{ flex: t.runs, backgroundColor: p.sportCourse }} />
      <View style={{ flex: t.stations, backgroundColor: p.sportMuscu }} />
    </View>
  );

  if (taille !== 'l') {
    return (
      <Tuile titre="Runs et stations" valeur={dernier ? `${dernier.pctRuns} %` : '—'} unite={dernier ? 'runs' : ''} note={dernier ? `${100 - dernier.pctRuns} % stations` : 'Aucun test'} large>
        {!dernier ? null : taille === 's' ? (
          barre(dernier)
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre(dernier)}
            <ListeCompacte
              lignes={[
                { cle: 'runs', nom: 'Runs', valeur: formatChrono(dernier.runs), point: p.sportCourse },
                { cle: 'stations', nom: 'Stations', valeur: formatChrono(dernier.stations), point: p.sportMuscu },
              ]}
            />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const recents = [...parts].reverse().slice(0, 5);
  const precedent = parts.length > 1 ? parts[parts.length - 2] : null;
  const delta = dernier && precedent ? dernier.pctRuns - precedent.pctRuns : null;
  return (
    <CadreWidget titre="Runs et stations">
      {dernier ? (
        <>
          <Text style={[styles.valeur, { color: p.texte }]}>
            {dernier.pctRuns} %<Text style={[typo.corpsFort, { color: p.texteDoux }]}> de runs, {100 - dernier.pctRuns} % de stations</Text>
          </Text>
          {delta != null ? (
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 2 }]}>{delta === 0 ? 'Pareil' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} point${Math.abs(delta) > 1 ? 's' : ''} de runs`} depuis le test d'avant</Text>
          ) : null}
          <View style={styles.legende}>
            <View style={styles.item}>
              <View style={[styles.carre, { backgroundColor: p.sportCourse }]} />
              <Text style={[typo.petit, { color: p.texteDoux }]}>Runs</Text>
            </View>
            <View style={styles.item}>
              <View style={[styles.carre, { backgroundColor: p.sportMuscu }]} />
              <Text style={[typo.petit, { color: p.texteDoux }]}>Stations</Text>
            </View>
          </View>
          <View style={styles.tests}>
            {recents.map((t) => (
              <View key={t.id} style={{ gap: 4 }}>
                <View style={styles.enteteTest}>
                  <Text style={[typo.petit, { color: p.texte }]}>{formatDateCourte(t.date)}</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {formatChrono(t.runs)} · {formatChrono(t.stations)}
                  </Text>
                </View>
                {barre(t, 16)}
              </View>
            ))}
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Le temps passé à courir (8 runs d'1 km) et celui passé sur les 8 stations, pour chacun de tes tests.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de test complet. Enregistre une simulation ou une course Hyrox pour voir où passe ton temps.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden', gap: 2 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  legende: { flexDirection: 'row', gap: 16, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
  tests: { gap: 10, marginTop: 12 },
  enteteTest: { flexDirection: 'row', justifyContent: 'space-between' },
});
