import { useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { MenuSports } from '@/components/MenuSports';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choisirFiltre, useMenu } from '@/stores/menu';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre des sports, fixe en haut de l'écran : « Tous » puis un sport par pastille (point de sa couleur).
// Le choix est un filtre global : il reste quand on change d'écran. Les pastilles défilent s'il y en a beaucoup.
// Retoucher le sport déjà choisi revient à « Tous » (comme sur le web).
// La barre est posée tout en haut de l'écran : elle réserve elle-même la place de l'heure et de l'encoche.
export function BarreSports() {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const { familles, filtre } = useMenu();
  const [ouvert, setOuvert] = useState(false);
  // Compte neuf sans aucun sport : pas de barre, c'est l'onboarding de l'Accueil qui propose d'en choisir
  if (!familles.length) return null;

  return (
    <View style={[styles.barre, { borderBottomColor: p.trait, paddingTop: haut }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.rangee} accessibilityRole="tablist">
        <Onglet libelle="Tous" couleur={p.texte} actif={filtre === 'tout'} onPress={() => choisirFiltre('tout')} />
        {familles.map((f) => (
          <Onglet
            key={f}
            libelle={SPORTS[f as CleSport]?.court ?? SPORTS.autre.court}
            couleur={couleurSport(p, f)}
            actif={filtre === f}
            onPress={() => choisirFiltre(f)}
          />
        ))}
      </ScrollView>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel="Ajouter ou retirer un sport"
        style={({ pressed }) => [styles.plus, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.plusTexte, { color: p.texte }]}>+</Text>
      </Pressable>
      <MenuSports ouvert={ouvert} onFermer={() => setOuvert(false)} haut={haut} />
    </View>
  );
}

// Un onglet de sport : le nom seul, et un trait épais de la couleur du sport sous l'onglet choisi.
// Onglet choisi : texte plein et gras (le choix ne repose pas que sur la couleur du trait).
function Onglet({ libelle, couleur, actif, onPress }: { libelle: string; couleur: string; actif: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: actif }}
      hitSlop={{ top: 0, bottom: 0, left: 6, right: 6 }}
      style={({ pressed }) => [styles.onglet, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text numberOfLines={1} style={[styles.texte, { color: actif ? p.texte : p.texteDoux }]}>
        {libelle}
      </Text>
      {actif ? <View style={[styles.trait, { backgroundColor: couleur }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end' },
  plus: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  plusTexte: { fontFamily: police.titre600, fontSize: 28, lineHeight: 32 },
  rangee: { gap: 22, paddingLeft: 18, paddingRight: 6 },
  // 44 pt de haut : la cible tactile minimale ; le trait chevauche le filet de la barre
  onglet: { height: 44, justifyContent: 'center' },
  trait: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  texte: { fontFamily: police.texte600, fontSize: 15, lineHeight: 20 },
});
