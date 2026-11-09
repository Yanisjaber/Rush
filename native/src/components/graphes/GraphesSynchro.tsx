import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { CourbesSortie } from '@/data/outils/courbes-sortie';
import { echelle, lisse } from '@/data/outils/courbes';
import { formatAllure, formatKm, formatNombre } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les courbes de la sortie l'une sous l'autre (allure ou vitesse, cœur, altitude, cadence, puissance), sur le même axe de distance : un seul curseur,
// qu'on glisse au doigt, donne la valeur de chaque mesure au même endroit (maquette 3 « Graphes synchronisés »). Pas de curseur : la moyenne de chaque courbe.
interface Props {
  courbes: CourbesSortie;
  /** Distance de la sortie (km), si les flux n'en ont pas. */
  km: number | null;
  /** Course : l'allure ; vélo : la vitesse. */
  rythme: 'allure' | 'vitesse';
  couleur: string;
  /** Le doigt est posé sur les courbes : l'écran suspend le balayage des pages. */
  onGlisse?: (actif: boolean) => void;
}

const HAUTEUR = 56;
const MARGE = 6;

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

export function GraphesSynchro({ courbes, km, rythme, couleur, onGlisse }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [fraction, setFraction] = useState<number | null>(null);
  const bloc = useRef<ComponentRef<typeof View>>(null);
  const gauche = useRef(0); // le bord gauche du bloc à l'écran : pageX est stable d'un bout à l'autre du geste, locationX saute d'un élément à l'autre
  const refs = useRef({ largeur: 0, onGlisse });
  refs.current = { largeur, onGlisse };
  const distance = courbes.km ?? km;

  const series: Serie[] = [];
  if (courbes.vitesse) {
    if (rythme === 'allure') series.push({ cle: 'allure', titre: 'ALLURE', valeurs: courbes.vitesse.map((v) => Math.min(1200, Math.max(150, 1000 / v))), couleur, texte: (v) => formatAllure(v), inverse: true });
    else series.push({ cle: 'vitesse', titre: 'VITESSE', valeurs: courbes.vitesse.map((v) => v * 3.6), couleur, texte: (v) => `${formatKm(v, 1)} km/h` });
  }
  if (courbes.fc) series.push({ cle: 'fc', titre: 'CŒUR', valeurs: courbes.fc, couleur: p.danger, texte: (v) => `${Math.round(v)} bpm` });
  if (courbes.altitude) series.push({ cle: 'altitude', titre: 'ALTITUDE', valeurs: courbes.altitude, couleur: p.texteDoux, texte: (v) => `${formatNombre(Math.round(v))} m` });
  if (courbes.cadence) series.push({ cle: 'cadence', titre: 'CADENCE', valeurs: courbes.cadence, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} ${rythme === 'vitesse' ? 'tr/min' : 'pas/min'}` });
  if (courbes.watts) series.push({ cle: 'watts', titre: 'PUISSANCE', valeurs: courbes.watts, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} W` });
  if (!series.length) return null;

  const n = courbes.n;
  const versFraction = (x: number) => Math.min(1, Math.max(0, (x - MARGE) / Math.max(1, refs.current.largeur - 2 * MARGE)));
  const poser = (x: number) => {
    refs.current.onGlisse?.(true);
    setFraction(versFraction(x));
  };
  const fin = () => {
    setFraction(null);
    refs.current.onGlisse?.(false);
  };
  const i = fraction == null ? null : Math.round(fraction * (n - 1));
  const x = fraction == null ? null : MARGE + fraction * (largeur - 2 * MARGE);

  return (
    <View style={{ gap: espace.e2 }}>
      <View
        ref={bloc}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        // Le doigt se pose : le curseur apparaît tout de suite ; il suit le doigt (pageX) et disparaît quand on le lève
        onTouchStart={(e) => {
          const pageX = e.nativeEvent.pageX;
          bloc.current?.measureInWindow((x0) => {
            gauche.current = x0;
            poser(pageX - x0);
          });
        }}
        onTouchMove={(e) => poser(e.nativeEvent.pageX - gauche.current)}
        onTouchEnd={fin}
        onTouchCancel={fin}
        accessible
        accessibilityLabel="Courbes de la sortie, glisse le doigt pour lire les valeurs"
        style={[styles.bloc, { backgroundColor: p.surface }]}
      >
        {series.map((s, k) => {
          const moy = s.valeurs.reduce((a, b) => a + b, 0) / s.valeurs.length;
          const haut = Math.max(...s.valeurs);
          const bas = Math.min(...s.valeurs);
          const points = largeur > 0 ? echelle(s.inverse ? s.valeurs.map((v) => -v) : s.valeurs, largeur, HAUTEUR, MARGE) : [];
          return (
            <View key={s.cle} style={[styles.serie, k > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.entete}>
                <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{s.titre}</Text>
                <Text style={[styles.valeur, { color: p.texte }]}>{i == null ? `moy. ${s.texte(moy)}` : s.texte(s.valeurs[i])}</Text>
              </View>
              {largeur > 0 && haut > bas ? (
                <Svg width={largeur} height={HAUTEUR} pointerEvents="none">
                  <Path d={lisse(points)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              ) : (
                <View style={{ height: HAUTEUR }} />
              )}
            </View>
          );
        })}
        {x != null ? (
          // Un seul trait pointillé sur toutes les courbes
          <Svg pointerEvents="none" width={largeur} height="100%" style={StyleSheet.absoluteFill}>
            <Line x1={x} y1={0} x2={x} y2="100%" stroke={p.texteDoux} strokeWidth={1.5} strokeDasharray="3 4" />
          </Svg>
        ) : null}
      </View>
      <View style={styles.axe}>
        {distance != null && distance > 0
          ? [0, 1, 2, 3, 4].map((k) => (
              <Text key={k} style={[typo.petit, { color: p.texteMuet, fontSize: 11 }]}>
                {k === 0 ? '0 km' : formatKm((distance * k) / 4, distance >= 100 ? 0 : 1)}
              </Text>
            ))
          : null}
      </View>
      <Text style={[typo.petit, { color: p.texteMuet }]}>
        {i != null && distance != null ? `km ${formatKm((distance * i) / (n - 1), 1)}` : 'Pose le doigt sur les courbes pour lire chaque valeur au même endroit.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.base, overflow: 'hidden', paddingHorizontal: 0 },
  serie: { paddingTop: 8, paddingBottom: 2 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: espace.e3 },
  valeur: { fontFamily: police.texte600, fontSize: 14, fontVariant: ['tabular-nums'] },
  axe: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: MARGE },
});
