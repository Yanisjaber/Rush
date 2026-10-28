import { StyleSheet, Text, View } from 'react-native';
import type { CaseRegularite } from '@/data/bilan/synthese';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La régularité mois par mois : une ligne par mois, une case par jour (les jours sont alignés d'une ligne à l'autre), la couleur est celle du sport dominant du jour
// et sa force suit la charge ; à droite, le nombre de jours actifs du mois. Les mois à venir ne sont pas dessinés (`dernierMois`).
interface Props {
  parMois: { cases: CaseRegularite[]; actifs: number }[];
  /** Dernier mois affiché (0 à 11) : le mois en cours pour l'année en cours, 11 pour une année passée. */
  dernierMois: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LETTRES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const OPACITES = [1, 0.35, 0.6, 1];

export function RegulariteMois({ parMois, dernierMois, etiquette }: Props) {
  const p = usePalette();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={styles.liste}>
      {parMois.slice(0, dernierMois + 1).map((m, i) => (
        <View key={i} style={styles.ligne}>
          <Text style={[typo.micro, styles.mois, { color: p.texteMuet }]}>{LETTRES[i]}</Text>
          <View style={styles.jours}>
            {Array.from({ length: 31 }, (_, d) => {
              const c = m.cases[d];
              return (
                <View
                  key={d}
                  style={[
                    styles.case,
                    {
                      backgroundColor: !c || c.vide ? 'transparent' : c.intensite && c.famille ? couleurSport(p, c.famille) : p.surface2,
                      opacity: c?.intensite ? (OPACITES[c.intensite] ?? 1) : 1,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[typo.petit, styles.nombre, { color: p.texte }]}>{m.actifs} j</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mois: { width: 14, textAlign: 'center' },
  jours: { flex: 1, flexDirection: 'row', gap: 1 },
  case: { flex: 1, aspectRatio: 1, borderRadius: 2 },
  nombre: { width: 34, textAlign: 'right', fontVariant: ['tabular-nums'], fontFamily: police.texte600 },
});
