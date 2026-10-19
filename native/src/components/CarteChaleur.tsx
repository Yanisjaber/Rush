import { StyleSheet, View } from 'react-native';
import type { CaseRegularite } from '@/data/synthese';
import { couleurSport } from '@/theme/sports';
import { usePalette } from '@/theme/usePalette';

// Carte de chaleur de la régularité : une case par jour, la couleur est celle du sport dominant.
// L'ordre est celui de casesRegularite : rangée par rangée (lundi → dimanche), semaine par semaine.
// Intensité : 1 = léger, 2 = moyen, 3 = fort (l'opacité de la couleur suit).
interface Props {
  cases: CaseRegularite[];
  colonnes?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const OPACITES = [1, 0.35, 0.6, 1];

export function CarteChaleur({ cases, colonnes = 12, etiquette }: Props) {
  const p = usePalette();
  const rangees = Array.from({ length: Math.ceil(cases.length / colonnes) }, (_, r) => cases.slice(r * colonnes, (r + 1) * colonnes));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={styles.grille}>
      {rangees.map((rangee, r) => (
        <View key={r} style={styles.rangee}>
          {rangee.map((c, i) => (
            <View
              key={i}
              style={[
                styles.cellule,
                {
                  backgroundColor: c.vide ? 'transparent' : c.intensite && c.famille ? couleurSport(p, c.famille) : p.surface2,
                  opacity: c.intensite ? (OPACITES[c.intensite] ?? 1) : 1,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grille: { gap: 4 },
  rangee: { flexDirection: 'row', gap: 4 },
  cellule: { flex: 1, aspectRatio: 1, borderRadius: 4 },
});
