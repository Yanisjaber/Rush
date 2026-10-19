import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { Bloc } from '@/components/Bloc';
import { chargeParSemaine, conditionHebdo } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La charge d'entraînement par semaine et par sport sur 12 semaines, avec la courbe de condition par-dessus.
export function WidgetCharge({ contexte, taille = 'l' }: WidgetProps) {
  const p = usePalette();
  const charge = chargeParSemaine(contexte.seances);
  const condition = conditionHebdo(contexte.metriques);
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;

  return (
    <Bloc titre="Charge d'entraînement">
      {charge.series.length ? (
        <>
          <BarresEmpilees
            series={charge.series.map((s) => ({ nom: s.nom, valeurs: s.valeurs, couleur: couleurSport(p, s.nom) }))}
            etiquettes={charge.etiquettes}
            ligne={condition}
            hauteur={taille === 'xl' ? 260 : 220}
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
    </Bloc>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
  trait: { width: 16, height: 3, borderRadius: 2 },
});
