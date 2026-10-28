import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line } from 'react-native-svg';

// Un anneau qui se remplit de 0 à 100 : la forme dit l'essentiel avant qu'on lise un chiffre. Il part de midi et tourne dans le sens des aiguilles.
// Il se remplit en une courte animation à l'ouverture (sautée si l'utilisateur a demandé de réduire les animations dans iOS).
// `reperes` : de petits traits sur la piste (par exemple 40 et 65) qui donnent l'échelle sans un mot.
// Le contenu du centre se passe en enfant.
const CercleAnime = Animated.createAnimatedComponent(Circle);

interface Props {
  /** De 0 à 100 ; null = anneau vide (pas de donnée). */
  valeur: number | null;
  taille: number;
  epaisseur: number;
  couleur: string;
  piste: string;
  reperes?: { valeur: number; couleur: string }[];
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
  children?: ReactNode;
}

export function AnneauJauge({ valeur, taille, epaisseur, couleur, piste, reperes = [], etiquette, children }: Props) {
  const reduit = useReducedMotion();
  const progres = useSharedValue(reduit ? (valeur ?? 0) / 100 : 0);
  useEffect(() => {
    const cible = Math.min(1, Math.max(0, (valeur ?? 0) / 100));
    progres.value = reduit ? cible : withTiming(cible, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [valeur, reduit, progres]);

  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const proprietes = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progres.value) }));
  const milieu = taille / 2;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille}>
        <G rotation={-90} originX={milieu} originY={milieu}>
          <Circle cx={milieu} cy={milieu} r={r} fill="none" stroke={piste} strokeWidth={epaisseur} />
          {valeur != null ? <CercleAnime cx={milieu} cy={milieu} r={r} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={proprietes} /> : null}
          {reperes.map((rep) => {
            // Un petit trait en travers de la piste, à la position du repère
            const angle = (rep.valeur / 100) * 2 * Math.PI;
            const x1 = milieu + (r - epaisseur / 2 - 1) * Math.cos(angle);
            const y1 = milieu + (r - epaisseur / 2 - 1) * Math.sin(angle);
            const x2 = milieu + (r + epaisseur / 2 + 1) * Math.cos(angle);
            const y2 = milieu + (r + epaisseur / 2 + 1) * Math.sin(angle);
            return <Line key={rep.valeur} x1={x1} y1={y1} x2={x2} y2={y2} stroke={rep.couleur} strokeWidth={2} strokeLinecap="round" />;
          })}
        </G>
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
