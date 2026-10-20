import { StyleSheet, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
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
// tuile (taille S, M ou XS) : la version tuile, voir Tuile.
export function WidgetGroupes({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const groupes = [...seriesParGroupe(contexte.force.series)].sort((a, b) => b.series - a.series);
  const [premier, second] = groupes;

  if (tuile) {
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
    <CadreWidget titre="Séries par groupe">
      <View style={[styles.corps, { backgroundColor: p.surface2 }]}>
        {/* Largeur fixée pour que les deux silhouettes (hautes du double de leur largeur) tiennent dans la boîte L */}
        <View style={styles.silhouettes}>
          <SilhouetteCorps muscles={musclesSurPeriode(contexte.force.series)} etiquette="Muscles travaillés cette semaine" />
        </View>
      </View>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  silhouettes: { width: 200, alignSelf: 'center' },
  corps: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, borderRadius: rayon.l },
});
