import { StyleSheet, Text, View } from 'react-native';
import { EchelleBarres, largeurGouttiere } from '@/components/graphes/EchelleBarres';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { echelleRonde } from '@/data/outils/echelle';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une barre par mois ; le mois en cours (incomplet) est atténué, les mois à venir n'ont pas de barre.
interface Props {
  valeurs: number[];
  /** Mois en cours (0 à 11) : sa barre est atténuée parce qu'il n'est pas fini. Null pour une année passée. */
  moisEnCours: number | null;
  /** Dernier mois qui a des données (les mois suivants restent vides). */
  dernierMois: number;
  hauteur?: number;
  /** Unité écrite après chaque valeur de l'échelle (« km »), vide si le titre la dit déjà. */
  unite?: string;
  /** Le mois touché (0 à 11), ou null : sa barre est pleine, les autres s'atténuent. */
  selection?: number | null;
  onSelection?: (mois: number | null) => void;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

// -9 : la moitié des 18 pt de marge intérieure de la carte, pour que l'échelle se rapproche du bord
const LETTRES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function BarresMois({ valeurs, moisEnCours, dernierMois, hauteur = 150, unite = '', selection = null, onSelection, etiquette }: Props) {
  const p = usePalette();
  const maximum = Math.max(1, echelleRonde(Math.max(0, ...valeurs)).haut); // le haut de l'échelle : un multiple d'un pas rond
  const echelle = valeurs.some((v) => v > 0) ? maximum : 0; // pas d'échelle (ni de marge) sans données
  const gouttiere = largeurGouttiere(echelle, unite);
  const dessin = (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={[styles.mois, { height: hauteur, marginLeft: -9, paddingLeft: gouttiere }]}>
      {/* La zone des barres finit au-dessus des lettres (4 + 16) */}
      <EchelleBarres maximum={echelle} unite={unite} bas={20} />
      {LETTRES.map((lettre, i) => {
        const v = valeurs[i] ?? 0;
        return (
          <View key={i} style={styles.col}>
            <View style={[styles.zone, { borderBottomColor: p.trait }]}>
              {v > 0 && i <= dernierMois ? (
                <View style={[styles.barre, { height: `${(v / maximum) * 100}%`, backgroundColor: p.texte, opacity: selection != null ? (i === selection ? 1 : 0.35) : i === moisEnCours ? 0.55 : 0.9 }]} />
              ) : null}
            </View>
            <Text style={[typo.micro, { color: i <= dernierMois ? p.texteDoux : p.texteMuet }]}>{lettre}</Text>
          </View>
        );
      })}
    </View>
  );
  if (!onSelection) return dessin;
  // Les colonnes commencent après la marge de l'échelle (décalée de 9 pt vers la gauche) : le doigt sur l'échelle ne choisit rien
  const debut = gouttiere - 9;
  return (
    <ZoneTactile
      selection={selection}
      onSelection={onSelection}
      indexDe={(x, largeur) => {
        if (x < debut || largeur <= debut) return null;
        const i = Math.min(11, Math.floor(((x - debut) / (largeur - debut)) * 12));
        return i <= dernierMois ? i : null;
      }}
    >
      {dessin}
    </ZoneTactile>
  );
}

const styles = StyleSheet.create({
  mois: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  zone: { flex: 1, width: '100%', justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  barre: { position: 'absolute', bottom: 0, left: 4, right: 4, minHeight: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
