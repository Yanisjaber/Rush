import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { formatAllure, formatAllureDepuisKmh, formatKm } from '@/data/outils/format';
import { familleAffichage } from '@/data/sports/familles';
import type { Tour } from '@/data/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les tours en barres, comme sur Strava : chaque barre est d'autant plus LARGE que le tour dure longtemps et d'autant plus HAUTE qu'il est rapide
// (course, natation : l'allure ; vélo : la vitesse). Le relief de la sortie est dessiné derrière, en silhouette. Le tour le plus rapide est dans la couleur pleine du sport.
// Les tours sans distance sont ignorés ; moins de deux tours : pas de graphique.
interface Props {
  tours: Tour[];
  sport: string;
  couleur: string;
  /** L'altitude de la sortie (une valeur par tranche de distance égale), pour le relief en fond. */
  altitude?: number[] | null;
}

const HAUT = 120;
const HAUT_LABEL = 16;
const BAS = 18;
const ECART = 2; // l'espace entre deux barres

export function GrapheTours({ tours, sport, couleur, altitude }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const famille = familleAffichage(sport);
  const points = tours
    .map((t, i) => {
      const temps = t.moving_time > 0 ? t.moving_time : t.elapsed_time;
      const kmh = t.distance > 0 && temps > 0 ? t.distance / 1000 / (temps / 3600) : 0;
      return { numero: Number.isFinite(t.index) && t.index > 0 ? t.index : i + 1, kmh, distance: t.distance, temps };
    })
    .filter((t) => t.kmh > 0);
  if (points.length < 2) return null;

  const texteRythme = (kmh: number): string => (famille === 'velo' ? `${formatKm(kmh, 1)}` : famille === 'natation' ? formatAllureDepuisKmh(kmh, true) : formatAllure(3600 / kmh).replace('/km', ''));
  const unite = famille === 'velo' ? 'km/h' : famille === 'natation' ? 'allure /100 m' : 'allure /km';
  const vitesses = points.map((t) => t.kmh);
  const meilleur = Math.max(...vitesses);
  const base = Math.min(...vitesses) * 0.9; // l'axe ne part pas de zéro : sinon tous les tours se ressemblent
  const iMeilleur = vitesses.indexOf(meilleur);
  const tempsTotal = points.reduce((a, t) => a + t.temps, 0);
  const distanceTotale = points.reduce((a, t) => a + t.distance, 0);
  const zone = Math.max(0, largeur - 2 * espace.e3); // la largeur du dessin : les barres s'y partagent le temps total
  // Le début (en pixels) et la largeur de chaque barre : proportionnels à la durée du tour
  let cumul = 0;
  const barres = points.map((t) => {
    const x0 = espace.e3 + (cumul / tempsTotal) * zone;
    cumul += t.temps;
    return { ...t, x0, w: Math.max(2, (t.temps / tempsTotal) * zone - ECART) };
  });

  // Le relief en fond : l'altitude est donnée par distance, les barres sont placées par temps. Pour chaque pixel on cherche le tour, puis la distance parcourue à cet endroit du tour.
  const relief = (() => {
    if (!altitude || altitude.length < 2 || zone <= 0 || distanceTotale <= 0) return null;
    const bas = Math.min(...altitude);
    const haut = Math.max(...altitude);
    if (haut <= bas) return null;
    const hRelief = (HAUT - HAUT_LABEL) * 0.6;
    const debutsDistance: number[] = [];
    let d = 0;
    for (const t of points) {
      debutsDistance.push(d);
      d += t.distance;
    }
    const pts: string[] = [];
    const pasPx = 3;
    for (let px = 0; px <= zone; px += pasPx) {
      const tFrac = (px / zone) * tempsTotal;
      let k = 0;
      let t0 = 0;
      for (let j = 0; j < points.length; j++) {
        if (t0 + points[j].temps >= tFrac || j === points.length - 1) {
          k = j;
          break;
        }
        t0 += points[j].temps;
      }
      const f = Math.min(1, Math.max(0, (tFrac - t0) / points[k].temps));
      const fracDistance = (debutsDistance[k] + f * points[k].distance) / distanceTotale;
      const idx = fracDistance * (altitude.length - 1);
      const i0 = Math.min(altitude.length - 2, Math.floor(idx));
      const alt = altitude[i0] + (altitude[i0 + 1] - altitude[i0]) * (idx - i0);
      const y = HAUT - 4 - ((alt - bas) / (haut - bas)) * hRelief;
      pts.push(`${(espace.e3 + px).toFixed(1)} ${y.toFixed(1)}`);
    }
    return `M${espace.e3} ${HAUT} L${pts.join(' L')} L${espace.e3 + zone} ${HAUT} Z`;
  })();

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={[styles.carte, { backgroundColor: p.surface }]}>
      <Text style={[typo.micro, styles.titre, { color: p.texteDoux }]}>{`RYTHME PAR TOUR · ${unite.toUpperCase()}`}</Text>
      {largeur > 0 ? (
        <Svg width={largeur} height={HAUT + BAS} accessible accessibilityLabel={`Rythme de chaque tour, largeur proportionnelle au temps. Le plus rapide : tour ${points[iMeilleur].numero}, ${texteRythme(meilleur)}.`}>
          {relief ? <Path d={relief} fill={p.trait} opacity={0.9} /> : null}
          {barres.map((t, i) => {
            const h = Math.max(4, ((HAUT - HAUT_LABEL) * (t.kmh - base)) / (meilleur - base || 1));
            const centre = t.x0 + t.w / 2;
            const best = i === iMeilleur;
            return (
              <G key={`${t.numero}-${i}`}>
                <Rect x={t.x0} y={HAUT - h} width={t.w} height={h} rx={3} fill={best ? couleur : couleur + '99'} />
                {t.w >= 26 || best ? (
                  <TexteSvg x={centre} y={HAUT - h - 4} textAnchor="middle" fontSize={10} fontFamily={police.texte600} fill={p.texte}>
                    {texteRythme(t.kmh)}
                  </TexteSvg>
                ) : null}
                {t.w >= 12 ? (
                  <TexteSvg x={centre} y={HAUT + 13} textAnchor="middle" fontSize={10} fontFamily={police.texte400} fill={p.texteMuet}>
                    {t.numero}
                  </TexteSvg>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: HAUT + BAS }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.base, paddingVertical: espace.e3, gap: espace.e2 },
  titre: { letterSpacing: 1.2, paddingHorizontal: espace.e3 },
});
