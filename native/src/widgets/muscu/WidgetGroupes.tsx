import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { MiniBarres } from '@/components/MiniBarres';
import { SilhouetteCorps } from '@/components/SilhouetteCorps';
import { Tuile } from '@/components/Tuile';
import { seriesParGroupe } from '@/data/sports/force';
import { musclesSurPeriode } from '@/data/sports/muscu';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les séries de la semaine par groupe musculaire.
//  - XS : le groupe le plus travaillé ; S : + une barre par groupe ; M : + les quatre premiers groupes en liste ;
//  - L : le corps de face et de dos (chaque muscle teinté selon ses séries des 7 derniers jours) et les groupes avec leurs séries.
export function WidgetGroupes({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const groupes = [...seriesParGroupe(contexte.force.series)].sort((a, b) => b.series - a.series);
  const [premier, second] = groupes;
  const total = groupes.reduce((n, g) => n + g.series, 0);

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Séries / semaine"
        valeur={premier.series > 0 ? premier.nom : '—'}
        note={premier.series > 0 ? (taille === 'm' ? `${premier.series} série${premier.series > 1 ? 's' : ''} · ${total} en tout` : `${premier.series} série${premier.series > 1 ? 's' : ''}${second.series > 0 ? ` · ${second.nom} ${second.series}` : ''}`) : 'Aucune série cette semaine'}
        large
      >
        {premier.series <= 0 ? null : taille === 's' ? (
          <MiniBarres valeurs={groupes.map((g) => g.series)} max={premier.series} couleur={p.sportMuscu} etiquette="Séries par groupe musculaire cette semaine" />
        ) : taille === 'm' ? (
          <ListeCompacte lignes={groupes.slice(0, 4).map((g) => ({ cle: g.groupe, nom: g.nom, valeur: `${g.series} série${g.series > 1 ? 's' : ''}` }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Séries par groupe">
      <View style={styles.ligne}>
        <View style={[styles.corps, { backgroundColor: p.surface2 }]}>
          <SilhouetteCorps muscles={musclesSurPeriode(contexte.force.series)} etiquette="Muscles travaillés cette semaine" />
        </View>
        <View style={styles.groupes}>
          {groupes.slice(0, 6).map((g) => (
            <View key={g.groupe} style={styles.groupe}>
              <Text numberOfLines={1} style={[typo.petit, styles.nom, { color: p.texte }]}>
                {g.nom}
              </Text>
              <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                <View style={[styles.barre, { width: `${premier.series ? Math.max(g.series > 0 ? 8 : 0, (g.series / premier.series) * 100) : 0}%`, backgroundColor: p.sportMuscu }]} />
              </View>
              <Text style={[styles.valeur, { color: g.series > 0 ? p.texte : p.texteMuet }]}>{g.series}</Text>
            </View>
          ))}
        </View>
      </View>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  corps: { width: 150, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, borderRadius: rayon.l },
  groupes: { flex: 1, minWidth: 0, gap: 8 },
  groupe: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nom: { width: 62 },
  piste: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barre: { height: '100%', borderRadius: 5 },
  valeur: { width: 22, textAlign: 'right', fontFamily: police.texte600, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
