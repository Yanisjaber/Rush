import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { MiniBarres } from '@/components/MiniBarres';
import { SilhouetteCorps } from '@/components/SilhouetteCorps';
import { Tuile } from '@/components/Tuile';
import { seriesParGroupe } from '@/data/force';
import { musclesSurPeriode } from '@/data/muscu';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Le corps de face et de dos : chaque muscle est teinté selon ses séries des 7 derniers jours
// (plus c'est foncé, plus il a travaillé par rapport à sa zone visée). Le détail viendra avec la page d'analyse.
// compact : tuile pour téléphone (le groupe le plus travaillé + les séries de chaque groupe en barres).
export function WidgetGroupes({ contexte, compact = false, tuile = false }: WidgetProps) {
  const p = usePalette();
  const groupes = [...seriesParGroupe(contexte.force.series)].sort((a, b) => b.series - a.series);
  const [premier, second] = groupes;

  if (compact || tuile) {
    return (
      <Tuile
        titre="Séries / semaine"
        valeur={premier.series > 0 ? premier.nom : '—'}
        note={premier.series > 0 ? `${premier.series} série${premier.series > 1 ? 's' : ''}${second.series > 0 ? ` · ${second.nom} ${second.series}` : ''}` : 'Aucune série cette semaine'}
      >
        {premier.series > 0 ? <MiniBarres valeurs={groupes.map((g) => g.series)} max={premier.series} couleur={p.sportMuscu} etiquette="Séries par groupe musculaire cette semaine" /> : null}
      </Tuile>
    );
  }

  return (
    <Bloc titre="Séries par groupe">
      <View style={[styles.corps, { backgroundColor: p.surface2 }]}>
        <SilhouetteCorps muscles={musclesSurPeriode(contexte.force.series)} etiquette="Muscles travaillés cette semaine" />
      </View>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  corps: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, borderRadius: rayon.l },
});
