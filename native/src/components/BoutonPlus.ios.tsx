import { View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { BoutonPlus as BoutonPlusJs, type PropsBoutonPlus } from './BoutonPlus';

// Le « + » du détail d'un jour sur iOS : le vrai bouton de verre d'Apple (un Button SwiftUI en style « glass », le liquid glass d'iOS 26 : il reflète ce qu'il y
// a derrière lui et se déforme sous le doigt). Dessiné par le système, donc rond de 44 pt et feedback natifs.
//
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout, et le verre n'existe qu'à partir d'iOS 26 : sinon (ou si l'import échoue)
// on se rabat sur le rond plein en JS plutôt que de planter.
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

export function BoutonPlus(props: PropsBoutonPlus) {
  const p = usePalette();
  if (!NATIF) return <BoutonPlusJs {...props} />;
  const { Host, Button, Image } = NATIF.ui;
  const { buttonStyle, buttonBorderShape, controlSize } = NATIF.modifs;
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Ajouter : séance, activité, import de fichier, compétition, note, cycle ou repos"
      accessibilityState={{ expanded: props.ouvert }}
      onAccessibilityTap={props.onPress}
      style={{ width: 44, height: 44 }}
    >
      {/* Le thème de l'app (clair ou sombre) s'impose au bouton, pas celui du téléphone */}
      <Host matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
        <Button onPress={props.onPress} modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large')]}>
          <Image systemName="plus" size={20} color={p.texte} />
        </Button>
      </Host>
    </View>
  );
}
