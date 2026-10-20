import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { CourbeLissee } from '@/components/CourbeLissee';
import { recordsParGroupe, type ProgressionExercice } from '@/data/force';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte, formatKg } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un exercice par groupe musculaire (pectoraux, dos, jambes, épaules, bras) : 1RM estimé, record éventuel et progression.
// En taille moyenne il n'y a la place que pour 2 cartes (jambes et pectoraux en priorité).
// tuile : le premier record en gros, l'exercice en note.
// compact : liste courte pour téléphone (3 exercices, une ligne chacun) ; la progression complète sera dans l'analyse.
export function WidgetRecords({ contexte, taille = 'l', compact = false, tuile = false }: WidgetProps) {
  const p = usePalette();
  const exos = recordsParGroupe(contexte.force.series, compact ? 3 : taille === 'm' ? 2 : 5);

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
    <Bloc titre="Tes records">
      {exos.length && compact ? (
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
      ) : exos.length ? (
        <View style={styles.cartes}>
          {exos.map((e) => (
            <View key={e.cle} accessible accessibilityLabel={`${e.nom}, ${formatKg(e.rm)} kilos estimés sur une répétition${e.record ? ', record' : ''}`} style={[styles.carte, { backgroundColor: p.surface2 }]}>
              <View style={styles.enteteCarte}>
                <Text style={[typo.corpsFort, { color: p.texteDoux, flex: 1 }]}>{e.nom}</Text>
                {badge(e, p.surface)}
              </View>
              <Text style={[styles.chiffre, { color: p.texte }]}>
                {formatKg(e.rm)}
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}> kg</Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>  1RM estimé</Text>
              </Text>
              {e.serie.length > 1 ? (
                <View style={{ marginTop: 10 }}>
                  <CourbeLissee valeurs={e.serie.map((pt) => pt.rm)} couleur={p.sportMuscu} hauteur={64} etiquette={`Progression du 1RM estimé : ${e.nom}`} />
                </View>
              ) : null}
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                {formatDateCourte(e.date)} · {e.reps} × {formatKg(e.poids)} kg
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Tes records apparaîtront dès que tu auras enregistré quelques séries.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  nomRecord: { flex: 1, minWidth: 0 },
  rm: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexte: { fontFamily: police.texte600 },
  cartes: { gap: 12 },
  carte: { borderRadius: rayon.base, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  enteteCarte: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chiffre: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, marginTop: 8, fontVariant: ['tabular-nums'] },
});
