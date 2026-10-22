import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { CourbeLissee } from '@/components/CourbeLissee';
import { ListeCompacte } from '@/components/ListeCompacte';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formatChrono, formatDateCourte } from '@/data/format';
import { formatEcartLong } from '@/data/hyrox';
import { evolutionTotal } from '@/data/hyrox-suivi';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps total de tes tests et de tes courses, du premier au dernier : il baisse quand tu progresses.
//  - XS : le dernier temps et ce que tu as gagné depuis le premier ; S : + la courbe ; M : + la courbe remplie, plus grande ;
//  - L : + trois repères (premier, dernier, record) et la liste de tes tests les plus récents.
export function WidgetHyroxEvolution({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const e = evolutionTotal(contexte.hyrox.tests);
  // Un temps plus bas est meilleur : on inverse pour que « mieux » monte sur la courbe
  const valeurs = e ? e.points.map((pt) => -pt.total) : [];
  const courbe = valeurs.length >= 2;
  const note = !e ? 'Aucun test' : e.points.length < 2 ? '1 test, le suivant montrera ta progression' : `${formatEcartLong(e.ecart)} depuis le premier`;

  if (taille !== 'l') {
    return (
      <Tuile titre="Temps total" valeur={e ? formatChrono(e.dernier.total) : '—'} note={note} large>
        {!e || !courbe ? null : taille === 's' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportHybride} hauteur={34} aire={false} pointFinal={false} etiquette="Temps total de tes tests Hyrox, du premier au dernier" />
        ) : taille === 'm' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportHybride} largeur={220} hauteur={90} etiquette="Temps total de tes tests Hyrox, du premier au dernier" />
        ) : null}
      </Tuile>
    );
  }

  const recents = e ? [...e.points].reverse().slice(0, 5) : [];
  return (
    <CadreWidget titre="Évolution du temps total">
      {e ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>{formatChrono(e.dernier.total)}</Text>
            <View style={[styles.badge, { backgroundColor: e.estRecord && e.points.length > 1 ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.badgeTexte, { color: e.estRecord && e.points.length > 1 ? p.ok : p.texteDoux }]}>
                {e.points.length < 2 ? '1 test' : e.estRecord ? 'Record' : `${formatEcartLong(e.dernier.total - e.record)} du record`}
              </Text>
            </View>
          </View>
          {courbe ? <CourbeLissee valeurs={valeurs} couleur={p.sportHybride} hauteur={92} etiquette="Temps total de tes tests Hyrox, du premier au dernier" /> : null}
          <View style={styles.reperes}>
            <StatCle etiquette="Premier" valeur={formatChrono(e.premier.total)} petit />
            <StatCle etiquette="Dernier" valeur={formatChrono(e.dernier.total)} petit />
            <StatCle etiquette="Record" valeur={formatChrono(e.record)} petit />
          </View>
          <View style={{ marginTop: 12 }}>
            <ListeCompacte
              lignes={recents.map((pt) => ({ cle: pt.id, nom: `${formatDateCourte(pt.date)} · ${pt.kind === 'course' ? 'Course' : 'Test'}`, valeur: formatChrono(pt.total), couleur: pt.total === e.record ? p.ok : undefined }))}
            />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Tes tests et courses Hyrox, du plus ancien au plus récent. En vert : ton record.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de test. Enregistre une simulation ou une course Hyrox pour suivre ton temps total.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  reperes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
