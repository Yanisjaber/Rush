import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { formatAllure100m, formatDateCourte, formatDuree, formatNombre } from '@/data/format';
import { meilleuresNatation } from '@/data/natation';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La séance de natation la plus longue et la plus rapide (au moins 500 m) sur la période chargée.
// tuile (taille S, M ou XS) : la plus longue en gros, l'allure de la plus rapide en note.
export function WidgetNatLongue({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const m = meilleuresNatation(contexte.toutesSeances);
  const metres = (km: number) => formatNombre(Math.round(km * 1000));

  if (tuile) {
    return (
      <Tuile
        titre="Plus longue natation"
        valeur={m.plusLongue ? metres(m.plusLongue.km) : '—'}
        unite={m.plusLongue ? 'm' : ''}
        note={m.plusRapide ? `Record : ${formatAllure100m(m.plusRapide.allure)}` : m.plusLongue ? '12 dernières semaines' : 'Pas encore de natation'}
      />
    );
  }

  const lignes = [
    m.plusLongue && { cle: 'longue', nom: 'Plus longue', valeur: `${metres(m.plusLongue.km)} m`, detail: `${formatDuree(m.plusLongue.secondes)} · ${formatDateCourte(m.plusLongue.date)}` },
    m.plusRapide && { cle: 'rapide', nom: 'Plus rapide (≥ 500 m)', valeur: formatAllure100m(m.plusRapide.allure), detail: `${metres(m.plusRapide.km)} m · ${formatDateCourte(m.plusRapide.date)}` },
  ].filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <CadreWidget titre="Meilleures natations">
      {lignes.length ? (
        lignes.map((l, i) => (
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
            {/* Un grand chiffre coloré : réservé au gros corps (≥ 18 pt), la couleur de natation en clair est trop pâle pour du petit texte */}
            <Text style={[styles.valeur, { color: p.sportNatation }]}>{l.valeur}</Text>
          </View>
        ))
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de natation sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texte: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
