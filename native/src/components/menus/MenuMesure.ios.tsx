import { View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { MenuMesureJs, type PropsMenuMesure } from './MenuMesureJs';

// La pastille de choix d'un en-tête de bloc (« Distance ⌄ ») sur iOS : le vrai menu déroulant d'Apple (un Menu SwiftUI qui contient un Picker),
// dessiné par le système : la liste s'ouvre avec l'animation et le flou d'iOS, le choix en cours porte sa coche, et on peut glisser le doigt d'une ligne à l'autre.
// Sur iOS 26 et plus, la pastille est de verre (liquid glass) ; avant, c'est un bouton à contour d'iOS.
//
// Le choix de l'année en grand (`grand`) n'a pas de pastille : il garde la version JS. Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout :
// s'il manque (ou dans Expo Go), on se rabat aussi sur la version JS plutôt que de planter.
type Natif = { ui: typeof import('@expo/ui/swift-ui'); modifs: typeof import('@expo/ui/swift-ui/modifiers'); verre: boolean };
function chargerNatif(): Natif | null {
  try {
    let verre = false;
    try {
      verre = (require('expo-glass-effect') as typeof import('expo-glass-effect')).isLiquidGlassAvailable();
    } catch {
      verre = false;
    }
    return { ui: require('@expo/ui/swift-ui'), modifs: require('@expo/ui/swift-ui/modifiers'), verre };
  } catch (e) {
    console.warn('[MenuMesure] module natif indisponible, version JS', String(e));
    return null;
  }
}
const NATIF = chargerNatif();

export function MenuMesure(props: PropsMenuMesure) {
  const p = usePalette();
  if (!NATIF || props.grand) return <MenuMesureJs {...props} />;
  const { Host, Menu, Picker, Text } = NATIF.ui;
  const { buttonStyle, buttonBorderShape, controlSize, foregroundStyle, menuIndicator, tag } = NATIF.modifs;
  const { options, valeur, onChoisir, etiquette } = props;
  const choisi = options.find((o) => o.cle === valeur) ?? options[0];
  return (
    <View accessibilityLabel={`${etiquette} : ${choisi?.nom}`} style={{ minHeight: 44, justifyContent: 'center' }}>
      {/* Le thème de l'app (clair ou sombre) s'impose au menu, pas celui du téléphone */}
      <Host matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
        <Menu
          label={choisi?.nom ?? ''}
          modifiers={[buttonStyle(NATIF.verre ? 'glass' : 'bordered'), buttonBorderShape('capsule'), controlSize('regular'), menuIndicator('visible'), foregroundStyle(p.texte)]}
        >
          <Picker selection={valeur} onSelectionChange={(cle: string) => onChoisir(cle)}>
            {options.map((o) => (
              <Text key={o.cle} modifiers={[tag(o.cle)]}>
                {o.nom}
              </Text>
            ))}
          </Picker>
        </Menu>
      </Host>
    </View>
  );
}
