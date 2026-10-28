import { StyleSheet, View } from 'react-native';
import { EchelleBarres, largeurGouttiere } from '@/components/graphes/EchelleBarres';
import { TraitTirets } from '@/components/graphes/TraitTirets';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { echelleRonde } from '@/data/outils/echelle';
import { usePalette } from '@/theme/usePalette';

// Une barre par semaine (tonnage, charge de musculation…). La dernière est pleine, les autres atténuées.
// Port des barres des widgets Tonnage et Charge musculation.
interface Props {
  valeurs: number[];
  couleur: string;
  hauteur?: number;
  /** Une ligne en pointillés à cette valeur (la moyenne, par exemple). */
  repere?: number;
  /** Écrit l'échelle (des traits au tiers, aux deux tiers et en haut, avec leurs valeurs) et fait du haut un chiffre rond. */
  echelle?: boolean;
  /** Unité écrite après chaque valeur de l'échelle (« km »), vide si le titre la dit déjà. */
  unite?: string;
  /** Espace entre les barres et arrondi de leur sommet (6 et 6 par défaut ; plus serrés pour beaucoup de semaines). */
  ecart?: number;
  rayonBarre?: number;
  /** La barre touchée (avec l'échelle) : elle est pleine, les autres s'atténuent. */
  selection?: number | null;
  onSelection?: (index: number | null) => void;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

// Avec l'échelle, marginLeft -9 : la moitié des 18 pt de marge intérieure de la carte, pour que l'échelle se rapproche du bord
export function BarresHebdo({ valeurs, couleur, hauteur = 120, repere, echelle = false, unite = '', ecart = 6, rayonBarre = 6, selection = null, onSelection, etiquette }: Props) {
  const p = usePalette();
  const gouttiere = echelle && valeurs.some((v) => v > 0) ? largeurGouttiere(echelleRonde(Math.max(0, ...valeurs)).haut, unite) : 0;
  const maximum = echelle ? Math.max(1, echelleRonde(Math.max(0, ...valeurs)).haut) : Math.max(1, ...valeurs);
  const dessin = (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={[styles.barres, { height: hauteur, gap: ecart, borderBottomColor: p.trait }, echelle ? { marginLeft: -9, paddingLeft: gouttiere, borderBottomWidth: 0 } : null]}>
      {echelle ? <EchelleBarres maximum={valeurs.some((v) => v > 0) ? maximum : 0} unite={unite} /> : null}
      {valeurs.map((v, i) => (
        <View key={i} style={[styles.colonne, { opacity: selection != null ? (i === selection ? 1 : 0.35) : i === valeurs.length - 1 ? 1 : 0.55 }]}>
          <View style={{ height: `${(v / maximum) * 100}%`, minHeight: 2, backgroundColor: couleur, borderRadius: rayonBarre }} />
        </View>
      ))}
      {repere != null && repere > 0 ? <View pointerEvents="none" style={[styles.repere, { bottom: `${Math.min(100, (repere / maximum) * 100)}%`, left: gouttiere }]}><TraitTirets couleur={p.texteMuet} epaisseur={1} /></View> : null}
    </View>
  );
  if (!onSelection || !echelle) return dessin;
  // Les barres commencent après la marge de l'échelle (décalée de 9 pt vers la gauche) : le doigt sur l'échelle ne choisit rien
  const debut = gouttiere - 9;
  return (
    <ZoneTactile
      selection={selection}
      onSelection={onSelection}
      indexDe={(x, largeur) => (x < debut || largeur <= debut ? null : Math.min(valeurs.length - 1, Math.floor(((x - debut) / (largeur - debut)) * valeurs.length)))}
    >
      {dessin}
    </ZoneTactile>
  );
}

const styles = StyleSheet.create({
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  repere: { position: 'absolute', left: 0, right: 0, height: 1 },
  colonne: { flex: 1, height: '100%', justifyContent: 'flex-end' },
});
