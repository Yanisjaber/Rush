import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un choix entre quelques options côte à côte (Cœur / Puissance / Allure). Version JS, pour Android et les iPhone sans le module natif ;
// sur iPhone, SelecteurSegments.ios.tsx dessine le vrai contrôle segmenté d'Apple.
export interface PropsSelecteurSegments {
  options: { cle: string; libelle: string }[];
  choix: string;
  onChoix: (cle: string) => void;
}

export function SelecteurSegments({ options, choix, onChoix }: PropsSelecteurSegments) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" style={[styles.barre, { backgroundColor: p.surface }]}>
      {options.map((o) => {
        const actif = o.cle === choix;
        return (
          <Pressable key={o.cle} onPress={() => onChoix(o.cle)} accessibilityRole="tab" accessibilityState={{ selected: actif }} style={[styles.option, actif && { backgroundColor: p.texte }]}>
            <Text style={[typo.petit, { fontFamily: police.texte600, color: actif ? p.fond : p.texteDoux }]}>{o.libelle}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', borderRadius: rayon.base, padding: 3, gap: 2 },
  option: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.base - 3 },
});
