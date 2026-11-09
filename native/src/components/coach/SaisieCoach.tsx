import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { clair, espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La zone d'écriture du chat : un champ qui grandit avec le texte (jusqu'à 5 lignes), et un bouton d'envoi de 44 pt.
// 2000 caractères au plus (la même limite que le serveur). Le bouton est grisé tant qu'il n'y a rien à envoyer ou qu'une réponse arrive.
interface Props {
  envoi: boolean;
  /** Espace sous la zone (au-dessus de la barre d'onglets, ou petit quand le clavier est ouvert) */
  basse: number;
  onEnvoyer: (texte: string) => void;
}

export const LIMITE_MESSAGE = 2000;

// Sur iOS 26 et plus, le champ et le bouton d'envoi sont les vrais composants d'Apple (SwiftUI, en verre) : saisie, curseur, loupe, correcteur et retour au toucher natifs.
// Le module natif (@expo/ui) n'existe que dans une app recompilée après son ajout, et le verre à partir d'iOS 26 : sinon (ou si l'import échoue) on garde le champ en JS plus bas.
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

export function SaisieCoach({ envoi, basse, onEnvoyer }: Props) {
  const p = usePalette();
  const [texte, setTexte] = useState('');
  const champ = useRef<import('@expo/ui/swift-ui').TextFieldRef>(null);
  const pret = texte.trim().length > 0 && !envoi;

  function envoyer() {
    if (!pret) return;
    onEnvoyer(texte);
    setTexte('');
    void champ.current?.clear();
  }

  if (NATIF) {
    const { Host, TextField, Button } = NATIF.ui;
    const { lineLimit, padding, glassEffect, foregroundStyle, buttonStyle, buttonBorderShape, controlSize, labelStyle, tint, disabled, font } = NATIF.modifs;
    // Le thème de l'app (clair ou sombre) s'impose aux composants, pas celui du téléphone
    const schema = p.fond === clair.fond ? 'light' : 'dark';
    return (
      <View style={[styles.barre, { paddingBottom: basse, alignItems: 'flex-end' }]}>
        <Host matchContents={{ vertical: true }} colorScheme={schema} style={styles.champNatif}>
          <TextField
            ref={champ}
            axis="vertical"
            placeholder="Message au coach"
            maxLength={LIMITE_MESSAGE}
            onTextChange={setTexte}
            modifiers={[font({ size: 17 }), foregroundStyle(p.texte), lineLimit({ min: 1, max: 5 }), padding({ horizontal: 16, vertical: 11 }), glassEffect({ glass: { variant: 'regular' }, shape: 'roundedRectangle', cornerRadius: 22 })]}
          />
        </Host>
        <View accessible accessibilityRole="button" accessibilityLabel="Envoyer" accessibilityState={{ disabled: !pret }} onAccessibilityTap={envoyer}>
          <Host matchContents colorScheme={schema}>
            <Button
              label="Envoyer"
              systemImage="arrow.up"
              onPress={envoyer}
              modifiers={[labelStyle('iconOnly'), buttonStyle('glassProminent'), buttonBorderShape('circle'), controlSize('large'), tint(p.sportCourse), foregroundStyle(p.encreSurCouleur), disabled(!pret)]}
            />
          </Host>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.barre, { paddingBottom: basse }]}>
      <TextInput
        value={texte}
        onChangeText={setTexte}
        multiline
        maxLength={LIMITE_MESSAGE}
        placeholder="Message au coach"
        placeholderTextColor={p.texteMuet}
        accessibilityLabel="Message pour le coach"
        style={[typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface, borderColor: p.contourChamp }]}
      />
      <Pressable
        onPress={envoyer}
        disabled={!pret}
        accessibilityRole="button"
        accessibilityLabel="Envoyer"
        accessibilityState={{ disabled: !pret }}
        style={({ pressed }) => [styles.envoi, { backgroundColor: p.sportCourse, opacity: !pret ? 0.35 : pressed ? 0.8 : 1 }]}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M12 19V6M6 11l6-6 6 6" stroke={p.encreSurCouleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'flex-end', gap: espace.e2, paddingHorizontal: espace.e3, paddingTop: espace.e2 },
  champ: { flex: 1, minHeight: 44, maxHeight: 132, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, textAlignVertical: 'top' },
  champNatif: { flex: 1, minHeight: 44 },
  envoi: { width: 44, height: 44, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
});
