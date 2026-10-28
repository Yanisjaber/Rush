import { StyleSheet, View } from 'react-native';
import { EchelleBarres, GOUTTIERE_ECHELLE } from '@/components/graphes/EchelleBarres';
import { TraitTirets } from '@/components/graphes/TraitTirets';
import { maximumRond } from '@/data/outils/cumul-graphe';
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
  /** Espace entre les barres et arrondi de leur sommet (6 et 6 par défaut ; plus serrés pour beaucoup de semaines). */
  ecart?: number;
  rayonBarre?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

export function BarresHebdo({ valeurs, couleur, hauteur = 120, repere, echelle = false, ecart = 6, rayonBarre = 6, etiquette }: Props) {
  const p = usePalette();
  const maximum = echelle ? maximumRond(Math.max(0, ...valeurs)) : Math.max(1, ...valeurs);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={[styles.barres, { height: hauteur, gap: ecart, borderBottomColor: p.trait }, echelle ? { paddingLeft: GOUTTIERE_ECHELLE, borderBottomWidth: 0 } : null]}>
      {echelle ? <EchelleBarres maximum={valeurs.some((v) => v > 0) ? maximum : 0} /> : null}
      {valeurs.map((v, i) => (
        <View key={i} style={[styles.colonne, { opacity: i === valeurs.length - 1 ? 1 : 0.55 }]}>
          <View style={{ height: `${(v / maximum) * 100}%`, minHeight: 2, backgroundColor: couleur, borderRadius: rayonBarre }} />
        </View>
      ))}
      {repere != null && repere > 0 ? <View pointerEvents="none" style={[styles.repere, { bottom: `${Math.min(100, (repere / maximum) * 100)}%`, left: echelle ? GOUTTIERE_ECHELLE : 0 }]}><TraitTirets couleur={p.texteMuet} epaisseur={1} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  repere: { position: 'absolute', left: 0, right: 0, height: 1 },
  colonne: { flex: 1, height: '100%', justifyContent: 'flex-end' },
});
