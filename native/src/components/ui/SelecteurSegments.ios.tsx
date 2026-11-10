import { View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { SelecteurSegments as SelecteurJs, type PropsSelecteurSegments } from './SelecteurSegments';

// Le contrôle segmenté d'Apple (un Picker SwiftUI en style « segmenté »), dessiné par le système : forme, animation et retour au toucher natifs.
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout : sinon (ou si l'import échoue) on se rabat sur la version JS plutôt que de planter.
type Natif = { ui: typeof import('@expo/ui/swift-ui'); modifs: typeof import('@expo/ui/swift-ui/modifiers') };
function chargerNatif(): Natif | null {
  try {
    return { ui: require('@expo/ui/swift-ui'), modifs: require('@expo/ui/swift-ui/modifiers') };
  } catch {
    return null;
  }
}
const NATIF = chargerNatif();

export function SelecteurSegments(props: PropsSelecteurSegments) {
  const p = usePalette();
  if (!NATIF) return <SelecteurJs {...props} />;
  const { Host, Picker, Text } = NATIF.ui;
  const { pickerStyle, tag } = NATIF.modifs;
  return (
    <View accessible={false}>
      {/* Le thème de l'app (clair ou sombre) s'impose au contrôle, pas celui du téléphone */}
      <Host matchContents={{ vertical: true }} colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
        <Picker selection={props.choix} onSelectionChange={(c: string) => props.onChoix(c)} modifiers={[pickerStyle('segmented')]}>
          {props.options.map((o) => (
            <Text key={o.cle} modifiers={[tag(o.cle)]}>
              {o.libelle}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
