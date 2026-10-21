import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { formatAllure100m } from '@/data/format';
import { allureNatation } from '@/data/natation';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'allure de natation au 100 m : les 4 dernières semaines, comparées aux 4 d'avant. Plus bas = plus rapide.
// tuile (taille S, M ou XS) : la version tuile, voir Tuile.
const minSec = (s: number) => `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;

export function WidgetNatAllure({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const a = allureNatation(contexte.toutesSeances);
  // Évolution négative = plus rapide = mieux (le contraire de la plupart des chiffres)
  const note = a.evolutionPct != null ? `${a.evolutionPct < 0 ? 'plus rapide' : a.evolutionPct > 0 ? 'plus lent' : 'stable'} de ${Math.abs(a.evolutionPct)} %` : 'sur 4 semaines';

  if (tuile) {
    return <Tuile titre="Allure natation" valeur={a.actuelle != null ? minSec(a.actuelle) : '—'} unite={a.actuelle != null ? '/100 m' : ''} note={a.actuelle != null ? note : 'Pas encore de natation'} />;
  }

  const mieux = a.evolutionPct != null && a.evolutionPct < 0;
  return (
    <CadreWidget titre="Allure au 100 m">
      {a.actuelle != null ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {minSec(a.actuelle)}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> /100 m</Text>
            </Text>
            {a.evolutionPct != null ? (
              <View style={[styles.badge, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: mieux ? p.ok : p.texteDoux }]}>{note}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typo.petit, { color: p.texteDoux }]}>4 dernières semaines : {formatAllure100m(a.actuelle)}</Text>
          {a.precedente != null ? <Text style={[typo.petit, { color: p.texteDoux }]}>4 semaines d'avant : {formatAllure100m(a.precedente)}</Text> : null}
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore assez de natation (séances de 300 m ou plus) pour calculer ton allure.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 8, marginBottom: 10 },
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
