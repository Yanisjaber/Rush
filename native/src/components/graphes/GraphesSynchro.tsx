import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { CourbesSortie } from '@/data/outils/courbes-sortie';
import { aireSousCourbe, echelle, lisse } from '@/data/outils/courbes';
import { formatAllure, formatKm, formatNombre } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les courbes de la sortie l'une sous l'autre (allure ou vitesse, cœur, cadence, puissance), sur le même axe de distance : un seul curseur,
// qu'on glisse au doigt, donne la valeur de chaque mesure au même endroit.
// Le relief (altitude) est dessiné en silhouette derrière chaque courbe, et le cœur est posé sur ses zones colorées.
// Le bouton « Zoom » fait apparaître deux poignées : on isole une portion de la sortie et chaque courbe affiche sa moyenne sur cette portion.
interface Props {
  courbes: CourbesSortie;
  /** Distance de la sortie (km), si les flux n'en ont pas. */
  km: number | null;
  /** Course : l'allure ; vélo : la vitesse. */
  rythme: 'allure' | 'vitesse';
  couleur: string;
  /** La hauteur disponible pour tout le bloc (pastille Zoom, courbes, axe) : les courbes s'y adaptent. */
  hauteur: number;
  /** Début des zones cardio Z3, Z4 et Z5 (bpm), pour colorer le fond de la courbe de cœur. Absent sans FC max ni seuil. */
  seuilsCoeur?: [number, number, number] | null;
  /** Le doigt est posé sur les courbes : l'écran suspend le balayage des pages. */
  onGlisse?: (actif: boolean) => void;
}

const MARGE = 6;
const ENTETE = 20; // le titre et la valeur de chaque courbe
const HAUT_BARRE = 36; // la ligne de la pastille Zoom
const HAUT_AXE = 16;
const ECART_MIN = 0.04; // les deux poignées ne se rapprochent pas plus (4 % de la sortie)

interface Serie {
  cle: string;
  titre: string;
  valeurs: number[];
  couleur: string;
  /** Valeur lisible pour un point (v) ou la moyenne. */
  texte: (v: number) => string;
  /** Sens inversé : la plus petite valeur en haut (l'allure : plus c'est rapide, plus c'est haut). */
  inverse?: boolean;
}

export function GraphesSynchro({ courbes, km, rythme, couleur, hauteur, seuilsCoeur, onGlisse }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [fraction, setFraction] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [plage, setPlage] = useState<[number, number]>([0.3, 0.7]);
  const bloc = useRef<ComponentRef<typeof View>>(null);
  const gauche = useRef(0); // le bord gauche du bloc à l'écran : pageX est stable d'un bout à l'autre du geste, locationX saute d'un élément à l'autre
  const poignee = useRef<0 | 1>(0); // la poignée qu'on tient (la plus proche du doigt au moment où il se pose)
  const refs = useRef({ largeur: 0, onGlisse, plage });
  refs.current = { largeur, onGlisse, plage };
  const distance = courbes.km ?? km;

  const series: Serie[] = [];
  if (courbes.vitesse) {
    if (rythme === 'allure') series.push({ cle: 'allure', titre: 'ALLURE', valeurs: courbes.vitesse.map((v) => Math.min(1200, Math.max(150, 1000 / v))), couleur, texte: (v) => formatAllure(v), inverse: true });
    else series.push({ cle: 'vitesse', titre: 'VITESSE', valeurs: courbes.vitesse.map((v) => v * 3.6), couleur, texte: (v) => `${formatKm(v, 1)} km/h` });
  }
  if (courbes.fc) series.push({ cle: 'fc', titre: 'CŒUR', valeurs: courbes.fc, couleur: p.danger, texte: (v) => `${Math.round(v)} bpm` });
  if (courbes.cadence) series.push({ cle: 'cadence', titre: 'CADENCE', valeurs: courbes.cadence, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} ${rythme === 'vitesse' ? 'tr/min' : 'pas/min'}` });
  if (courbes.watts) series.push({ cle: 'watts', titre: 'PUISSANCE', valeurs: courbes.watts, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} W` });
  // Sans altitude, la courbe d'altitude n'existe pas ; avec, elle sert de fond (silhouette) à toutes les autres
  const relief = courbes.altitude ?? null;
  if (!series.length && relief) series.push({ cle: 'altitude', titre: 'ALTITUDE', valeurs: relief, couleur: p.texteDoux, texte: (v) => `${formatNombre(Math.round(v))} m` });
  if (!series.length) return null;

  const n = courbes.n;
  const hSerie = Math.max(34, Math.floor((hauteur - HAUT_BARRE - HAUT_AXE) / series.length) - ENTETE);
  const versFraction = (x: number) => Math.min(1, Math.max(0, (x - MARGE) / Math.max(1, refs.current.largeur - 2 * MARGE)));
  const poser = (x: number) => {
    refs.current.onGlisse?.(true);
    const f = versFraction(x);
    if (!zoom) return setFraction(f);
    // Mode zoom : la poignée tenue suit le doigt, sans dépasser l'autre
    const [a, b] = refs.current.plage;
    setPlage(poignee.current === 0 ? [Math.min(f, b - ECART_MIN), b] : [a, Math.max(f, a + ECART_MIN)]);
  };
  const debut = (x: number) => {
    if (zoom) {
      const f = versFraction(x);
      const [a, b] = refs.current.plage;
      poignee.current = Math.abs(f - a) <= Math.abs(f - b) ? 0 : 1;
    }
    poser(x);
  };
  const fin = () => {
    setFraction(null);
    refs.current.onGlisse?.(false);
  };
  const i = fraction == null ? null : Math.round(fraction * (n - 1));
  const x = fraction == null ? null : MARGE + fraction * (largeur - 2 * MARGE);
  const [ia, ib] = [Math.round(plage[0] * (n - 1)), Math.round(plage[1] * (n - 1))];
  const xa = MARGE + plage[0] * (largeur - 2 * MARGE);
  const xb = MARGE + plage[1] * (largeur - 2 * MARGE);
  const hauteurBloc = series.length * (hSerie + ENTETE);
  const moyenne = (v: number[], de: number, a: number) => v.slice(de, a + 1).reduce((s, e) => s + e, 0) / Math.max(1, a - de + 1);

  // La silhouette du relief : la même pour toutes les courbes (échelle propre à l'altitude)
  const reliefChemin = (l: number, h: number) => {
    if (!relief || l <= 0) return null;
    const pts = echelle(relief, l, h, MARGE);
    return aireSousCourbe(lisse(pts), pts, h);
  };
  // Les bandes de zones du cœur : trois fonds de plus en plus soutenus (Z3, Z4, Z5)
  const bandesCoeur = (s: Serie, l: number, h: number) => {
    if (s.cle !== 'fc' || !seuilsCoeur) return null;
    const bas = Math.min(...s.valeurs);
    const haut = Math.max(...s.valeurs);
    const y = (v: number) => MARGE + (1 - (Math.min(haut, Math.max(bas, v)) - bas) / (haut - bas || 1)) * (h - 2 * MARGE);
    const [z3, z4, z5] = seuilsCoeur;
    const bande = (de: number, a: number, teinte: string) => (y(de) - y(a) > 0.5 ? <Rect key={teinte} x={0} y={y(a)} width={l} height={y(de) - y(a)} fill={teinte} /> : null);
    return (
      <>
        {bande(z3, z4, p.danger + '1a')}
        {bande(z4, z5, p.danger + '33')}
        {bande(z5, 999, p.danger + '55')}
      </>
    );
  };

  return (
    <View style={{ gap: 0 }}>
      <View style={[styles.barre, { height: HAUT_BARRE }]}>
        <Pressable
          onPress={() => {
            setZoom((z) => !z);
            setFraction(null);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: zoom }}
          accessibilityLabel={zoom ? 'Quitter le zoom' : 'Zoom sur une portion de la sortie'}
          style={[styles.puce, zoom ? { backgroundColor: p.texte, borderColor: p.texte } : { borderColor: p.traitFort }]}
        >
          <Text style={[typo.micro, { color: zoom ? p.fond : p.texteDoux, letterSpacing: 1.2 }]}>ZOOM</Text>
        </Pressable>
        <Text style={[typo.petit, { color: p.texteMuet, flexShrink: 1 }]} numberOfLines={1}>
          {zoom && distance != null ? `de ${formatKm(distance * plage[0], 1)} à ${formatKm(distance * plage[1], 1)} km` : i != null && distance != null ? `km ${formatKm((distance * i) / (n - 1), 1)}` : 'Pose le doigt sur les courbes'}
        </Text>
      </View>
      <View
        ref={bloc}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        // Le doigt se pose : le curseur (ou la poignée la plus proche) bouge tout de suite ; il suit le doigt (pageX) et s'efface quand on le lève
        onTouchStart={(e) => {
          const pageX = e.nativeEvent.pageX;
          bloc.current?.measureInWindow((x0) => {
            gauche.current = x0;
            debut(pageX - x0);
          });
        }}
        onTouchMove={(e) => poser(e.nativeEvent.pageX - gauche.current)}
        onTouchEnd={fin}
        onTouchCancel={fin}
        accessible
        accessibilityLabel="Courbes de la sortie, glisse le doigt pour lire les valeurs"
        style={[styles.bloc, { backgroundColor: p.surface, height: hauteurBloc }]}
      >
        {series.map((s, k) => {
          const moy = zoom ? moyenne(s.valeurs, ia, ib) : s.valeurs.reduce((a, b) => a + b, 0) / s.valeurs.length;
          const haut = Math.max(...s.valeurs);
          const bas = Math.min(...s.valeurs);
          const points = largeur > 0 ? echelle(s.inverse ? s.valeurs.map((v) => -v) : s.valeurs, largeur, hSerie, MARGE) : [];
          const fond = s.cle === 'altitude' ? null : reliefChemin(largeur, hSerie);
          return (
            <View key={s.cle} style={[styles.serie, k > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.entete, { height: ENTETE }]}>
                <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{s.titre}</Text>
                <Text style={[styles.valeur, { color: p.texte }]}>{zoom ? `moy. ${s.texte(moy)}` : i == null ? `moy. ${s.texte(moy)}` : s.texte(s.valeurs[i])}</Text>
              </View>
              {largeur > 0 && haut > bas ? (
                <Svg width={largeur} height={hSerie} pointerEvents="none">
                  {fond ? <Path d={fond} fill={p.trait} opacity={0.9} /> : null}
                  {bandesCoeur(s, largeur, hSerie)}
                  <Path d={lisse(points)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              ) : (
                <View style={{ height: hSerie }} />
              )}
            </View>
          );
        })}
        {largeur > 0 && zoom ? (
          // La portion choisie : voile sur la sortie et deux poignées qu'on fait glisser
          <Svg pointerEvents="none" width={largeur} height="100%" style={StyleSheet.absoluteFill}>
            <Rect x={xa} y={0} width={Math.max(0, xb - xa)} height="100%" fill={couleur} opacity={0.14} />
            <Rect x={xa - 2} y={6} width={4} height="92%" rx={2} fill={p.texte} />
            <Rect x={xb - 2} y={6} width={4} height="92%" rx={2} fill={p.texte} />
          </Svg>
        ) : x != null ? (
          // Un seul trait pointillé sur toutes les courbes
          <Svg pointerEvents="none" width={largeur} height="100%" style={StyleSheet.absoluteFill}>
            <Line x1={x} y1={0} x2={x} y2="100%" stroke={p.texteDoux} strokeWidth={1.5} strokeDasharray="3 4" />
          </Svg>
        ) : null}
      </View>
      <View style={[styles.axe, { height: HAUT_AXE }]}>
        {distance != null && distance > 0
          ? [0, 1, 2, 3, 4].map((k) => (
              <Text key={k} style={[typo.petit, { color: p.texteMuet, fontSize: 11 }]}>
                {k === 0 ? '0 km' : formatKm((distance * k) / 4, distance >= 100 ? 0 : 1)}
              </Text>
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: espace.e3 },
  puce: { minHeight: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bloc: { borderRadius: rayon.base, overflow: 'hidden', paddingHorizontal: 0 },
  serie: { paddingTop: 0 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: espace.e3 },
  valeur: { fontFamily: police.texte600, fontSize: 14, fontVariant: ['tabular-nums'] },
  axe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: MARGE },
});
