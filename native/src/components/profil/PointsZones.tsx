import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { PointEcran } from '@/components/profil/ModeleAthleteRealiste';
import type { InfoZone, NiveauNote, ZoneProfil } from '@/data/profil/ecran-profil';
import { rayon, type Palette } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';

// Les 4 zones du mannequin : un point sur le corps relié à une pastille (note colorée + valeur), comme une planche d'anatomie.
// Les points suivent le mannequin quand il tourne ; ils disparaissent quand il est de dos, les pastilles restent.

/** De quel côté de l'écran chaque pastille se pose, et où elle se range tant que son point n'est pas visible (part de la hauteur). */
const COTE: Record<ZoneProfil, { cote: 'gauche' | 'droite'; reposY: number }> = {
  tete: { cote: 'droite', reposY: 0.22 },
  coeur: { cote: 'droite', reposY: 0.34 },
  torse: { cote: 'gauche', reposY: 0.4 },
  jambes: { cote: 'gauche', reposY: 0.6 },
};

const LARGEUR_PASTILLE = 146;
const HAUTEUR_PASTILLE = 56;

export function couleurNote(niveau: NiveauNote, p: Palette): string {
  if (niveau === 'bon') return p.ok;
  if (niveau === 'moyen') return p.alerte;
  if (niveau === 'bas') return p.danger;
  return p.texteMuet;
}

interface Props {
  palette: Palette;
  largeur: number;
  hauteur: number;
  zones: InfoZone[];
  points: Record<string, PointEcran>;
  active: ZoneProfil | null;
  onZone: (cle: ZoneProfil) => void;
}

export function PointsZones({ palette: p, largeur, hauteur, zones, points, active, onZone }: Props) {
  const rendu = useMemo(() => {
    const liste = zones.map((zone) => {
      const { cote, reposY } = COTE[zone.cle];
      const point = points[zone.cle];
      const x = cote === 'gauche' ? 12 : largeur - LARGEUR_PASTILLE - 12;
      const suit = !!point?.visible;
      const centreY = suit ? Math.min(hauteur * 0.9, Math.max(hauteur * 0.2, point.y * hauteur)) : hauteur * reposY;
      const brut = suit ? point.y * hauteur : hauteur * reposY; // l'ordre suit la vraie hauteur du point : les traits ne se croisent pas
      return { zone, cote, x, y: centreY - HAUTEUR_PASTILLE / 2, brut, suit, point, bordX: cote === 'gauche' ? x + LARGEUR_PASTILLE : x };
    });
    // Deux pastilles du même côté ne se chevauchent jamais : de haut en bas, chacune est poussée sous la précédente.
    for (const cote of ['gauche', 'droite'] as const) {
      let limite = -Infinity;
      for (const item of liste.filter((l) => l.cote === cote).sort((a, b) => a.brut - b.brut)) {
        item.y = Math.max(item.y, limite);
        limite = item.y + HAUTEUR_PASTILLE + 8;
      }
    }
    return liste;
  }, [zones, points, largeur, hauteur]);

  if (!(largeur > 0 && hauteur > 0)) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Svg width={largeur} height={hauteur} pointerEvents="none" style={StyleSheet.absoluteFill}>
        {rendu.map(({ zone, suit, point, bordX, y }) => {
          if (!suit || !point) return null;
          const couleur = couleurNote(zone.niveau, p);
          const px = point.x * largeur;
          const py = point.y * hauteur;
          const choisie = active === zone.cle;
          return (
            <View key={zone.cle}>
              <Line x1={bordX} y1={y + HAUTEUR_PASTILLE / 2} x2={px} y2={py} stroke={couleur} strokeWidth={choisie ? 2 : 1.2} strokeOpacity={choisie ? 1 : 0.7} />
              <Circle cx={px} cy={py} r={choisie ? 9 : 6} fill={couleur} fillOpacity={0.28} />
              <Circle cx={px} cy={py} r={choisie ? 4.5 : 3.5} fill={couleur} />
            </View>
          );
        })}
      </Svg>
      {rendu.map(({ zone, x, y }) => {
        const couleur = couleurNote(zone.niveau, p);
        const choisie = active === zone.cle;
        return (
          <Pressable
            key={zone.cle}
            onPress={() => onZone(zone.cle)}
            accessibilityRole="button"
            accessibilityState={{ selected: choisie }}
            accessibilityLabel={`${zone.label}, ${zone.note === null ? 'pas de note' : `note ${zone.note} sur 100`}, ${zone.valeur}`}
            style={[styles.pastille, { left: x, top: y, backgroundColor: p.surface, borderColor: choisie ? couleur : p.trait, borderWidth: choisie ? 2 : 1 }]}
          >
            <View style={styles.haut}>
              <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux, flexShrink: 1 }]}>{zone.label}</Text>
              <Text style={[styles.note, { color: couleur }]}>{zone.note === null ? '—' : zone.note}</Text>
            </View>
            <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet, fontSize: 12, lineHeight: 15 }]}>{zone.valeur}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pastille: { position: 'absolute', width: LARGEUR_PASTILLE, minHeight: HAUTEUR_PASTILLE, borderRadius: rayon.l, paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'center', gap: 2 },
  haut: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  note: { fontFamily: police.titre700, fontSize: 20, lineHeight: 22, fontVariant: ['tabular-nums'] },
});
