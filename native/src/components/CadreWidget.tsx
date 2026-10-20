import { useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ContexteHeros, ContexteTaille, useRemplir } from '@/components/taille';
import { clair, rayon, sombre, type Palette } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { ContextePalette, usePalette } from '@/theme/usePalette';

// Le cadre de TOUS les widgets : même arrondi, mêmes marges, même titre (une pastille ovale). Chaque widget ne fournit que son contenu
// (chiffre, courbe, liste…) et son titre ; la taille de la boîte vient de la grille (voir Boite et taille.ts).
// Le premier widget d'une page prend le look dossard : fond clair (inversé en thème clair), liseré de la couleur du sport de la page,
// deux points d'attache. Son contenu est dessiné avec la palette INVERSE du thème : tous les widgets s'y adaptent tout seuls.
interface Props {
  titre?: string;
  /** Aplat de couleur (par exemple celle d'un sport) : le contenu écrit en encre foncée. Sans effet sur le look dossard. */
  couleur?: string;
  /** Pas d'espace sous le titre (les tuiles gèrent le leur). */
  serre?: boolean;
  children?: ReactNode;
}

const LISERE = 4;

/** La palette d'un widget en look dossard : celle du thème inverse, sur le fond clair (ou foncé) du dossard. */
export function paletteHeros(base: Palette): Palette {
  const inverse = base === sombre ? clair : sombre;
  return { ...inverse, fond: base.dossardFond, surface: base.dossardFond };
}

/** Le titre d'un widget : une petite pastille ovale en majuscules, la même partout. */
export function TitreWidget({ titre, serre = false, petit = false }: { titre: string; serre?: boolean; petit?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.pastille, { backgroundColor: p.surface2 }, !serre && styles.espace, petit && styles.petite]}>
      <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
        {titre}
      </Text>
    </View>
  );
}

export function CadreWidget({ titre, couleur, serre = false, children }: Props) {
  const base = usePalette();
  const taille = useContext(ContexteTaille);
  const heros = useContext(ContexteHeros);
  const remplir = useRemplir();
  const dossard = !!heros && !couleur;
  const palette = dossard ? paletteHeros(base) : null;
  const fin = taille === 'xs'; // 60 pt de haut : pas de points d'attache, des marges réduites

  return (
    <View style={[styles.cadre, { backgroundColor: couleur ?? (dossard ? base.dossardFond : base.surface) }, fin && styles.cadreFin, dossard && !fin && styles.dossard, dossard && (fin ? styles.sousLisereFin : styles.sousLisere), remplir]}>
      {dossard ? <View style={[styles.lisere, { backgroundColor: heros.couleur }]} /> : null}
      {dossard && !fin ? (
        <>
          <View style={[styles.attache, styles.gauche, { backgroundColor: base.dossardTexte }]} />
          <View style={[styles.attache, styles.droite, { backgroundColor: base.dossardTexte }]} />
        </>
      ) : null}
      <ContextePalette.Provider value={palette}>
        {titre ? <TitreWidget titre={titre} serre={serre} /> : null}
        <View style={styles.corps}>{children}</View>
      </ContextePalette.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: rayon.bloc, paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden' },
  // Le dossard : plus de marge sur les côtés, pour que le texte démarre après les points d'attache
  dossard: { paddingHorizontal: 22 },
  sousLisere: { paddingTop: 14 + LISERE },
  // XS : une ligne de 60 pt
  cadreFin: { paddingVertical: 5 },
  sousLisereFin: { paddingTop: 5 + LISERE },
  lisere: { position: 'absolute', top: 0, left: 0, right: 0, height: LISERE },
  attache: { position: 'absolute', top: 12 + LISERE, width: 7, height: 7, borderRadius: 3.5 },
  gauche: { left: 12 },
  droite: { right: 12 },
  pastille: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 3 },
  espace: { marginBottom: 10 },
  petite: { paddingVertical: 1 },
  corps: { flex: 1 },
});
