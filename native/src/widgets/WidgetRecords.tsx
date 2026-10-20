import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { recordsParGroupe, type ProgressionExercice } from '@/data/force';
import { Tuile } from '@/components/Tuile';
import { formatKg } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un exercice par groupe musculaire (pectoraux, dos, jambes, épaules, bras) : 1RM estimé et record éventuel.
// tuile : le premier record en gros, l'exercice en note. L : la liste de 5 exercices, une ligne chacun ; la progression complète sera dans l'analyse.
export function WidgetRecords({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const exos = recordsParGroupe(contexte.force.series, 5);

  const badge = (e: ProgressionExercice, surface: string) =>
    e.record ? (
      <View style={[styles.badge, { backgroundColor: p.sportMuscu }]}>
        <Text style={[typo.micro, { color: p.encreSurCouleur }]}>Record</Text>
      </View>
    ) : e.delta != null && e.delta !== 0 ? (
      <View style={[styles.badge, { backgroundColor: surface }]}>
        <Text style={[typo.petit, styles.badgeTexte, { color: p.texteDoux }]}>
          {e.delta > 0 ? '+' : '−'}
          {formatKg(Math.abs(e.delta))} kg
        </Text>
      </View>
    ) : null;

  if (tuile) {
    const e = exos[0];
    return <Tuile titre="Tes records" valeur={e ? formatKg(e.rm) : '—'} unite={e ? 'kg' : ''} note={e ? `${e.nom}${e.record ? ' · record' : ''}` : 'Pas encore de séries'} />;
  }

  return (
    <CadreWidget titre="Tes records">
      {exos.length ? (
        exos.map((e, i) => (
          <View
            key={e.cle}
            accessible
            accessibilityLabel={`${e.nom}, ${formatKg(e.rm)} kilos${e.record ? ', record' : ''}`}
            style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Text numberOfLines={1} style={[typo.corpsFort, styles.nomRecord, { color: p.texte }]}>
              {e.nom}
            </Text>
            {badge(e, p.surface2)}
            <Text style={[styles.rm, { color: p.texte }]}>
              {formatKg(e.rm)}
              <Text style={[typo.petit, { color: p.texteDoux }]}> kg</Text>
            </Text>
          </View>
        ))
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Tes records apparaîtront dès que tu auras enregistré quelques séries.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  nomRecord: { flex: 1, minWidth: 0 },
  rm: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexte: { fontFamily: police.texte600 },
});
