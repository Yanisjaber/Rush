import { View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { MenuMesureJs, type PropsMenuMesure } from './MenuMesureJs';

// La pastille de choix d'un en-tête de bloc (« Distance ⌄ ») sur iOS : le vrai menu déroulant d'Apple (un Menu SwiftUI qui contient un Picker),
// dessiné par le système : la liste s'ouvre avec l'animation et le flou d'iOS, le choix en cours porte sa coche, et on peut glisser le doigt d'une ligne à l'autre.
// Sur iOS 26 et plus, la pastille est de verre (liquid glass) ; avant, c'est un bouton à contour d'iOS.
//
// Le choix de l'année en grand (`grand`, en haut du Bilan) est le même menu, sans pastille : son texte est écrit en grand, en gras, avec le petit chevron d'Apple.
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout : s'il manque (ou dans Expo Go), on se rabat sur la version JS plutôt que de planter.
// SwiftUI cherche une police par son nom interne (PostScript), pas par le nom que lui donne l'app côté JavaScript (BricolageGrotesque_800ExtraBold)
const NOM_NATIF_TITRE = 'BricolageGrotesque-ExtraBold';

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
  if (!NATIF) return <MenuMesureJs {...props} />;
  const { Host, HStack, Image, Menu, Picker, Text } = NATIF.ui;
  const { buttonStyle, buttonBorderShape, contentTransition, controlSize, font, foregroundStyle, menuIndicator, tag } = NATIF.modifs;
  const { options, valeur, onChoisir, etiquette } = props;
  const choisi = options.find((o) => o.cle === valeur) ?? options[0];
  return (
    <View accessibilityLabel={`${etiquette} : ${choisi?.nom}`} style={{ minHeight: 44, justifyContent: 'center', alignItems: props.grand ? 'flex-start' : undefined }}>
      {/* Le thème de l'app (clair ou sombre) s'impose au menu, pas celui du téléphone */}
      {/* `key` : la pastille est recréée à chaque changement de choix. Sans ça, son animation (le texte et la largeur qui changent) continue pendant qu'on fait défiler la page, et elle se décale du reste. */}
      <Host key={choisi?.cle} matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
        <Menu
          label={
            props.grand ? (
              // Le titre en grand : le nom en gras (la police se règle sur le texte, pas sur le bouton) suivi du petit chevron
              <HStack spacing={6}>
                <Text modifiers={[font({ family: NOM_NATIF_TITRE, size: 24, weight: 'heavy' }), foregroundStyle(p.texte)]}>{choisi?.nom ?? ''}</Text>
                <Image systemName="chevron.down" size={13} color={p.texteDoux} />
              </HStack>
            ) : (
              (choisi?.nom ?? '')
            )
          }
          modifiers={
            props.grand
              ? [buttonStyle('plain'), contentTransition('identity')]
              : [buttonStyle(NATIF.verre ? 'glass' : 'bordered'), buttonBorderShape('capsule'), controlSize('regular'), menuIndicator('visible'), contentTransition('identity'), foregroundStyle(p.texte)]
          }
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
