import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'aperçu d'une semaine : une petite bulle accrochée à la colonne « Sem. » (celle qu'on vient de toucher), avec le temps en grand, une ligne de chiffres
// et les sept barres de la semaine. Toucher n'importe où la ferme. Elle se pose sous la colonne, ou au-dessus si elle n'a pas la place en bas.
export interface BarreBulle {
  /** La hauteur de la barre, de 0 à 1. */
  hauteur: number;
  couleur: string;
  /** Rien que du prévu : la barre est pâle. */
  prevu: boolean;
}

export interface AncreBulle {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const LARGEUR = 236;
const HAUTEUR_ESTIMEE = 132;
const BORD = 12;
const HAUTEUR_BARRES = 40;

export function BulleSemaine({
  ouvert,
  onFermer,
  ancre,
  titre,
  suite,
  details,
  barres,
  libelle,
}: {
  ouvert: boolean;
  onFermer: () => void;
  ancre: AncreBulle | null;
  titre: string;
  /** « sur 6h10 », « prévues »… à côté du temps. */
  suite: string;
  details: string;
  barres: BarreBulle[];
  /** Ce que lit un lecteur d'écran. */
  libelle: string;
}) {
  const p = usePalette();
  const fenetre = useWindowDimensions();
  if (!ancre) return null;
  const largeur = Math.min(LARGEUR, fenetre.width - 2 * BORD);
  const gauche = fenetre.width - BORD - largeur;
  // Sous la colonne, sauf s'il ne reste pas la place avant le bas de l'écran (la barre d'onglets compte)
  const dessous = ancre.y + ancre.hauteur + 10 + HAUTEUR_ESTIMEE < fenetre.height - 90;
  const fleche = Math.max(16, Math.min(largeur - 28, ancre.x + ancre.largeur / 2 - gauche - 6));
  const position = dessous ? { top: ancre.y + ancre.hauteur + 8 } : { bottom: fenetre.height - ancre.y + 8 };
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer l'aperçu de la semaine" onPress={onFermer} style={StyleSheet.absoluteFill} />
      <View
        accessible
        accessibilityViewIsModal
        accessibilityLabel={libelle}
        pointerEvents="none"
        style={[styles.bulle, position, { left: gauche, width: largeur, backgroundColor: p.surface, borderColor: p.traitFort }]}
      >
        <View
          style={[
            styles.fleche,
            { left: fleche, backgroundColor: p.surface, borderColor: p.traitFort },
            dessous ? { top: -7, borderLeftWidth: 1, borderTopWidth: 1 } : { bottom: -7, borderRightWidth: 1, borderBottomWidth: 1 },
          ]}
        />
        <View style={styles.ligne}>
          <Text style={[styles.temps, { color: p.texte }]}>{titre}</Text>
          {suite ? <Text style={[typo.petit, { color: p.texteDoux }]}>{suite}</Text> : null}
        </View>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{details}</Text>
        <View style={styles.barres}>
          {barres.map((b, i) => (
            <View key={i} style={[styles.barre, { height: Math.max(4, b.hauteur * HAUTEUR_BARRES), backgroundColor: b.couleur, opacity: b.prevu ? 0.4 : 1 }]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bulle: { position: 'absolute', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  fleche: { position: 'absolute', width: 12, height: 12, transform: [{ rotate: '45deg' }] },
  ligne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  temps: { fontFamily: police.titre800, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: HAUTEUR_BARRES, marginTop: 10 },
  barre: { width: 12, borderRadius: 3 },
});
