import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { typeADessiner } from '@/data/sports/catalogue-sports';
import { DESSINS } from '@/data/sports/dessins-sports';

// Le fond d'une activité sans carte (sans GPS, ou séance prévue sans GPX) : le dessin du sport répété en motif, pâle, dans la couleur du sport,
// comme un papier peint de salle de sport. Chaque sport du catalogue a son propre dessin (data/dessins-sports.ts), donc son propre fond.
// Décoratif : le sport est toujours écrit ailleurs sur l'écran.
interface Props {
  /** Le sport brut (Run, Ride, Rowing…) ou une famille. */
  sport: string;
  couleur: string;
  /** La zone libre : sous l'en-tête flottant (haut) et au-dessus de la feuille (bas). */
  marges: { haut: number; bas: number };
}

const CASE = 76; // le côté d'un dessin, en points
const OPACITE = 0.22;
const GRILLE = 24; // les dessins sont tracés sur une grille de 24

// Triathlon et duathlon n'ont pas de dessin dans la table : l'anneau en trois arcs de IconeSport
const ARCS = (() => {
  const r = 8.5;
  const pt = (a: number) => `${(12 + r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(12 + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return [[-85, 25], [35, 145], [155, 265]].map(([a0, a1]) => `<path d="M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}"/>`).join('');
})();

/** Le XML du motif : le dessin du sport posé en quinconce sur toute la zone (une rangée sur deux décalée d'une demi-case). */
export function motifSport(sport: string, couleur: string, largeur: number, hauteur: number): string {
  const type = typeADessiner(sport);
  const brut = type === 'Triathlon' || type === 'Duathlon' ? ARCS : (DESSINS[type] ?? DESSINS.Other);
  const dessin = brut.replaceAll('currentColor', couleur);
  const echelle = CASE / GRILLE;
  const colonnes = Math.ceil(largeur / CASE) + 1;
  const rangees = Math.ceil(hauteur / CASE) + 1;
  let cases = '';
  for (let r = 0; r < rangees; r++) {
    for (let c = 0; c < colonnes; c++) {
      const x = c * CASE - (r % 2 ? CASE / 2 : 0);
      const y = r * CASE;
      cases += `<g transform="translate(${x} ${y}) scale(${echelle})">${dessin}</g>`;
    }
  }
  // Trait de 1,1 sur la grille de 24 : environ 3,5 pt une fois agrandi
  return `<svg width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" stroke="${couleur}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${OPACITE}">${cases}</svg>`;
}

export function FondSport({ sport, couleur, marges }: Props) {
  const [taille, setTaille] = useState({ l: 0, h: 0 });
  const xml = useMemo(() => (taille.l > 0 && taille.h > 0 ? motifSport(sport, couleur, taille.l, taille.h) : ''), [sport, couleur, taille]);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => setTaille({ l: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
      style={[styles.zone, { top: 0, bottom: marges.bas }]}
    >
      {xml ? <SvgXml xml={xml} width={taille.l} height={taille.h} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
});
