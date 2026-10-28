import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { recordsParGroupe, type ProgressionExercice } from '@/data/sports/force';
import { CourbeLissee } from '@/components/graphes/CourbeLissee';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { Tuile } from '@/components/ui/Tuile';
import { formatKg } from '@/data/outils/format';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un exercice par groupe musculaire (pectoraux, dos, jambes, épaules, bras) : 1RM estimé et record éventuel.
export function WidgetRecords({ contexte, taille = 'm' }: WidgetProps) {
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

  // XS : ton premier record ; S : + la courbe de ce lift ; M : + les 4 premiers exercices en liste ; L : les 5 exercices, chacun avec sa courbe
  if (taille !== 'l') {
    const e = exos[0];
    return (
      <Tuile titre="Tes records" valeur={e ? formatKg(e.rm) : '—'} unite={e ? 'kg' : ''} note={e ? `${e.nom}${e.record ? ' · record' : ''}` : 'Pas encore de séries'} large>
        {!e ? null : taille === 's' && e.serie.length > 1 ? (
          <CourbeLissee valeurs={e.serie.map((x) => x.rm)} couleur={p.sportMuscu} hauteur={34} aire={false} etiquette={`Progression de ton 1RM estimé au ${e.nom}`} />
        ) : taille === 'm' ? (
          <ListeCompacte lignes={exos.slice(0, 4).map((x) => ({ cle: x.cle, nom: x.nom, valeur: `${formatKg(x.rm)} kg` }))} />
        ) : null}
      </Tuile>
    );
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
            <View style={styles.nomRecord}>
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                {e.nom}
              </Text>
              {e.record || (e.delta != null && e.delta !== 0) ? <View style={styles.sous}>{badge(e, p.surface2)}</View> : null}
            </View>
            {e.serie.length > 1 ? (
              <View style={styles.courbe}>
                <CourbeLissee valeurs={e.serie.map((x) => x.rm)} couleur={p.sportMuscu} largeur={64} hauteur={24} marge={3} epaisseur={2} aire={false} pointFinal={false} etiquette={`Progression de ton 1RM estimé au ${e.nom}`} />
              </View>
            ) : null}
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
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 2 },
  courbe: { width: 64 },
  nomRecord: { flex: 1, minWidth: 0 },
  sous: { flexDirection: 'row', marginTop: 2 },
  rm: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexte: { fontFamily: police.texte600 },
});
