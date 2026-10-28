import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatHeuresMinutes } from '@/data/outils/format';
import { disciplinesDe, minutesParSemaine, repartitionDisciplines } from '@/data/sports/triathlon';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { couleurDiscipline, NOM_COURT, NOM_DISCIPLINE } from './disciplines';

// Où passe ton temps d'entraînement entre les disciplines (4 dernières semaines) : natation, vélo, course ; vélo et course pour le duathlon.
//  - XS : les trois parts en % ; S : + la barre de répartition ; M : + le temps de chaque discipline ;
//  - L : + le temps de chaque semaine, empilé par discipline, sur 8 semaines.
export function WidgetTriEquilibre({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const disciplines = disciplinesDe(contexte.filtre);
  const rep = repartitionDisciplines(contexte.toutesSeances, disciplines);

  const barre = rep ? (
    <View accessible accessibilityRole="image" accessibilityLabel={`Répartition du temps : ${rep.parts.map((x) => `${NOM_DISCIPLINE[x.cle]} ${x.pct} %`).join(', ')}`} style={styles.barre}>
      {rep.parts.map((x) => (x.temps > 0 ? <View key={x.cle} style={{ flex: x.temps, backgroundColor: couleurDiscipline(p, x.cle) }} /> : null))}
    </View>
  ) : null;

  if (taille !== 'l') {
    return (
      <Tuile titre="Répartition" valeur={rep ? rep.parts.map((x) => x.pct).join(' · ') : '—'} unite={rep ? '%' : ''} note={rep ? disciplines.map((d) => NOM_COURT[d]).join(' · ') : 'Pas encore de séance'} large>
        {!rep ? null : taille === 's' ? (
          barre
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre}
            <ListeCompacte lignes={rep.parts.map((x) => ({ cle: x.cle, nom: NOM_DISCIPLINE[x.cle], valeur: formatHeuresMinutes(x.temps), point: couleurDiscipline(p, x.cle) }))} />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const semaines = minutesParSemaine(contexte.toutesSeances, disciplines, 8);
  return (
    <CadreWidget titre="Répartition par discipline">
      {rep ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {formatHeuresMinutes(rep.total)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> sur 4 semaines</Text>
          </Text>
          {barre}
          <View style={styles.parts}>
            {rep.parts.map((x) => (
              <View key={x.cle} accessible accessibilityLabel={`${NOM_DISCIPLINE[x.cle]}, ${formatHeuresMinutes(x.temps)}, ${x.pct} %`} style={styles.part}>
                <View style={[styles.carre, { backgroundColor: couleurDiscipline(p, x.cle) }]} />
                <View>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{NOM_DISCIPLINE[x.cle]}</Text>
                  <Text style={[styles.pct, { color: p.texte }]}>{x.pct} %</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{formatHeuresMinutes(x.temps)}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginTop: 16, marginBottom: 6 }]}>
            Semaine après semaine
          </Text>
          <BarresEmpilees
            series={semaines.map((s) => ({ nom: NOM_DISCIPLINE[s.cle], couleur: couleurDiscipline(p, s.cle), valeurs: s.minutes }))}
            etiquettes={[]}
            hauteur={110}
            etiquette={`Temps par semaine et par discipline sur 8 semaines : ${disciplines.map((d) => NOM_DISCIPLINE[d]).join(', ')}`}
          />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Le temps de toutes tes séances de {disciplines.map((d) => NOM_DISCIPLINE[d].toLowerCase()).join(', ')}, hors musculation.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séance sur les 4 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 },
  total: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginBottom: 10 },
  parts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  carre: { width: 10, height: 10, borderRadius: 2, marginTop: 5 },
  pct: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
