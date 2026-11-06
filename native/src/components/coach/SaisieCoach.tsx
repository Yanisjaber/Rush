import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { espace, rayon } from '@/theme/couleurs';
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

export function SaisieCoach({ envoi, basse, onEnvoyer }: Props) {
  const p = usePalette();
  const [texte, setTexte] = useState('');
  const pret = texte.trim().length > 0 && !envoi;

  function envoyer() {
    if (!pret) return;
    onEnvoyer(texte);
    setTexte('');
  }

  return (
    <View style={[styles.barre, { borderTopColor: p.trait, backgroundColor: p.fond, paddingBottom: basse }]}>
      <TextInput
        value={texte}
        onChangeText={setTexte}
        multiline
        maxLength={LIMITE_MESSAGE}
        placeholder="Écris à ton coach…"
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
        style={({ pressed }) => [styles.envoi, { backgroundColor: p.texte, opacity: !pret ? 0.35 : pressed ? 0.8 : 1 }]}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M4 12l16-8-6 16-3-7z" stroke={p.fond} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'flex-end', gap: espace.e2, paddingHorizontal: espace.e3, paddingTop: espace.e2, borderTopWidth: StyleSheet.hairlineWidth },
  champ: { flex: 1, minHeight: 44, maxHeight: 132, borderWidth: 1, borderRadius: rayon.base, paddingHorizontal: espace.e3, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' },
  envoi: { width: 44, height: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
