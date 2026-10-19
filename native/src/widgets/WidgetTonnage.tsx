import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { Bloc } from '@/components/Bloc';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { tonnageParSemaine } from '@/data/force';
import { formatNombre } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le tonnage (répétitions × charge) soulevé chaque semaine, sur 12 semaines.
// compact : tuile pour téléphone (chiffre clé + mini histogramme).
export function WidgetTonnage({ contexte, compact = false }: WidgetProps) {
  const p = usePalette();
  const t = tonnageParSemaine(contexte.force.series);
  const aDesDonnees = t.parSemaine.some((v) => v > 0);

  if (compact) {
    return (
      <Tuile
        titre="Tonnage / semaine"
        valeur={aDesDonnees ? formatNombre(t.derniere) : '—'}
        unite={aDesDonnees ? 'kg' : ''}
        note={aDesDonnees ? (t.ecartPct != null ? `${t.ecartPct > 0 ? '+' : ''}${t.ecartPct} % vs moyenne` : '12 dernières semaines') : 'Pas encore de séries'}
      >
        {aDesDonnees ? <MiniBarres valeurs={t.parSemaine.slice(-8)} couleur={p.sportMuscu} etiquette="Tonnage par semaine sur 8 semaines" /> : null}
      </Tuile>
    );
  }

  const mieux = t.ecartPct != null && t.ecartPct >= 0;
  return (
    <Bloc titre="Tonnage par semaine">
      {aDesDonnees ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {formatNombre(t.derniere)}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> kg</Text>
            </Text>
            {t.ecartPct != null ? (
              <View style={[styles.badge, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: mieux ? p.ok : p.texteDoux }]}>
                  {t.ecartPct > 0 ? '+' : ''}
                  {t.ecartPct} % vs moyenne
                </Text>
              </View>
            ) : null}
            <Text style={[typo.petit, styles.periode, { color: p.texteDoux }]}>12 dernières semaines</Text>
          </View>
          <BarresHebdo valeurs={t.parSemaine} couleur={p.sportMuscu} etiquette="Tonnage soulevé par semaine sur 12 semaines" />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Tonnage = répétitions × charge, additionné sur 7 jours glissants.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séries enregistrées. Démarre une séance pour voir ton tonnage.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 8, marginBottom: 14 },
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
  periode: { marginLeft: 'auto' },
});
