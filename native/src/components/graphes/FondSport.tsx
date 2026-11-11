import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { familleAffichage } from '@/data/sports/familles';
import { avecAlpha } from '@/theme/couleurs';

// Le fond d'une activité sans carte (sans GPS, ou séance prévue sans GPX) : une grande silhouette du sport, dans la couleur du sport,
// à la place de la carte. Course : un coureur ; vélo : un cycliste ; natation : un nageur ; muscu et Hyrox : une barre à disques ; le reste : une montagne.
// Dessiné sur une grille de 200, en traits épais. Décoratif : le sport est toujours écrit ailleurs sur l'écran.
interface Props {
  /** Le sport brut (Run, Ride, Swim…) ou une famille. */
  sport: string;
  couleur: string;
  /** La zone libre : sous l'en-tête flottant (haut) et au-dessus de la feuille (bas). */
  marges: { haut: number; bas: number };
}

type Famille = 'course' | 'velo' | 'natation' | 'muscu' | 'autre';

function familleDuFond(sport: string): Famille {
  const f = familleAffichage(sport);
  if (f === 'course' || f === 'velo' || f === 'natation') return f;
  return f === 'muscu' || f === 'hyrox' ? 'muscu' : 'autre';
}

export function FondSport({ sport, couleur, marges }: Props) {
  const famille = familleDuFond(sport);
  const trait = { stroke: couleur, strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.zone, { top: marges.haut, bottom: marges.bas }]}>
      {/* Un grand disque pâle derrière la silhouette, pour la poser */}
      <View style={styles.centre}>
        <Svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
          <Circle cx={100} cy={100} r={92} fill={avecAlpha(couleur, 0.1)} />
          <Circle cx={100} cy={100} r={92} fill="none" stroke={avecAlpha(couleur, 0.25)} strokeWidth={1.5} />
          {famille === 'course' ? (
            <G>
              <Circle cx={118} cy={46} r={11} fill={couleur} />
              <Path d="M112 62 L96 104" {...trait} />
              <Path d="M110 68 L128 84 L148 74" {...trait} />
              <Path d="M110 68 L92 80 L80 100" {...trait} />
              <Path d="M96 104 L124 116 L120 150" {...trait} />
              <Path d="M96 104 L82 128 L56 140" {...trait} />
            </G>
          ) : null}
          {famille === 'velo' ? (
            <G>
              <Circle cx={46} cy={138} r={30} {...trait} />
              <Circle cx={154} cy={138} r={30} {...trait} />
              <Path d="M46 138 L88 138 L76 98 M88 138 L124 98 M76 98 L124 98 M124 98 L154 138 M124 98 L120 82 L138 82" {...trait} strokeWidth={7} />
              <Circle cx={132} cy={52} r={10} fill={couleur} />
              <Path d="M78 90 L120 64" {...trait} />
              <Path d="M120 64 L138 82" {...trait} />
              <Path d="M78 90 L104 112 L94 140" {...trait} />
            </G>
          ) : null}
          {famille === 'natation' ? (
            <G>
              <Circle cx={146} cy={92} r={11} fill={couleur} />
              <Path d="M132 102 L58 106" {...trait} />
              <Path d="M126 100 L142 68 L170 74" {...trait} />
              <Path d="M58 106 L30 98 M58 108 L28 116" {...trait} />
              <Path d="M12 130 q15 -12 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 M12 154 q15 -12 30 0 t30 0 t30 0 t30 0 t30 0 t30 0" {...trait} strokeWidth={6} stroke={avecAlpha(couleur, 0.6)} />
            </G>
          ) : null}
          {famille === 'muscu' ? (
            <G>
              <Path d="M22 100 L178 100" {...trait} strokeWidth={8} />
              <Rect x={38} y={62} width={14} height={76} rx={4} fill={couleur} />
              <Rect x={54} y={74} width={11} height={52} rx={3} fill={avecAlpha(couleur, 0.7)} />
              <Rect x={148} y={62} width={14} height={76} rx={4} fill={couleur} />
              <Rect x={135} y={74} width={11} height={52} rx={3} fill={avecAlpha(couleur, 0.7)} />
            </G>
          ) : null}
          {famille === 'autre' ? (
            <G>
              <Path d="M24 148 L82 62 L108 102 L128 76 L176 148 Z" {...trait} />
              <Circle cx={148} cy={52} r={9} fill={couleur} />
            </G>
          ) : null}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 16 },
  centre: { width: '100%', height: '100%', maxWidth: 360, maxHeight: 360 },
});
