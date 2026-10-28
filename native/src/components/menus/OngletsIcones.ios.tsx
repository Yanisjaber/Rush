import { View } from 'react-native';
import { clair } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';
import { OngletsIconesJs } from './OngletsIconesJs';
import type { PropsOngletsIcones } from './OngletsIcones.types';

export type { IconeOnglet } from './OngletsIcones.types';

// Les onglets du Bilan sur iOS : le vrai sélecteur segmenté d'iOS (un Picker SwiftUI), dessiné par le système.
// Sur iOS 26 et plus, c'est le même comportement que la barre du bas : le verre (liquid glass), la lentille qui glisse et se déforme, et on peut
// la faire glisser au doigt d'un onglet à l'autre. Chaque onglet porte son nom (un contrôle segmenté d'iOS montre un texte OU une icône par segment, pas les deux).
//
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout. Dans une app plus ancienne (ou Expo Go), l'import échoue :
// on le charge donc avec un try, et on se rabat sur la version JS plutôt que de planter.
type Natif = { ui: typeof import('@expo/ui/swift-ui'); modifs: typeof import('@expo/ui/swift-ui/modifiers') };
function chargerNatif(): Natif | null {
  try {
    return { ui: require('@expo/ui/swift-ui'), modifs: require('@expo/ui/swift-ui/modifiers') };
  } catch {
    return null;
  }
}
const NATIF = chargerNatif();

export function OngletsIcones<T extends string>(props: PropsOngletsIcones<T>) {
  const p = usePalette();
  if (!NATIF) return <OngletsIconesJs {...props} />;
  const { Host, Picker, Text } = NATIF.ui;
  const { pickerStyle, tag } = NATIF.modifs;
  const { onglets, actuel, onChoisir, etiquette } = props;
  const rang = Math.max(0, onglets.findIndex((o) => o.cle === actuel));
  return (
    <View accessibilityLabel={etiquette}>
      {/* Le thème de l'app (clair ou sombre) s'impose au contrôle, pas celui du téléphone */}
      <Host matchContents colorScheme={p.fond === clair.fond ? 'light' : 'dark'}>
        <Picker
          selection={rang}
          onSelectionChange={(i: number) => {
            const o = onglets[i];
            if (o && o.cle !== actuel) onChoisir(o.cle);
          }}
          modifiers={[pickerStyle('segmented')]}
        >
          {onglets.map((o, i) => (
            <Text key={o.cle} modifiers={[tag(i)]}>
              {o.nom}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
