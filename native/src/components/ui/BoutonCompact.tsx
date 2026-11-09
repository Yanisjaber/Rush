import { Pressable, StyleSheet, Text } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le petit bouton des cartes du chat (Détail, Masquer, Annuler, Valider le plan…). C'est la version JS, utilisée sur Android et sur les iPhone sans verre liquide ;
// sur iOS 26, BoutonCompact.ios.tsx dessine le vrai bouton d'Apple.
export interface PropsBoutonCompact {
  libelle: string;
  onPress: () => void;
  /** Ce que lit VoiceOver (par défaut : le libellé) */
  accessibilityLabel?: string;
  /** Pour un bouton qui déplie quelque chose */
  deplie?: boolean;
  /** « principal » : plein, à la couleur donnée (une action qui compte) ; « secondaire » : contour */
  style?: 'principal' | 'secondaire';
  /** Couleur du bouton principal (la couleur du sport) ; sans elle, le texte de l'app */
  teinte?: string;
  desactive?: boolean;
}

export function BoutonCompact({ libelle, onPress, accessibilityLabel, deplie, style = 'secondaire', teinte, desactive }: PropsBoutonCompact) {
  const p = usePalette();
  const principal = style === 'principal';
  const fond = teinte ?? p.texte;
  const encre = teinte ? p.encreSurCouleur : p.fond;
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? libelle}
      accessibilityState={{ expanded: deplie, disabled: desactive }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [styles.pilule, principal ? { backgroundColor: fond } : { borderColor: p.contourChamp, borderWidth: 1 }, { opacity: desactive ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[typo.petit, { color: principal ? encre : p.texte, fontFamily: police.texte600 }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pilule: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
