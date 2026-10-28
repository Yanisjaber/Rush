import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/graphes/BarresEmpilees';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { MiniBarres } from '@/components/graphes/MiniBarres';
import { Tuile } from '@/components/ui/Tuile';
import { chargeParSemaine, conditionHebdo } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La charge d'entraînement par semaine et par sport sur 12 semaines, avec la courbe de condition par-dessus.
export function WidgetCharge({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const charge = chargeParSemaine(contexte.seances);
  const condition = conditionHebdo(contexte.metriques);
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;
  const series = charge.series.map((s) => ({ nom: s.nom, valeurs: s.valeurs, couleur: couleurSport(p, s.nom) }));

  // Charge totale de chaque semaine, tous sports confondus (la dernière = les 7 derniers jours)
  const totaux = charge.etiquettes.map((_, i) => Math.round(charge.series.reduce((somme, s) => somme + (s.valeurs[i] ?? 0), 0)));
  const derniere = totaux[totaux.length - 1] ?? 0;
  const avant = totaux[totaux.length - 2] ?? 0;
  const ecart = avant > 0 ? Math.round(((derniere - avant) / avant) * 100) : null;
  const texteEcart = ecart != null ? `${ecart > 0 ? '+' : ''}${ecart} % vs semaine d'avant` : 'cette semaine';

  // XS : le chiffre ; S : + les 8 dernières semaines en barres ; M : + les 12 semaines empilées par sport avec la condition
  if (taille !== 'l') {
    return (
      <Tuile titre="Charge, 7 jours" valeur={totaux.length ? String(derniere) : '—'} note={totaux.length ? (taille === 'm' ? texteEcart : ecart != null ? `${ecart > 0 ? '+' : ''}${ecart} %` : 'cette semaine') : 'Pas encore de séance'} large>
        {!totaux.length ? null : taille === 's' ? (
          <MiniBarres valeurs={totaux.slice(-8)} couleur={p.sportNeutre} etiquette="Charge par semaine sur 8 semaines" />
        ) : taille === 'm' ? (
          <BarresEmpilees series={series} etiquettes={[]} ligne={condition} hauteur={84} etiquette="Charge par semaine et par sport sur 12 semaines, avec la courbe de condition" />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Charge d'entraînement">
      {charge.series.length ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {derniere}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> pts, 7 jours</Text>
            </Text>
            {ecart != null ? (
              <View style={[styles.badge, { backgroundColor: p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: p.texteDoux }]}>{texteEcart}</Text>
              </View>
            ) : null}
          </View>
          <BarresEmpilees series={series} etiquettes={charge.etiquettes} ligne={condition} hauteur={118} etiquette="Charge par semaine et par sport sur 12 semaines, avec la courbe de condition" />
          <View style={styles.legende}>
            {charge.series.map((s) => (
              <View key={s.nom} style={styles.item}>
                <View style={[styles.carre, { backgroundColor: couleurSport(p, s.nom) }]} />
                <Text style={[typo.petit, { color: p.texteDoux }]}>{nom(s.nom)}</Text>
              </View>
            ))}
            {condition.length ? (
              <View style={styles.item}>
                <View style={[styles.trait, { backgroundColor: p.texte }]} />
                <Text style={[typo.petit, { color: p.texteDoux }]}>Condition</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séance sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 6, marginBottom: 10 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
  trait: { width: 16, height: 3, borderRadius: 2 },
});
