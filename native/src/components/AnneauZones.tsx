import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

// Un anneau en trois zones et un repère qui se pose dessus : il dit OÙ tu en es (à ménager, moyen, récupéré), pas un chiffre qui se remplit.
// C'est la forme honnête d'une estimation : on lit une zone, la précision du chiffre exact n'a pas à s'imposer.
// Les zones suivent les seuils de lecture de l'état de forme (40 et 65). Le repère glisse de midi jusqu'à sa place à l'ouverture
// (immédiat si l'utilisateur a demandé de réduire les animations). Le contenu du centre se passe en enfant.
const CercleAnime = Animated.createAnimatedComponent(Circle);

interface Zone {
  de: number;
  a: number;
  couleur: string;
}

interface Props {
  /** De 0 à 100 ; null = pas de repère (pas de donnée). */
  valeur: number | null;
  taille: number;
  epaisseur: number;
  zones: Zone[];
  couleurRepere: string;
  contourRepere: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
  children?: ReactNode;
}

export function AnneauZones({ valeur, taille, epaisseur, zones, couleurRepere, contourRepere, etiquette, children }: Props) {
  const reduit = useReducedMotion();
  const cible = Math.min(1, Math.max(0, (valeur ?? 0) / 100));
  const progres = useSharedValue(reduit ? cible : 0);
  useEffect(() => {
    progres.value = reduit ? cible : withTiming(cible, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [cible, reduit, progres]);

  const milieu = taille / 2;
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const ESPACE = 3; // petit vide entre deux zones

  // Le repère : un point qui suit le cercle de midi (progres = 0) à sa place, dans le sens des aiguilles d'une montre
  const proprietes = useAnimatedProps(() => {
    const angle = progres.value * 2 * Math.PI - Math.PI / 2;
    return { cx: milieu + r * Math.cos(angle), cy: milieu + r * Math.sin(angle) };
  });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette} style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille}>
        <G rotation={-90} originX={milieu} originY={milieu}>
          {zones.map((z) => {
            const longueur = Math.max((z.a - z.de) / 100 * c - ESPACE, 0);
            return <Circle key={z.de} cx={milieu} cy={milieu} r={r} fill="none" stroke={z.couleur} strokeWidth={epaisseur} strokeDasharray={`${longueur.toFixed(1)} ${(c - longueur).toFixed(1)}`} strokeDashoffset={-(z.de / 100) * c - ESPACE / 2} />;
          })}
        </G>
        {valeur != null ? <CercleAnime r={epaisseur * 0.78} fill={couleurRepere} stroke={contourRepere} strokeWidth={3} animatedProps={proprietes} /> : null}
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
