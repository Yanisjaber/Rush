import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { Palette } from '@/theme/couleurs';

// Le menu du « + » du détail d'un jour : un panneau qui descend sous le bouton, une ligne par ajout. Chaque choix ouvre son propre écran (sauf le repos,
// qui se pose ou se retire d'un toucher). Toucher ailleurs ferme le menu.
export type ChoixAjout = 'seance' | 'sortie' | 'modele' | 'competition' | 'note' | 'cycle' | 'repos';

const LIGNES: { cle: ChoixAjout; nom: string; glyphe: string; couleur: keyof Palette | 'doux'; separe?: boolean }[] = [
  { cle: 'seance', nom: 'Séance prévue', glyphe: 'S', couleur: 'sportCourse' },
  { cle: 'sortie', nom: 'Sortie déjà faite', glyphe: '✓', couleur: 'sportVelo' },
  { cle: 'modele', nom: 'Modèle de séance', glyphe: 'M', couleur: 'sportHybride' },
  { cle: 'competition', nom: 'Compétition', glyphe: 'C', couleur: 'sportMuscu', separe: true },
  { cle: 'note', nom: 'Note', glyphe: 'N', couleur: 'sportNatation' },
  { cle: 'cycle', nom: 'Cycle', glyphe: '⟲', couleur: 'doux' },
  { cle: 'repos', nom: 'Jour de repos', glyphe: 'z', couleur: 'doux', separe: true },
];

// `haut` et `bas` : le haut et le bas du bouton « + » dans la fenêtre. Le menu s'ouvre dessous ; s'il n'y a pas assez de place (le « + » est bas dans l'écran), il s'ouvre dessus.
const HAUTEUR_MENU = 380;

export function MenuAjout({ ouvert, onFermer, onChoisir, haut, bas, repos }: { ouvert: boolean; onFermer: () => void; onChoisir: (c: ChoixAjout) => void; haut: number; bas: number; repos: boolean }) {
  const p = usePalette();
  const hauteurEcran = useWindowDimensions().height;
  const versLeHaut = hauteurEcran - bas - 24 < HAUTEUR_MENU && haut > hauteurEcran - bas;
  const placement = versLeHaut ? { bottom: hauteurEcran - haut + 6 } : { top: bas + 6 };
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer le menu d'ajout" accessibilityRole="button" />
      <View accessibilityViewIsModal style={[styles.panneau, placement, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
        {LIGNES.map((l) => {
          const couleur = l.couleur === 'doux' ? p.texteDoux : (p[l.couleur] as string);
          const nom = l.cle === 'repos' && repos ? 'Retirer le repos' : l.nom;
          return (
            <View key={l.cle}>
              {l.separe ? <View style={[styles.filet, { backgroundColor: p.traitFort }]} /> : null}
              <Pressable
                onPress={() => onChoisir(l.cle)}
                accessibilityRole="menuitem"
                accessibilityLabel={nom}
                style={({ pressed }) => [styles.ligne, pressed && { backgroundColor: p.surface2 }]}
              >
                <View style={[styles.icone, { backgroundColor: couleur }]}>
                  <Text style={[typo.corpsFort, { color: p.encreSurCouleur, fontSize: 14, lineHeight: 18 }]}>{l.glyphe}</Text>
                </View>
                <Text style={[typo.corpsFort, { color: l.cle === 'repos' ? p.texteDoux : p.texte, flex: 1 }]}>{nom}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panneau: { position: 'absolute', right: 16, width: 270, borderWidth: 1, borderRadius: rayon.bloc, padding: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 12 },
  icone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filet: { height: StyleSheet.hairlineWidth * 2, marginVertical: 4, marginHorizontal: 8 },
});
