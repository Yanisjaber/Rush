import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { paletteComplete } from '@/data/palette-couleurs';
import { rayon, espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les petits champs partagés par les feuilles du calendrier (ajout, modification d'une note) : des pastilles à choisir, et une ligne de couleurs.

/** Des pastilles dont une seule est choisie (cible tactile de 44 pt). */
export function PastillesChoix<T extends string>({ valeurs, actuel, onChoisir, etiquette }: { valeurs: { cle: T; nom: string }[]; actuel: T; onChoisir: (v: T) => void; etiquette: string }) {
  const p = usePalette();
  return (
    <View style={styles.pastilles} accessibilityRole="radiogroup" accessibilityLabel={etiquette}>
      {valeurs.map((v) => {
        const actif = actuel === v.cle;
        return (
          <Pressable
            key={v.cle}
            onPress={() => onChoisir(v.cle)}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={v.nom}
            style={[styles.pastille, { borderColor: actif ? p.texte : p.contourChamp, backgroundColor: actif ? p.texte : 'transparent' }]}
          >
            <Text numberOfLines={1} style={[typo.corpsFort, { color: actif ? p.fond : p.texte }]}>
              {v.nom}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Les huit teintes de l'icône « palette » (un disque en parts de couleur)
const PARTS_PALETTE = ['#ff5a4f', '#ff7a33', '#ffd60a', '#7fb069', '#22d3ee', '#4f8cff', '#9b6b9e', '#d65a7a'];
function IconePalette({ taille }: { taille: number }) {
  const r = taille / 2;
  return (
    <Svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
      {PARTS_PALETTE.map((couleur, i) => {
        const a0 = (i / PARTS_PALETTE.length) * 2 * Math.PI - Math.PI / 2;
        const a1 = ((i + 1) / PARTS_PALETTE.length) * 2 * Math.PI - Math.PI / 2;
        const d = `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
        return <Path key={couleur} d={d} fill={couleur} />;
      })}
    </Svg>
  );
}

/**
 * Une ligne de couleurs, une seule choisie, avec au bout une « palette » qui ouvre un choix plus large (40 couleurs). Les pastilles sont petites mais la zone
 * tactile reste de 44 pt de haut. Si la couleur actuelle n'est dans aucune des pastilles, le bouton palette la prend (et porte le contour du choix).
 */
export function ChoixCouleur({ couleurs, actuelle, onChoisir }: { couleurs: { hex: string; nom: string }[]; actuelle: string; onChoisir: (hex: string) => void }) {
  const p = usePalette();
  const [palette, setPalette] = useState(false);
  const perso = !couleurs.some((c) => c.hex.toLowerCase() === actuelle.toLowerCase());
  return (
    <>
      <View style={styles.couleurs} accessibilityRole="radiogroup" accessibilityLabel="Couleur">
        {couleurs.map((c) => (
          <Pressable
            key={c.hex}
            onPress={() => onChoisir(c.hex)}
            accessibilityRole="radio"
            accessibilityState={{ selected: actuelle.toLowerCase() === c.hex.toLowerCase() }}
            accessibilityLabel={c.nom}
            style={styles.couleurZone}
          >
            <View style={[styles.couleur, { backgroundColor: c.hex, borderColor: actuelle.toLowerCase() === c.hex.toLowerCase() ? p.texte : 'transparent' }]} />
          </Pressable>
        ))}
        <Pressable onPress={() => setPalette(true)} accessibilityRole="button" accessibilityLabel="Palette : toutes les couleurs" accessibilityState={{ selected: perso }} style={styles.couleurZone}>
          <View style={[styles.couleur, { borderColor: perso ? p.texte : 'transparent', backgroundColor: perso ? actuelle : 'transparent' }]}>
            {perso ? null : <IconePalette taille={TAILLE_COULEUR - 6} />}
          </View>
        </Pressable>
      </View>
      <Modal visible={palette} transparent animationType="fade" onRequestClose={() => setPalette(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPalette(false)} accessibilityLabel="Fermer la palette" accessibilityRole="button" />
        <View style={styles.centrePalette} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[styles.panneauPalette, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte }]}>
              Choisis une couleur
            </Text>
            <View style={styles.grillePalette}>
              {paletteComplete().map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => {
                    onChoisir(hex);
                    setPalette(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actuelle.toLowerCase() === hex }}
                  accessibilityLabel={`Couleur ${hex}`}
                  style={styles.couleurZone}
                >
                  <View style={[styles.couleur, { backgroundColor: hex, borderColor: actuelle.toLowerCase() === hex ? p.texte : 'transparent' }]} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const TAILLE_COULEUR = 32; // la pastille ; sa zone tactile est plus grande (voir couleurZone)

const styles = StyleSheet.create({
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastille: { minHeight: 44, minWidth: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  couleurs: { flexDirection: 'row', flexWrap: 'wrap' },
  // Zone tactile de 40 × 44 pt autour d'une pastille de 32 pt (neuf pastilles tiennent sur une ligne)
  couleurZone: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  couleur: { width: TAILLE_COULEUR, height: TAILLE_COULEUR, borderRadius: TAILLE_COULEUR / 2, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  centrePalette: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  panneauPalette: { width: 8 * 40 + 24, borderWidth: 1, borderRadius: rayon.bloc, padding: 12, gap: 8 },
  grillePalette: { flexDirection: 'row', flexWrap: 'wrap' },
});
