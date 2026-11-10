import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AnneauJauge } from '@/components/graphes/AnneauJauge';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le bouton en haut à gauche de Santé : un anneau de 38 pt qui se remplit à chaque réponse du check-in du matin, « 3/5 » au centre.
// Les cinq réponses données : l'anneau passe au vert et une coche remplace le chiffre. Un appui ouvre le check-in.
// Jamais la couleur seule : le chiffre ou la coche dit l'état.
const TOTAL = 5;

export function BoutonCheckin({ reponses, onPress }: { reponses: number; onPress: () => void }) {
  const p = usePalette();
  const fait = reponses >= TOTAL;
  const couleur = fait ? p.ok : reponses > 0 ? p.texte : p.contourChamp;
  const etat = fait ? 'fait' : reponses > 0 ? `${reponses} réponses sur ${TOTAL}` : 'à faire';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Check-in du matin, ${etat}`}
      accessibilityHint="Ouvre le check-in"
      style={({ pressed }) => [styles.bouton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.fond, { backgroundColor: p.surface2 }]}>
        <AnneauJauge valeur={(Math.min(reponses, TOTAL) / TOTAL) * 100} taille={38} epaisseur={2.5} couleur={couleur} piste={p.traitFort} etiquette={`Check-in ${etat}`}>
          {fait ? (
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={p.ok} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : (
            <Text style={[styles.chiffre, { color: p.texte }]}>
              {reponses}
              <Text style={[styles.sur, { color: p.texteDoux }]}>/{TOTAL}</Text>
            </Text>
          )}
        </AnneauJauge>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Cible tactile de 42 pt comme le bouton des sports
  bouton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  fond: { width: 38, height: 38, borderRadius: 19 },
  chiffre: { fontFamily: police.titre800, fontSize: 14, lineHeight: 16, fontVariant: ['tabular-nums'] },
  sur: { fontFamily: police.texte600, fontSize: 10, lineHeight: 12 },
});
