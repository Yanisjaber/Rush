import { StyleSheet, View } from 'react-native';
import type { CaseRegularite } from '@/data/bilan/synthese';
import { couleurSport } from '@/theme/sports';
import { usePalette } from '@/theme/usePalette';

// Carte de chaleur de la régularité : une case par jour, la couleur est celle du sport dominant.
// L'ordre est celui de casesRegularite : rangée par rangée (lundi → dimanche), semaine par semaine.
// Intensité : 1 = léger, 2 = moyen, 3 = fort (l'opacité de la couleur suit).
interface Props {
  cases: CaseRegularite[];
  colonnes?: number;
  /** Une carte serrée (tuile M) : espace entre les cases et leur hauteur en points. Par défaut : 4 pt et des cases carrées. */
  ecart?: number;
  hauteurCase?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const OPACITES = [1, 0.35, 0.6, 1];

export function CarteChaleur({ cases, colonnes = 12, ecart = 4, hauteurCase, etiquette }: Props) {
  const p = usePalette();
  const rangees = Array.from({ length: Math.ceil(cases.length / colonnes) }, (_, r) => cases.slice(r * colonnes, (r + 1) * colonnes));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={{ gap: ecart }}>
      {rangees.map((rangee, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: ecart }}>
          {rangee.map((c, i) => (
            <View
              key={i}
              style={[
                styles.cellule,
                hauteurCase ? { aspectRatio: undefined, height: hauteurCase } : null,
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
  cellule: { flex: 1, aspectRatio: 1, borderRadius: 4 },
});
