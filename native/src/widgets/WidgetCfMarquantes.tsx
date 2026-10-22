import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte, formatDuree } from '@/data/format';
import { seancesMarquantes } from '@/data/crossfit';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes séances de CrossFit les plus marquantes des 12 dernières semaines : la plus longue, la plus lourde (charge), la plus intense (cardio).
//  - XS : la plus longue ; S : + la plus lourde en note ; M : + les trois en liste ; L : le détail de chacune et le top 5 des charges.
export function WidgetCfMarquantes({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const m = seancesMarquantes(contexte.toutesSeances);
  const lignes = [
    m.plusLongue && { cle: 'longue', nom: 'Plus longue', valeur: formatDuree(m.plusLongue.secondes), detail: `${m.plusLongue.nom ?? 'Séance'} · ${formatDateCourte(m.plusLongue.date)}` },
    m.plusLourde && { cle: 'lourde', nom: 'Plus lourde', valeur: `${m.plusLourde.charge} pts`, detail: `${m.plusLourde.nom ?? 'Séance'} · ${formatDateCourte(m.plusLourde.date)}` },
    m.plusIntense && { cle: 'intense', nom: 'Plus intense', valeur: `${m.plusIntense.fc} bpm`, detail: `${m.plusIntense.nom ?? 'Séance'} · ${formatDateCourte(m.plusIntense.date)}` },
  ].filter((l): l is NonNullable<typeof l> => !!l);

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Séances marquantes"
        valeur={m.plusLongue ? formatDuree(m.plusLongue.secondes) : '—'}
        note={taille === 'm' && m.plusLongue ? `${m.plusLongue.nom ?? 'Séance'} · ${formatDateCourte(m.plusLongue.date)}` : m.plusLourde ? `Plus lourde : ${m.plusLourde.charge} pts` : m.plusLongue ? 'la plus longue, 12 semaines' : 'Pas encore de CrossFit'}
        large
      >
        {taille === 'm' && lignes.length ? <ListeCompacte lignes={lignes.map((l) => ({ cle: l.cle, nom: l.nom, valeur: l.valeur }))} /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Séances marquantes">
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
                <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
                  {l.detail}
                </Text>
              </View>
              {/* Un grand chiffre coloré : réservé au gros corps (≥ 18 pt), car le jaune du CrossFit en clair est trop pâle pour du petit texte */}
              <Text style={[styles.valeur, { color: p.sportHybrideTexte }]}>{l.valeur}</Text>
            </View>
          ))}
          {m.top.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginBottom: 4 }]}>
                Les plus fortes charges
              </Text>
              <ListeCompacte lignes={m.top.map((s) => ({ cle: s.id, nom: `${formatDateCourte(s.date)}${s.nom ? ` · ${s.nom}` : ''}`, valeur: `${s.charge} pts` }))} />
            </View>
          ) : null}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Sur tes séances de CrossFit et de HIIT des 12 dernières semaines.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séance de CrossFit sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texte: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
