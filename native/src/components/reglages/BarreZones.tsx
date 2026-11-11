import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { avecAlpha, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre de zones : chaque zone est une teinte du sport, de la plus douce à la plus dure. En mode « Les miennes », on glisse les séparateurs au doigt
// (ils sont larges de 44 pt pour être faciles à attraper) ; une bulle donne la valeur pendant le geste.
interface Props {
  /** Le début de chaque zone en % de la référence (la 1re à 0). */
  bornes: number[];
  /** Jusqu'où va la barre, en % de la référence. */
  axeMax: number;
  couleur: string;
  /** Appelé pendant le geste avec le % que le doigt désigne pour la borne `i`. Absent : barre en lecture seule. */
  onDeplace?: (i: number, pourcent: number) => void;
  /** Le texte de la bulle pour la borne `i` (par exemple « 153 bpm »). */
  texteBorne?: (i: number) => string;
  /** Fin d'un geste : le moment d'enregistrer. */
  onFin?: () => void;
}

const HAUT = 18;
const POIGNEE = 44;

export const teinteZone = (couleur: string, i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));

export function BarreZones({ bornes, axeMax, couleur, onDeplace, texteBorne, onFin }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [actif, setActif] = useState<number | null>(null);
  const n = bornes.length;
  const etat = useRef({ largeur, bornes, axeMax, onDeplace, onFin, debut: 0, indice: -1 });
  etat.current = { ...etat.current, largeur, bornes, axeMax, onDeplace, onFin };

  const reponseur = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!etat.current.onDeplace,
      onMoveShouldSetPanResponder: () => !!etat.current.onDeplace,
      onPanResponderTerminationRequest: () => false, // le défilement de l'écran ne reprend pas la main pendant qu'on règle
      onPanResponderGrant: (e) => {
        const { largeur: l, bornes: b, axeMax: max } = etat.current;
        const x = e.nativeEvent.locationX;
        // La séparateur le plus proche du doigt (à moins de 28 pt) : le 1er (à 0) n'est pas déplaçable
        let meilleur = -1;
        let ecart = 28;
        for (let i = 1; i < b.length; i++) {
          const d = Math.abs(x - (b[i] / max) * l);
          if (d < ecart) {
            ecart = d;
            meilleur = i;
          }
        }
        etat.current.indice = meilleur;
        etat.current.debut = meilleur > 0 ? (b[meilleur] / max) * l : 0;
        setActif(meilleur > 0 ? meilleur : null);
      },
      onPanResponderMove: (_e, g) => {
        const { indice, debut, largeur: l, axeMax: max, onDeplace: deplace } = etat.current;
        if (indice < 1 || !deplace || l <= 0) return;
        deplace(indice, ((debut + g.dx) / l) * max);
      },
      onPanResponderRelease: () => fin(),
      onPanResponderTerminate: () => fin(),
    }),
  ).current;
  const fin = () => {
    const quel = etat.current.indice;
    etat.current.indice = -1;
    setActif(null);
    if (quel > 0) etat.current.onFin?.();
  };

  const x = (pc: number) => (pc / axeMax) * largeur;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
      {...reponseur.panHandlers}
      accessible
      accessibilityLabel={`Les ${n} zones, de la plus douce à la plus dure${onDeplace ? '. Glisse les séparateurs pour les régler, ou utilise les boutons plus et moins de chaque zone.' : ''}`}
      style={styles.zone}
    >
      <View style={styles.barre}>
        {bornes.map((b, i) => {
          const fin2 = i < n - 1 ? bornes[i + 1] : axeMax;
          return <View key={i} style={{ flex: Math.max(0.5, fin2 - b), backgroundColor: teinteZone(couleur, i, n) }} />;
        })}
      </View>
      {onDeplace && largeur > 0
        ? bornes.slice(1).map((b, k) => {
            const i = k + 1;
            const est = actif === i;
            return (
              <View key={i} pointerEvents="none" style={[styles.poignee, { left: x(b) - POIGNEE / 2 }]}>
                <View style={[styles.trait, { backgroundColor: p.texte, borderColor: p.fond, height: est ? 34 : 28 }]} />
                {est && texteBorne ? (
                  <View style={[styles.bulle, { backgroundColor: p.texte }]}>
                    <Text style={[typo.micro, { color: p.fond, fontFamily: police.texte600, letterSpacing: 0 }]}>{texteBorne(i)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 56, justifyContent: 'center' },
  barre: { flexDirection: 'row', height: HAUT, borderRadius: rayon.rond, overflow: 'hidden', gap: 2 },
  poignee: { position: 'absolute', top: 0, width: POIGNEE, height: 56, alignItems: 'center', justifyContent: 'center' },
  trait: { width: 6, borderRadius: 3, borderWidth: 2 },
  bulle: { position: 'absolute', top: 0, paddingHorizontal: 8, paddingVertical: 2, borderRadius: rayon.s, minWidth: 54, alignItems: 'center' },
});
