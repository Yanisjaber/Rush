import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { CadreWidget } from '@/components/CadreWidget';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { chargeParSemaine, conditionHebdo } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La charge d'entraînement par semaine et par sport sur 12 semaines, avec la courbe de condition par-dessus.
// tuile : tuile (charge des 7 derniers jours + les 8 dernières semaines en barres).
export function WidgetCharge({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const charge = chargeParSemaine(contexte.seances);
  const condition = conditionHebdo(contexte.metriques);
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;

  if (tuile) {
    // Charge totale de chaque semaine, tous sports confondus (la dernière = les 7 derniers jours)
    const totaux = charge.etiquettes.map((_, i) => Math.round(charge.series.reduce((somme, s) => somme + (s.valeurs[i] ?? 0), 0)));
    const derniere = totaux[totaux.length - 1] ?? 0;
    const avant = totaux[totaux.length - 2] ?? 0;
    const ecart = avant > 0 ? Math.round(((derniere - avant) / avant) * 100) : null;
    return (
      <Tuile
        titre="Charge, 7 jours"
        valeur={totaux.length ? String(derniere) : '—'}
        note={totaux.length ? (ecart != null ? `${ecart > 0 ? '+' : ''}${ecart} %` : 'cette semaine') : 'Pas encore de séance'}
      >
        {totaux.length ? <MiniBarres valeurs={totaux.slice(-8)} couleur={p.sportNeutre} etiquette="Charge par semaine sur 8 semaines" /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Charge d'entraînement">
      {charge.series.length ? (
        <>
          <BarresEmpilees
            series={charge.series.map((s) => ({ nom: s.nom, valeurs: s.valeurs, couleur: couleurSport(p, s.nom) }))}
            etiquettes={charge.etiquettes}
            ligne={condition}
            hauteur={150}
            etiquette="Charge par semaine et par sport sur 12 semaines, avec la courbe de condition"
          />
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
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
  trait: { width: 16, height: 3, borderRadius: 2 },
});
