import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoutonReglages } from '@/components/ui/BoutonReglages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { basculerSport } from '@/data/accueil/menu';
import { definirSelection, useMenu } from '@/stores/menu';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre du haut, fixe : à gauche le menu des sports (un déclencheur avec les points des sports cochés), au centre le nom de l'écran,
// à droite le rond de profil (Paramètres). Les cinq entrées (Course, Vélo, Natation, Musculation, Autres) sont fixes : plus de « + ».
// Le menu s'ouvre sous la barre : une case par sport, on en coche un ou plusieurs (course et vélo, par exemple), puis « Appliquer ».
// Rien de coché = « Tous ». Le choix est un filtre global : il reste quand on change d'écran.
// La barre est posée tout en haut de l'écran : elle réserve elle-même la place de l'heure et de l'encoche.
export function BarreSports({ titre }: { titre: string }) {
  const p = usePalette();
  const haut = useSafeAreaInsets().top;
  const { familles, selection } = useMenu();
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Les cases cochées dans le menu ouvert : une copie de travail, appliquée seulement par « Appliquer »
  const [brouillon, setBrouillon] = useState<string[]>([]);
  const sansSport = !familles.length;

  const nom = (f: string) => SPORTS[f as CleSport]?.nom ?? SPORTS.autre.nom;
  const court = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;
  const resume = selection.length ? selection.map(nom).join(', ') : 'Tous les sports';

  const ouvrirMenu = () => {
    setBrouillon(selection);
    setMenuOuvert(true);
  };
  const appliquer = () => {
    definirSelection(brouillon);
    setMenuOuvert(false);
  };

  return (
    <View style={[styles.barre, { borderBottomColor: p.trait, paddingTop: haut }]}>
      <View style={styles.rangee}>
        {/* Le titre est centré sur l'écran, quelle que soit la largeur du déclencheur à gauche et des boutons à droite */}
        <View pointerEvents="none" style={styles.centre}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.titre, { color: p.texte }]}>
            {titre}
          </Text>
        </View>
        <View style={styles.gauche}>
          {sansSport ? null : (
            <Pressable
              onPress={ouvrirMenu}
              accessibilityRole="button"
              accessibilityLabel={`Sports : ${resume}. Changer`}
              accessibilityState={{ expanded: menuOuvert }}
              style={({ pressed }) => [styles.declencheur, { borderColor: p.contourChamp, backgroundColor: p.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              {selection.length === 0 ? (
                <>
                  <View style={[styles.point, { backgroundColor: p.sportNeutre }]} />
                  <Text numberOfLines={1} style={[styles.declencheurTexte, { color: p.texte }]}>
                    Tous
                  </Text>
                </>
              ) : selection.length === 1 ? (
                <>
                  <View style={[styles.point, { backgroundColor: couleurSport(p, selection[0]) }]} />
                  <Text numberOfLines={1} style={[styles.declencheurTexte, { color: p.texte }]}>
                    {court(selection[0])}
                  </Text>
                </>
              ) : (
                // Plusieurs sports : une pile de points (trois au plus), chacun de la couleur de son sport
                <View style={styles.pile}>
                  {selection.slice(0, 3).map((f, i) => (
                    <View key={f} style={[styles.pointPile, { backgroundColor: couleurSport(p, f), borderColor: p.surface, marginLeft: i === 0 ? 0 : -6 }]} />
                  ))}
                </View>
              )}
              <Chevron couleur={p.texteDoux} />
            </Pressable>
          )}
        </View>
        <View style={styles.droite}>
          <BoutonReglages />
        </View>
      </View>

      {/* Le menu des sports : toucher à côté le ferme sans rien changer */}
      <Modal visible={menuOuvert} transparent animationType="fade" onRequestClose={() => setMenuOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOuvert(false)} accessibilityLabel="Fermer le menu des sports" accessibilityRole="button" />
        <View accessibilityViewIsModal style={[styles.panneau, { top: haut + 48, backgroundColor: p.surface, borderColor: p.traitFort }]}>
          <ScrollView contentContainerStyle={{ padding: 6 }} showsVerticalScrollIndicator={false} bounces={false}>
            <Ligne nom="Tous les sports" couleur={p.sportNeutre} coche={brouillon.length === 0} onPress={() => setBrouillon([])} role="radio" />
            {familles.map((f) => (
              <Ligne key={f} nom={nom(f)} couleur={couleurSport(p, f)} coche={brouillon.includes(f)} onPress={() => setBrouillon((b) => basculerSport(b, f))} role="checkbox" />
            ))}
          </ScrollView>
          <Pressable
            onPress={appliquer}
            accessibilityRole="button"
            style={({ pressed }) => [styles.appliquer, { backgroundColor: p.texte, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[typo.corpsFort, { color: p.fond }]}>
              {brouillon.length === 0 ? 'Tous les sports' : brouillon.length === 1 ? 'Appliquer (1 sport)' : `Appliquer (${brouillon.length} sports)`}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// Une ligne du menu : le point du sport, son nom et une case (ou un rond pour « Tous »). 48 pt de haut.
function Ligne({ nom, couleur, coche, onPress, role }: { nom: string; couleur: string; coche: boolean; onPress: () => void; role: 'checkbox' | 'radio' }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected: coche } : { checked: coche }}
      accessibilityLabel={nom}
      style={({ pressed }) => [styles.ligne, (pressed || coche) && { backgroundColor: p.surface2 }]}
    >
      <View style={[styles.point, { backgroundColor: couleur }]} />
      <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
        {nom}
      </Text>
      <View style={[role === 'radio' ? styles.rond : styles.case, { borderColor: coche ? couleur : p.contourChamp, backgroundColor: coche ? couleur : 'transparent' }]}>
        {coche ? <Text style={{ color: p.encreSurCouleur, fontSize: 12, lineHeight: 14, fontFamily: police.titre700 }}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

function Chevron({ couleur }: { couleur: string }) {
  return <Text style={{ color: couleur, fontSize: 12, lineHeight: 14, fontFamily: police.titre700 }}>⌄</Text>;
}

const styles = StyleSheet.create({
  barre: { borderBottomWidth: StyleSheet.hairlineWidth },
  rangee: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14 },
  centre: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: police.titre700, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, maxWidth: '40%' },
  gauche: { flexShrink: 1, flexDirection: 'row', alignItems: 'center' },
  droite: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // 44 pt de haut : la cible tactile minimale
  declencheur: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderWidth: 1, borderRadius: rayon.bloc, maxWidth: 140 },
  declencheurTexte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  point: { width: 10, height: 10, borderRadius: 5 },
  pile: { flexDirection: 'row', alignItems: 'center' },
  pointPile: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  panneau: { position: 'absolute', left: 12, width: 260, maxHeight: '70%', borderWidth: 1, borderRadius: rayon.bloc, overflow: 'hidden' },
  ligne: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 6 },
  case: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  rond: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  appliquer: { minHeight: 48, margin: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
