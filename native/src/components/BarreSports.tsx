import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { SelecteurSports } from '@/components/SelecteurSports';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choisirFiltre, useMenu } from '@/stores/menu';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
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
    <View style={[styles.barre, { backgroundColor: p.fond, borderBottomColor: p.trait, paddingTop: haut }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.rangee} accessibilityRole="tablist">
        <Pastille libelle="Tous" actif={filtre === 'tout'} onPress={() => choisirFiltre('tout')} />
        {familles.map((f) => (
          <Pastille
            key={f}
            libelle={SPORTS[f as CleSport]?.court ?? SPORTS.autre.court}
            point={couleurSport(p, f)}
            actif={filtre === f}
            onPress={() => choisirFiltre(f)}
          />
        ))}
      </ScrollView>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel="Ajouter ou retirer un sport"
        style={({ pressed }) => [styles.plus, { backgroundColor: p.fond, borderLeftColor: p.trait, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.plusTexte, { color: p.texte }]}>+</Text>
      </Pressable>
      <ChoixSportsModal ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </View>
  );
}

// Le « + » : tous les sports, cochés pour ceux qu'on pratique. Chaque touche enregistre tout de suite (comme sur le site).
function ChoixSportsModal({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const p = usePalette();
  const { choisis, disciplines, disciplinesApres, erreur, envoi, appliquer } = useSportsChoisis();
  const basculer = (cle: string) => {
    if (!choisis) return;
    void appliquer(choisis.includes(cle) ? choisis.filter((s) => s !== cle) : [...choisis, cle]);
  };
  return (
    <Modal visible={ouvert} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <View style={{ flex: 1, backgroundColor: p.fond }}>
        <View style={styles.enteteModal}>
          <Text accessibilityRole="header" style={[typo.titre2, { color: p.texte, flex: 1 }]}>Mes sports</Text>
          <Bouton variante="discret" onPress={onFermer}>Fermer</Bouton>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginBottom: 12 }]}>{erreur}</Text> : null}
          {choisis ? (
            <SelecteurSports
              choisis={choisis}
              onBasculer={basculer}
              disciplines={disciplines}
              onBasculerDiscipline={(sport, cle) => void appliquer(choisis, disciplinesApres(sport, cle))}
              desactive={envoi}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Pastille({ libelle, point, actif, onPress }: { libelle: string; point?: string; actif: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: actif }}
      hitSlop={{ top: 0, bottom: 0, left: 2, right: 2 }}
      style={({ pressed }) => [styles.pastille, { backgroundColor: actif ? p.surface2 : 'transparent', opacity: pressed ? 0.7 : 1 }]}
    >
      {point ? <View style={[styles.point, { backgroundColor: point }]} /> : null}
      <Text style={[styles.texte, { color: actif ? p.texte : p.texteDoux }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end' },
  plus: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth },
  plusTexte: { fontFamily: police.titre600, fontSize: 28, lineHeight: 32 },
  enteteModal: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rangee: { paddingHorizontal: 8, alignItems: 'center' },
  // 44 pt de haut : la cible tactile minimale
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 999 },
  point: { width: 9, height: 9, borderRadius: 4.5 },
  texte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
});
