import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Un anneau découpé en parts, une couleur par part (la répartition du temps par sport) ; le centre se passe en enfant (le total d'heures).
// Une part vaut sa fraction du total des parts ; un petit vide sépare deux parts. Décoratif : la légende à côté dit tout, l'étiquette est lue à la place du dessin.
interface Props {
  parts: { cle: string; couleur: string; valeur: number }[];
  taille: number;
  epaisseur: number;
  /** Couleur de la piste, visible sous les parts (et seule quand il n'y a rien). */
  piste: string;
  etiquette: string;
  children?: ReactNode;
}

const VIDE = 3; // petit vide entre deux parts, en points

export function AnneauRepartition({ parts, taille, epaisseur, piste, etiquette, children }: Props) {
  const milieu = taille / 2;
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((t, x) => t + Math.max(0, x.valeur), 0);
  let decalage = 0;
  return (
    <View accessible accessibilityLabel={etiquette} style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille} accessible={false}>
        <Circle cx={milieu} cy={milieu} r={r} stroke={piste} strokeWidth={epaisseur} fill="none" />
        {total > 0
          ? parts.map((x) => {
              const longueur = (c * Math.max(0, x.valeur)) / total;
              const visible = parts.length > 1 ? Math.max(longueur - VIDE, 1) : longueur;
              const arc = (
                <Circle
                  key={x.cle}
                  cx={milieu}
                  cy={milieu}
                  r={r}
                  stroke={x.couleur}
                  strokeWidth={epaisseur}
                  fill="none"
                  strokeDasharray={`${visible} ${c - visible}`}
                  strokeDashoffset={-decalage}
                  rotation={-90}
                  origin={`${milieu}, ${milieu}`}
                />
              );
              decalage += longueur;
              return arc;
            })
          : null}
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
