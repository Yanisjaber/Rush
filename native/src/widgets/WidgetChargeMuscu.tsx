import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { CadreWidget } from '@/components/CadreWidget';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { chargeMuscuRecente } from '@/data/charge-muscu';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Charge de musculation : répétitions × (poids ÷ ton 1RM de l'exercice), sur 7 jours glissants.
// Le badge compare à ton habitude ; la barre en couleur est la semaine en cours.
// tuile (taille S, M ou XS) : la version tuile, voir Tuile.
export function WidgetChargeMuscu({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const c = chargeMuscuRecente(contexte.force.series);
  const aDesDonnees = c.parSemaine.some((v) => v > 0);
  const pct = c.ratio == null ? null : Math.round((c.ratio - 1) * 100);

  if (tuile) {
    return (
      <Tuile
        titre="Charge muscu"
        valeur={aDesDonnees ? String(c.derniere) : '—'}
        unite={aDesDonnees ? 'pts' : ''}
        note={aDesDonnees ? (pct != null ? `${pct > 0 ? '+' : ''}${pct} % vs habitude` : '7 derniers jours') : 'Aucune série récente'}
      >
        {aDesDonnees ? <MiniBarres valeurs={c.parSemaine.slice(-8)} couleur={p.sportMuscu} etiquette="Charge de musculation par semaine sur 8 semaines" /> : null}
      </Tuile>
    );
  }

  const haut = c.zone.cle === 'attention' || c.zone.cle === 'danger';
  const mieux = c.zone.cle === 'ok';
  return (
    <CadreWidget titre="Charge musculation">
      {aDesDonnees ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {c.derniere}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> pts</Text>
            </Text>
            {pct != null ? (
              <View style={[styles.badge, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : haut ? avecAlpha(p.alerte, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: mieux ? p.ok : haut ? p.alerte : p.texteDoux }]}>
                  {pct > 0 ? '+' : ''}
                  {pct} % vs habitude
                </Text>
              </View>
            ) : null}
            <Text style={[typo.petit, styles.periode, { color: p.texteDoux }]}>12 dernières semaines</Text>
          </View>
          <BarresHebdo valeurs={c.parSemaine} couleur={p.sportMuscu} etiquette="Charge de musculation par semaine sur 12 semaines" />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>
            {c.zone.cle === 'inconnu' ? "Pas encore assez d'historique pour te comparer à ton habitude." : `Charge ${c.zone.libelle}.`}
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Aucune série sur les 12 dernières semaines. Enregistre une séance pour voir ta charge.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 8, marginBottom: 14 },
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
  periode: { marginLeft: 'auto' },
});
