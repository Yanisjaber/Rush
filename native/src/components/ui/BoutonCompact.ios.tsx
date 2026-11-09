import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { BoutonCompact as BoutonCompactJs, type PropsBoutonCompact } from './BoutonCompact';

// Le petit bouton des cartes du chat sur iOS : le vrai bouton d'Apple (un Button SwiftUI en verre, le liquid glass d'iOS 26), dessiné par le système :
// forme, taille et retour au toucher natifs. Un bouton « principal » est un verre teinté à la couleur du sport.
//
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout, et le verre n'existe qu'à partir d'iOS 26 : sinon (ou si l'import échoue)
// on se rabat sur la pilule en JS plutôt que de planter.
type Natif = { ui: typeof import('@expo/ui/swift-ui'); modifs: typeof import('@expo/ui/swift-ui/modifiers') };
function chargerNatif(): Natif | null {
  try {
    const { isLiquidGlassAvailable } = require('expo-glass-effect') as typeof import('expo-glass-effect');
    if (!isLiquidGlassAvailable()) return null;
    return { ui: require('@expo/ui/swift-ui'), modifs: require('@expo/ui/swift-ui/modifiers') };
  } catch {
    return null;
  }
}
const NATIF = chargerNatif();

export function BoutonCompact(props: PropsBoutonCompact) {
  const p = usePalette();
  // Un toucher peut atteindre À LA FOIS le bouton natif et sa marge : sans garde, l'action part deux fois (une carte qui se déplie puis se replie aussitôt).
  const dernier = useRef(0);
  const declencher = () => {
    const maintenant = Date.now();
    if (maintenant - dernier.current < 600) return;
    dernier.current = maintenant;
    props.onPress();
  };
  if (!NATIF) return <BoutonCompactJs {...props} />;
  const { Host, Button } = NATIF.ui;
  const { buttonStyle, controlSize, tint, foregroundStyle, disabled } = NATIF.modifs;
  const principal = props.style === 'principal';
  const modifiers = [buttonStyle(principal ? 'glassProminent' : 'glass'), controlSize(principal ? 'regular' : 'small'), ...(principal ? [tint(props.teinte ?? p.texte), foregroundStyle(props.teinte ? p.encreSurCouleur : p.fond)] : []), ...(props.desactive ? [disabled(true)] : [])];
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.libelle}
      accessibilityState={{ expanded: props.deplie, disabled: props.desactive }}
      onAccessibilityTap={props.desactive ? undefined : declencher}
      style={{ alignSelf: 'center' }}
    >
      {/* Un bouton « small » d'Apple fait environ 30 pt de haut : la marge autour (qui déclenche aussi l'action) ramène la zone de toucher à 44 pt */}
      <Pressable onPress={props.desactive ? undefined : declencher} accessible={false} style={{ paddingVertical: principal ? 4 : 7, paddingHorizontal: 4 }}>
        {/* Le thème de l'app (clair ou sombre) s'impose au bouton, pas celui du téléphone */}
        <Host matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
          <Button onPress={declencher} label={props.libelle} modifiers={modifiers} />
        </Host>
      </Pressable>
    </View>
  );
}
