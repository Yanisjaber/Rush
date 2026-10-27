import { StyleSheet, Text, View } from 'react-native';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une barre par mois. Le meilleur mois porte sa valeur ;
// le mois en cours (incomplet) est atténué, les mois à venir n'ont pas de barre.
interface Props {
  valeurs: number[];
  /** Mois en cours (0 à 11) : sa barre est atténuée parce qu'il n'est pas fini. Null pour une année passée. */
  moisEnCours: number | null;
  /** Dernier mois qui a des données (les mois suivants restent vides). */
  dernierMois: number;
  hauteur?: number;
  /** Écrit la valeur du meilleur mois (ex. « 1 050 »). */
  formater: (v: number) => string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LETTRES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function BarresMois({ valeurs, moisEnCours, dernierMois, hauteur = 150, formater, etiquette }: Props) {
  const p = usePalette();
  const maximum = Math.max(1, ...valeurs);
  const meilleur = valeurs.reduce((m, v, i) => (v > valeurs[m] ? i : m), 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={[styles.mois, { height: hauteur }]}>
      {LETTRES.map((lettre, i) => {
        const v = valeurs[i] ?? 0;
        return (
          <View key={i} style={styles.col}>
            <Text numberOfLines={1} style={[typo.micro, styles.valeur, { color: p.texte }]}>
              {i === meilleur && v > 0 ? formater(v) : ''}
            </Text>
            <View style={[styles.zone, { borderBottomColor: p.trait }]}>
              {v > 0 && i <= dernierMois ? (
                <View style={[styles.barre, { height: `${(v / maximum) * 100}%`, backgroundColor: p.texte, opacity: i === moisEnCours ? 0.55 : 0.9 }]} />
              ) : null}
            </View>
            <Text style={[typo.micro, { color: i <= dernierMois ? p.texteDoux : p.texteMuet }]}>{lettre}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mois: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  valeur: { height: 16, textAlign: 'center', fontVariant: ['tabular-nums'] },
  zone: { flex: 1, width: '100%', justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  barre: { position: 'absolute', bottom: 0, left: 4, right: 4, minHeight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
