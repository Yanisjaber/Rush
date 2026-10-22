import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte, formatDuree, formatKm, formatNombre } from '@/data/format';
import { meilleuresSorties, type SportDenivele } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes meilleures sorties de trail ou de VTT des 12 dernières semaines : le plus gros dénivelé, la plus longue distance, la plus longue durée.
//  - XS : le plus gros D+ ; S : + la plus longue en note ; M : + les trois records en liste ; L : le détail de chacun et le top 5 des D+.
export function MeilleuresSortiesDenivele({ contexte, taille = 'm', sport }: WidgetProps & { sport: SportDenivele }) {
  const p = usePalette();
  const m = meilleuresSorties(contexte.toutesSeances, sport);
  const couleur = sport === 'vtt' ? p.sportVelo : p.sportCourse;
  const nomSport = sport === 'vtt' ? 'VTT' : 'trail';
  const lignes = [
    m.plusGrosDPlus && { cle: 'dplus', nom: 'Plus gros D+', valeur: `${formatNombre(m.plusGrosDPlus.dPlus)} m`, detail: `${formatKm(m.plusGrosDPlus.km)} km · ${formatDateCourte(m.plusGrosDPlus.date)}` },
    m.plusLongue && { cle: 'longue', nom: 'Plus longue', valeur: `${formatKm(m.plusLongue.km)} km`, detail: `${formatNombre(m.plusLongue.dPlus)} m de D+ · ${formatDateCourte(m.plusLongue.date)}` },
    m.plusLongueDuree && { cle: 'duree', nom: 'Plus longue durée', valeur: formatDuree(m.plusLongueDuree.secondes), detail: `${formatKm(m.plusLongueDuree.km)} km · ${formatDateCourte(m.plusLongueDuree.date)}` },
  ].filter((l): l is NonNullable<typeof l> => !!l);

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Meilleures sorties"
        valeur={m.plusGrosDPlus ? formatNombre(m.plusGrosDPlus.dPlus) : '—'}
        unite={m.plusGrosDPlus ? 'm D+' : ''}
        note={taille === 'm' && m.plusGrosDPlus ? `${formatKm(m.plusGrosDPlus.km)} km · ${formatDateCourte(m.plusGrosDPlus.date)}` : m.plusLongue ? `Plus longue : ${formatKm(m.plusLongue.km)} km` : `Pas encore de ${nomSport}`}
        large
      >
        {taille === 'm' && lignes.length ? <ListeCompacte lignes={lignes.map((l) => ({ cle: l.cle, nom: l.nom, valeur: l.valeur }))} /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre={`Meilleures sorties de ${nomSport}`}>
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
              <Text style={[styles.valeur, { color: couleur }]}>{l.valeur}</Text>
            </View>
          ))}
          {m.top.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginBottom: 4 }]}>
                Top des dénivelés
              </Text>
              <ListeCompacte lignes={m.top.map((s) => ({ cle: s.id, nom: `${formatDateCourte(s.date)}${s.nom ? ` · ${s.nom}` : ''}`, valeur: `${formatNombre(s.dPlus)} m` }))} />
            </View>
          ) : null}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Sur les 12 dernières semaines.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{`Pas encore de sortie de ${nomSport} sur les 12 dernières semaines.`}</Text>
      )}
    </CadreWidget>
  );
}

export function WidgetMeilleuresTrail(props: WidgetProps) {
  return <MeilleuresSortiesDenivele {...props} sport="trail" />;
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texte: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
