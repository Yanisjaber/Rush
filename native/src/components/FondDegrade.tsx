import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useMenu } from '@/stores/menu';
import { couleurSport } from '@/theme/sports';
import { melange } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Le fond de toute l'app, posé UNE fois derrière les écrans (voir app/_layout.tsx) : un dégradé en diagonale du gris-bleu au noir,
// avec quatre lueurs réparties dans la page. Les lueurs prennent la couleur du sport choisi dans la barre du haut (neutre sur « Tous »).
// Les écrans ont un fond transparent pour le laisser voir. Port de body { background } dans app/src/lib/design/global.css.
// Coordonnées en fraction de l'écran : cx, cy = centre, r = rayon (étiré à la forme de l'écran), force = opacité au centre.
const LUEURS = [
  { cx: 0.08, cy: 0.06, r: 0.55, force: 1 },
  { cx: 0.95, cy: 0.22, r: 0.5, force: 0.8 },
  { cx: 0.5, cy: 0.42, r: 0.6, force: 0.75 }, // au milieu : sans elle le centre de la page restait très sombre
  { cx: 0.05, cy: 0.62, r: 0.55, force: 0.7 },
  { cx: 0.88, cy: 0.96, r: 0.6, force: 1 },
];

export function FondDegrade() {
  const p = usePalette();
  const { filtre } = useMenu();
  const halo = filtre === 'tout' ? p.sportNeutre : couleurSport(p, filtre);
  const sombre = p.fond === '#0c0d10';
  const haut = sombre ? '#181b23' : '#ffffff'; // le haut de page, un peu plus clair que le fond
  const force = sombre ? 0.24 : 0.4; // en clair il faut plus d'opacité pour que la couleur ressorte sur le blanc

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="base" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={haut} />
            <Stop offset="0.55" stopColor={melange(haut, p.fond, 45)} />
            <Stop offset="1" stopColor={p.fond} />
          </LinearGradient>
          {LUEURS.map((l, i) => (
            <RadialGradient key={i} id={`lueur${i}`} cx={l.cx} cy={l.cy} r={l.r}>
              <Stop offset="0" stopColor={halo} stopOpacity={force * l.force} />
              <Stop offset="0.75" stopColor={halo} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
        {LUEURS.map((l, i) => (
          <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#lueur${i})`} />
        ))}
      </Svg>
    </View>
  );
}
