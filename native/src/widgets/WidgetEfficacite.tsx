import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { CourbeLissee } from '@/components/CourbeLissee';
import { formatAllure } from '@/data/format';
import { efficaciteCourse } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Allure moyenne des sorties faciles, semaine après semaine : elle baisse quand la condition monte.
// tuile : tuile (l'allure du moment + la courbe sur 12 semaines).
export function WidgetEfficacite({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const eff = efficaciteCourse(contexte.toutesSeances, contexte.hrMax);
  // Une allure plus basse (en s/km) est plus rapide : on inverse pour que « mieux » monte sur le graphique
  const valeurs = eff ? eff.points.map((pt) => -pt.allure) : [];
  const mieux = !!eff && eff.amelioration > 0;

  if (tuile) {
    return (
      <Tuile
        titre="Allure cardio"
        valeur={eff ? formatAllure(eff.allureActuelle) : '—'}
        note={eff ? `${mieux ? '+' : ''}${eff.amelioration.toString().replace('.', ',')} % en 12 sem.` : 'Pas assez de sorties'}
      >
        {eff ? <CourbeLissee valeurs={valeurs} couleur={p.sportCourse} hauteur={34} aire={false} pointFinal={false} etiquette="Allure en endurance à cardio égal sur 12 semaines" /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Allure à cardio égal">
      {eff ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.allure, { color: p.texte }]}>{formatAllure(eff.allureActuelle)}</Text>
            <View style={[styles.variation, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.variationTexte, { color: mieux ? p.ok : p.texteDoux }]}>
                {mieux ? '+' : ''}
                {eff.amelioration.toString().replace('.', ',')} % en 12 semaines
              </Text>
            </View>
          </View>
          <CourbeLissee valeurs={valeurs} couleur={p.sportCourse} hauteur={120} etiquette="Allure en endurance à cardio égal sur 12 semaines" />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Sorties de plus de 3 km à 60–80 % de ta fréquence cardiaque max, regroupées par semaine.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut au moins trois semaines de sorties faciles avec cardio pour tracer ton efficacité.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  allure: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  variation: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  variationTexte: { fontFamily: police.texte600 },
});
