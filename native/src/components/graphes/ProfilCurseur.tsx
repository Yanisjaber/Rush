import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as TexteSvg } from 'react-native-svg';
import { aireSousCourbe, echelle, lisse } from '@/data/outils/courbes';
import { formatKm, formatNombre } from '@/data/outils/format';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le profil d'altitude avec un curseur qu'on glisse au doigt : une bulle au-dessus du curseur donne la distance et l'altitude du point touché, et la carte est prévenue (`onChange`, fraction de 0 à 1, ou null quand le doigt est levé).
// L'échelle est en mètres, avec des repères ronds (150, 155, 160…) pour qu'on voie si le parcours est plat ou non.
// Le curseur n'existe que tant que le doigt est posé sur la courbe : il disparaît dès qu'on le lève (avec sa bulle et le point de la carte). À VoiceOver : « augmenter » et « diminuer » le déplacent d'un pas.
interface Props {
  profil: number[];
  min: number;
  max: number;
  /** Longueur du parcours en km (pour la distance du curseur et l'axe). */
  km: number | null;
  couleur: string;
  hauteur?: number;
  onChange?: (fraction: number | null) => void;
  /** Le doigt est posé sur la courbe (true) ou levé (false) : l'écran peut suspendre un défilement qui gênerait le geste. */
  onGlisse?: (actif: boolean) => void;
}

const MARGE = 10; // assez pour que le rond du curseur (rayon 6 + contour 3) ne soit jamais coupé
const GAUCHE = 28; // la place des repères d'altitude, à gauche (trois chiffres de 11 pt)

/** Un pas rond pour les repères d'altitude : on veut au plus 5 intervalles (assez de repères pour lire, pas trop pour rester propre). */
function pasRond(ecart: number): number {
  return [5, 10, 20, 50, 100, 200, 500, 1000].find((s) => ecart / s <= 5) ?? 1000;
}

export function ProfilCurseur({ profil, min, max, km, couleur, hauteur = 120, onChange, onGlisse }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [largeurBulle, setLargeurBulle] = useState(120);
  const n = profil.length;
  const [index, setIndex] = useState(0);
  const [actif, setActif] = useState(false); // le curseur n'est montré que tant que le doigt est posé
  const refs = useRef({ largeur: 0, n, onChange, onGlisse });
  refs.current = { largeur, n, onChange, onGlisse };

  const aller = (i: number) => {
    const borne = Math.min(refs.current.n - 1, Math.max(0, Math.round(i)));
    setIndex(borne);
    setActif(true);
    refs.current.onChange?.(refs.current.n > 1 ? borne / (refs.current.n - 1) : 0);
  };
  // Doigt levé : le curseur, sa bulle et le point de la carte disparaissent, et l'écran retrouve le défilement des pages
  const fin = () => {
    setActif(false);
    refs.current.onChange?.(null);
    refs.current.onGlisse?.(false);
  };
  const versX = (x: number) => {
    const { largeur: l, n: total } = refs.current;
    if (l <= GAUCHE + 2 * MARGE || total < 2) return 0;
    return ((x - GAUCHE - MARGE) / (l - GAUCHE - 2 * MARGE)) * (total - 1);
  };

  const gestes = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          refs.current.onGlisse?.(true);
          aller(versX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => aller(versX(e.nativeEvent.locationX)),
        onPanResponderRelease: () => fin(),
        onPanResponderTerminate: () => fin(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // L'échelle : des bornes rondes autour des altitudes réelles, et un repère à chaque pas
  const pas = pasRond(Math.max(max - min, 1));
  const bas = Math.floor(min / pas) * pas;
  const haut = Math.max(Math.ceil(max / pas) * pas, bas + pas);
  const reperes: number[] = [];
  for (let v = bas; v <= haut; v += pas) reperes.push(v); // de la base (la plus basse graduation) jusqu'en haut
  const yDe = (v: number) => hauteur - MARGE - ((v - bas) / (haut - bas)) * (hauteur - 2 * MARGE);

  const points = largeur > GAUCHE ? echelle(profil, largeur - GAUCHE, hauteur, MARGE, bas, haut).map(([x, y]): [number, number] => [x + GAUCHE, y]) : [];
  const ligne = lisse(points);
  const zone = aireSousCourbe(ligne, points, yDe(bas)); // le remplissage s'arrête sur la ligne de base
  const curseur = actif ? points[index] : undefined;
  const distance = km != null && km > 0 && n > 1 ? (index / (n - 1)) * km : null;
  const altitude = profil[index];
  const texteBulle = `${formatNombre(altitude ?? min)} m${distance != null ? ` · km ${formatKm(distance, 1)}` : ''}`;
  const gaucheBulle = curseur ? Math.min(Math.max(curseur[0] - largeurBulle / 2, 0), Math.max(largeur - largeurBulle, 0)) : 0;
  const idFondu = 'fondu-curseur';

  return (
    <View>
      <View
        {...gestes.panHandlers}
        // Dès que le doigt se pose (avant même le glissement) : l'écran suspend le retour par balayage, qui sinon fermerait la page
        onTouchStart={(e) => {
          refs.current.onGlisse?.(true);
          // Le curseur se place dès que le doigt se pose : un simple appui suffit, sans attendre que le système de gestes prenne la main
          aller(versX(e.nativeEvent.locationX));
        }}
        onTouchEnd={() => fin()}
        onTouchCancel={() => fin()}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Profil d'altitude, de ${formatNombre(min)} à ${formatNombre(max)} mètres`}
        accessibilityValue={{ text: `${distance != null ? `kilomètre ${formatKm(distance, 1)}, ` : ''}${formatNombre(altitude ?? min)} mètres` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => aller(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1) * Math.max(1, Math.round(n / 20)))}
        style={{ height: hauteur }}
      >
        {largeur > GAUCHE ? (
          <Svg width={largeur} height={hauteur} pointerEvents="none">
            <Defs>
              <LinearGradient id={idFondu} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={couleur} stopOpacity={0.35} />
                <Stop offset="1" stopColor={couleur} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {reperes.map((v, i) => (
              <Line key={v} x1={GAUCHE} y1={yDe(v)} x2={largeur} y2={yDe(v)} stroke={v === bas ? p.traitFort : p.trait} strokeWidth={1} />
            ))}
            {reperes.map((v, i) => (
              <TexteSvg key={`t${v}`} x={GAUCHE - 6} y={yDe(v) + 4} fontSize={11} fill={p.texteMuet} textAnchor="end">
                {v === bas ? 'm' : formatNombre(v)}
              </TexteSvg>
            ))}
            {zone ? <Path d={zone} fill={`url(#${idFondu})`} /> : null}
            {ligne ? <Path d={ligne} fill="none" stroke={couleur} strokeWidth={2.6} strokeLinecap="round" /> : null}
            {curseur ? (
              <>
                <Line x1={curseur[0]} y1={0} x2={curseur[0]} y2={hauteur} stroke={p.texteDoux} strokeWidth={1.5} strokeDasharray="3 4" />
                <Circle cx={curseur[0]} cy={curseur[1]} r={6} fill={p.texte} stroke={couleur} strokeWidth={3} />
              </>
            ) : null}
          </Svg>
        ) : null}
        {curseur ? (
          // La pastille est posée sur la courbe, au-dessus du point (en dessous si le point est trop haut pour qu'elle tienne), reliée au point par le trait pointillé
          <View
            pointerEvents="none"
            onLayout={(e: LayoutChangeEvent) => setLargeurBulle(e.nativeEvent.layout.width)}
            style={[styles.bulle, { left: gaucheBulle, top: curseur[1] > 44 ? curseur[1] - 40 : curseur[1] + 14, backgroundColor: p.fond, borderColor: p.texteDoux }]}
          >
            <Text style={[typo.corpsFort, { color: p.texte, fontSize: 13 }]}>
              {curseur[1] > 44 ? '▼' : '▲'} {texteBulle}
            </Text>
          </View>
        ) : null}
      </View>
      {/* La ligne du bas : les repères de distance, départ, milieu et arrivée (le « km » n'est dit qu'au départ). L'unité des altitudes est dans la colonne, à la place de la graduation de base. */}
      <View style={[styles.axe, { paddingLeft: GAUCHE + MARGE, paddingRight: MARGE }]}>
        {km != null && km > 0 ? (
          <>
            <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'left' }]}>0 km</Text>
            <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'center' }]}>{formatKm(km / 2, km >= 100 ? 0 : 1)}</Text>
            <Text style={[typo.petit, styles.repere, { color: p.texteMuet, textAlign: 'right' }]}>{formatKm(km, km >= 100 ? 0 : 1)}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axe: { flexDirection: 'row', marginTop: 4 },
  repere: { flex: 1, fontSize: 11, lineHeight: 14 },
  bulle: { position: 'absolute', borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 4 },
});
