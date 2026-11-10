import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as TexteSvg } from 'react-native-svg';
import { formatAllure, formatAllureDepuisKmh, formatKm } from '@/data/outils/format';
import { familleAffichage } from '@/data/sports/familles';
import type { Tour } from '@/data/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les tours en barres : une barre par tour, d'autant plus haute que le tour est rapide (course, natation : l'allure ; vélo : la vitesse).
// Le tour le plus rapide est dans la couleur pleine du sport, les autres en teinte. Les tours sans distance sont ignorés ; moins de deux tours : pas de graphique.
interface Props {
  tours: Tour[];
  sport: string;
  couleur: string;
}

const HAUT = 110;
const HAUT_LABEL = 16;
const BAS = 18;

export function GrapheTours({ tours, sport, couleur }: Props) {
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
  const n = points.length;
  const pas = largeur > 0 ? (largeur - 2 * espace.e3) / n : 0;
  const colonne = Math.min(36, pas * 0.72);
  const avecValeurs = n <= 10; // au-delà, les valeurs ne tiennent plus : seul le meilleur tour est écrit
  const pasNumero = n <= 12 ? 1 : n <= 30 ? 5 : 10;
  const iMeilleur = vitesses.indexOf(meilleur);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={[styles.carte, { backgroundColor: p.surface }]}>
      <Text style={[typo.micro, styles.titre, { color: p.texteDoux }]}>{`RYTHME PAR TOUR · ${unite.toUpperCase()}`}</Text>
      {largeur > 0 ? (
        <Svg width={largeur} height={HAUT + BAS} accessible accessibilityLabel={`Rythme de chaque tour. Le plus rapide : tour ${points[iMeilleur].numero}, ${texteRythme(meilleur)}.`}>
          {points.map((t, i) => {
            const h = Math.max(4, ((HAUT - HAUT_LABEL) * (t.kmh - base)) / (meilleur - base || 1));
            const x = espace.e3 + i * pas + (pas - colonne) / 2;
            const centre = x + colonne / 2;
            const best = i === iMeilleur;
            return (
              <View key={`${t.numero}-${i}`}>
                <Rect x={x} y={HAUT - h} width={colonne} height={h} rx={4} fill={best ? couleur : couleur + '77'} />
                {avecValeurs || best ? (
                  <TexteSvg x={centre} y={HAUT - h - 4} textAnchor="middle" fontSize={10} fontFamily={police.texte600} fill={p.texte}>
                    {texteRythme(t.kmh)}
                  </TexteSvg>
                ) : null}
                {(i + 1) % pasNumero === 0 || i === 0 ? (
                  <TexteSvg x={centre} y={HAUT + 13} textAnchor="middle" fontSize={10} fontFamily={police.texte400} fill={p.texteMuet}>
                    {t.numero}
                  </TexteSvg>
                ) : null}
              </View>
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
