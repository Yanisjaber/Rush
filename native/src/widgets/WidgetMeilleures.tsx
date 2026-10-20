import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { formatAllure, formatDateCourte, formatDuree, formatKm } from '@/data/format';
import { meilleuresSortiesCourse } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La sortie la plus longue et les sorties les plus rapides sur 5 et 10 km.
// tuile : tuile (la sortie la plus longue en gros, l'allure de la plus rapide en note).
export function WidgetMeilleures({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const m = meilleuresSortiesCourse(contexte.toutesSeances);
  const lignes = [
    m.plusLongue && { cle: 'longue', nom: 'Plus longue', valeur: `${formatKm(m.plusLongue.valeur.km)} km`, detail: `${formatDuree(m.plusLongue.valeur.secondes)} · ${formatDateCourte(m.plusLongue.date)}` },
    m.rapide5 && { cle: 'r5', nom: 'Plus rapide (≥ 5 km)', valeur: formatAllure(m.rapide5.valeur.allure), detail: `${formatKm(m.rapide5.valeur.km)} km · ${formatDateCourte(m.rapide5.date)}` },
    m.rapide10 && { cle: 'r10', nom: 'Plus rapide (≥ 10 km)', valeur: formatAllure(m.rapide10.valeur.allure), detail: `${formatKm(m.rapide10.valeur.km)} km · ${formatDateCourte(m.rapide10.date)}` },
  ].filter((l): l is NonNullable<typeof l> => !!l);

  if (tuile) {
    return (
      <Tuile
        titre="Sortie longue"
        valeur={m.plusLongue ? formatKm(m.plusLongue.valeur.km) : '—'}
        unite={m.plusLongue ? 'km' : ''}
        note={m.rapide5 ? `Record 5 km+ : ${formatAllure(m.rapide5.valeur.allure)}` : m.plusLongue ? '12 dernières semaines' : 'Pas encore de sortie'}
      />
    );
  }

  return (
    <CadreWidget titre="Meilleures sorties">
      {lignes.length ? (
        <>
          {lignes.map((l, i) => (
            <View
              key={l.cle}
              accessible
              accessibilityLabel={`${l.nom}, ${l.valeur}, ${l.detail}`}
              style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, i === 0 && { paddingTop: 0 }]}
            >
              <View style={styles.texte}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>{l.nom}</Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{l.detail}</Text>
              </View>
              {/* Un grand chiffre coloré : réservé au gros corps (≥ 18 pt), car la couleur de course en clair est trop pâle pour du petit texte */}
              <Text style={[styles.valeur, { color: p.sportCourse }]}>{l.valeur}</Text>
            </View>
          ))}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Sur les 12 dernières semaines.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de sortie de course sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texte: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
