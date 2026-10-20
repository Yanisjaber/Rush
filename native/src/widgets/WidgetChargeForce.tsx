import { StyleSheet, Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { seancesForce } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La force qui soutient le Hyrox (sled, farmers, lunges, wall balls) : combien de séances par semaine.
// tuile : tuile (séances de force par semaine, en moyenne).
export function WidgetChargeForce({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const force = seancesForce(contexte.toutesSeances, 4);
  const note = force.total
    ? `${force.total} séance${force.total > 1 ? 's' : ''} de force sur les 4 dernières semaines.`
    : 'Aucune séance de force sur les 4 dernières semaines.';

  if (tuile) {
    return <Tuile titre="Charge de force" valeur={String(force.moyenne).replace('.', ',')} unite="/sem." note={`${force.total} séance${force.total > 1 ? 's' : ''} en 4 semaines`} />;
  }

  return (
    <CadreWidget couleur={p.sportHybride}>
      <Text style={[typo.micro, styles.etiquette, { color: p.encreSurCouleur }]}>Charge de force</Text>
      <Text style={[styles.valeur, { color: p.encreSurCouleur }]}>
        {String(force.moyenne).replace('.', ',')}
        <Text style={styles.unite}> /sem.</Text>
      </Text>
      <Text style={[typo.petit, styles.note, { color: p.encreSurCouleur }]}>{note}</Text>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  etiquette: { fontFamily: police.texte600 },
  valeur: { fontFamily: police.titre800, fontSize: 72, lineHeight: 66, marginTop: 8 },
  unite: { fontFamily: police.titre700, fontSize: 24 },
  note: { marginTop: 12 },
});
