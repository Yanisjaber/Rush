import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '@/theme/couleurs';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le menu du « + » du détail d'un jour : une feuille qui monte du bas, avec une tuile par ajout (son nom et une phrase qui l'explique). Chaque tuile ouvre son propre
// écran, sauf le repos qui se pose ou se retire d'un toucher. Toucher à côté ferme la feuille.
export type ChoixAjout = 'seance' | 'sortie' | 'modele' | 'competition' | 'note' | 'cycle' | 'repos';

const TUILES: { cle: ChoixAjout; nom: string; phrase: string; glyphe: string; couleur: keyof Palette | 'doux' }[] = [
  { cle: 'seance', nom: 'Séance prévue', phrase: 'Avec ses blocs', glyphe: 'S', couleur: 'sportCourse' },
  { cle: 'sortie', nom: 'Sortie faite', phrase: 'Saisie à la main', glyphe: '✓', couleur: 'sportVelo' },
  { cle: 'modele', nom: 'Modèle', phrase: 'Une séance type', glyphe: 'M', couleur: 'sportHybride' },
  { cle: 'competition', nom: 'Compétition', phrase: 'Objectif ou préparation', glyphe: 'C', couleur: 'sportMuscu' },
  { cle: 'note', nom: 'Note', phrase: 'Maladie, blessure…', glyphe: 'N', couleur: 'sportNatation' },
  { cle: 'cycle', nom: 'Cycle', phrase: "Une période d'entraînement", glyphe: '⟲', couleur: 'doux' },
];

export function MenuAjout({ ouvert, onFermer, onChoisir, repos }: { ouvert: boolean; onFermer: () => void; onChoisir: (c: ChoixAjout) => void; repos: boolean }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const couleurDe = (c: keyof Palette | 'doux') => (c === 'doux' ? p.texteDoux : (p[c] as string));
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer le menu d'ajout" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
        <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
        <View style={styles.tuiles}>
          {TUILES.map((t) => (
            <View key={t.cle} style={styles.emplacement}>
              <Pressable
                onPress={() => onChoisir(t.cle)}
                accessibilityRole="button"
                accessibilityLabel={`${t.nom}. ${t.phrase}`}
                style={({ pressed }) => [styles.tuile, { backgroundColor: p.surface2, opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={styles.tete}>
                  <View style={[styles.icone, { backgroundColor: couleurDe(t.couleur) }]}>
                    <Text style={[typo.corpsFort, { color: p.encreSurCouleur, fontSize: 14, lineHeight: 18 }]}>{t.glyphe}</Text>
                  </View>
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                    {t.nom}
                  </Text>
                </View>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{t.phrase}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => onChoisir('repos')}
          accessibilityRole="button"
          accessibilityLabel={repos ? 'Retirer le jour de repos' : 'Poser un jour de repos'}
          style={({ pressed }) => [styles.repos, { borderColor: p.traitFort, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{repos ? 'Retirer le jour de repos' : 'Poser un jour de repos'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  // Chaque emplacement s'étire sur la hauteur de la rangée et sa tuile le remplit : deux tuiles côte à côte ont toujours la même hauteur, même si l'une a une phrase sur deux lignes
  emplacement: { width: '50%', padding: 4 },
  tuile: { flex: 1, minHeight: 96, borderRadius: rayon.bloc, padding: espace.e3, gap: espace.e2 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  repos: { minHeight: 44, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
