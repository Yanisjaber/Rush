import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formeActuelle } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Forme, condition et fatigue du moment (dernier jour de la courbe de charge).
// Forme = condition − fatigue : positive quand on est frais, négative quand on est fatigué.
const signe = (n: number) => `${n > 0 ? '+' : ''}${n}`;

// tuile : tuile (la forme en gros, condition et fatigue en note).
export function WidgetForme({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const forme = formeActuelle(contexte.metriques);

  if (tuile) {
    return (
      <Tuile
        titre="Forme"
        valeur={forme ? signe(forme.tsb) : '—'}
        note={forme ? `${forme.libelle} · cond. ${forme.ctl}, fat. ${forme.atl}` : 'Pas encore de données'}
      />
    );
  }

  return (
    <Bloc titre="Forme">
      {forme ? (
        <View style={styles.stats}>
          <StatCle etiquette="Forme" valeur={signe(forme.tsb)} note={forme.libelle} couleur={forme.tsb >= 5 ? p.ok : undefined} />
          <StatCle etiquette="Condition" valeur={String(forme.ctl)} />
          <StatCle etiquette="Fatigue" valeur={String(forme.atl)} />
        </View>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de données de forme.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 16 },
});
