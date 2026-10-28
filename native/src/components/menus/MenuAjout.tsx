import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le menu du « + » du détail d'un jour : une feuille qui monte du bas, une ligne par ajout (pictogramme, nom et une phrase qui l'explique), rangée en trois
// groupes : prévoir, enregistrer, noter. Chaque ligne ouvre son propre écran, sauf le repos qui se pose ou se retire d'un toucher. Toucher à côté ferme la feuille.
// Glisser la feuille vers le bas la ferme (la liste, elle, ne rebondit pas : seule la feuille bouge ; assez tirée ou lancée assez vite, elle part, sinon elle revient).
// Aucune couleur de sport ici : ces lignes ne sont pas des sports (la couleur reste réservée aux sports).
export type ChoixAjout = 'seance' | 'sortie' | 'import' | 'competition' | 'note' | 'cycle' | 'repos';

// Les pictogrammes, dessinés sur une grille de 24 en trait (le contenu d'un <svg>)
const PICTOS: Record<ChoixAjout, string> = {
  seance: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5"/>',
  sortie: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l3 3 5-6"/>',
  import: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15"/>',
  competition: '<path d="M6 21V4M6 5h11l-2.5 4 2.5 4H6"/>',
  note: '<path d="M6 3.5h9l3.5 3.5v13.5H6zM9 11h6M9 14.5h6M9 18h3.5"/>',
  cycle: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  repos: '<path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z"/>',
};

const LIGNES: Record<Exclude<ChoixAjout, 'repos'>, { nom: string; phrase: string }> = {
  seance: { nom: 'Séance prévue', phrase: 'Avec ses blocs' },
  competition: { nom: 'Compétition', phrase: 'Objectif ou préparation' },
  cycle: { nom: 'Cycle', phrase: "Une période d'entraînement" },
  sortie: { nom: 'Activité faite', phrase: 'Saisie à la main' },
  import: { nom: 'Importer', phrase: 'Un fichier .fit, .gpx ou .tcx' },
  note: { nom: 'Note', phrase: 'Maladie, blessure…' },
};

const GROUPES: { titre: string; choix: Exclude<ChoixAjout, 'repos'>[] }[] = [
  { titre: 'Prévoir', choix: ['seance', 'competition', 'cycle'] },
  { titre: 'Enregistrer', choix: ['sortie', 'import'] },
  { titre: 'Noter', choix: ['note'] },
];

function Picto({ choix, couleur, taille }: { choix: ChoixAjout; couleur: string; taille: number }) {
  const xml = `<svg viewBox="0 0 24 24" stroke="${couleur}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">${PICTOS[choix]}</svg>`;
  return <SvgXml xml={xml} width={taille} height={taille} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function MenuAjout({ ouvert, onFermer, onChoisir, repos }: { ouvert: boolean; onFermer: () => void; onChoisir: (c: ChoixAjout) => void; repos: boolean }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { height } = useWindowDimensions();

  // Le glissement vers le bas : la feuille suit le doigt. Quand la liste défile, on ne prend la main que si elle est tout en haut.
  const decalage = useRef(new Animated.Value(0)).current;
  const defilement = useRef(0);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    if (ouvert) decalage.setValue(0);
  }, [ouvert, decalage]);
  const glissement = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5 && defilement.current <= 0,
        onPanResponderMove: (_e, g) => decalage.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            Animated.timing(decalage, { toValue: 800, duration: 160, useNativeDriver: true }).start(() => fermer.current());
          } else {
            Animated.spring(decalage, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(decalage, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
      }),
    [decalage],
  );
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer le menu d'ajout" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      <Animated.View
        {...glissement.panHandlers}
        accessibilityViewIsModal
        style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4, transform: [{ translateY: decalage }] }]}
      >
        <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
        {/* Sur un petit écran, la liste défile plutôt que de sortir de la feuille */}
        <ScrollView style={{ maxHeight: height * 0.75 }} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" scrollEventThrottle={16} onScroll={(e) => (defilement.current = e.nativeEvent.contentOffset.y)}>
          {GROUPES.map((g, i) => (
            <View key={g.titre}>
              <Text accessibilityRole="header" style={[typo.micro, styles.groupe, i === 0 && styles.premierGroupe, { color: p.texteMuet }]}>
                {g.titre.toUpperCase()}
              </Text>
              {g.choix.map((c, j) => (
                <Pressable
                  key={c}
                  onPress={() => onChoisir(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${LIGNES[c].nom}. ${LIGNES[c].phrase}`}
                  style={({ pressed }) => [styles.ligne, j > 0 && { borderTopColor: p.trait, borderTopWidth: 1 }, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.pastille, { backgroundColor: p.surface2 }]}>
                    <Picto choix={c} couleur={p.texte} taille={22} />
                  </View>
                  <View style={styles.texte}>
                    <Text style={[typo.corpsFort, { color: p.texte }]}>{LIGNES[c].nom}</Text>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{LIGNES[c].phrase}</Text>
                  </View>
                  <View style={[styles.chevron, { borderColor: p.texteMuet }]} />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => onChoisir('repos')}
          accessibilityRole="button"
          accessibilityLabel={repos ? 'Retirer le jour de repos' : 'Poser un jour de repos'}
          style={({ pressed }) => [styles.repos, { borderColor: p.traitFort, opacity: pressed ? 0.7 : 1 }]}
        >
          <Picto choix="repos" couleur={p.texteDoux} taille={18} />
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{repos ? 'Retirer le jour de repos' : 'Poser un jour de repos'}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  groupe: { marginTop: espace.e3, marginBottom: 4, marginLeft: 4, letterSpacing: 0.9 },
  premierGroupe: { marginTop: 0 },
  ligne: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 4 },
  pastille: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1 },
  chevron: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }], marginRight: 4 },
  repos: { minHeight: 44, flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
