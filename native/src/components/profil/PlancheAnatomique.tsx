import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { PointEcran } from '@/components/profil/ModeleAthleteRealiste';
import type { NoteDomaine } from '@/data/profil/evaluation';
import { DOMAINES, type DomaineCle } from '@/data/profil/reperes';
import type { Palette } from '@/theme/couleurs';
import { police } from '@/theme/typo';

// La planche anatomique posée sur le mannequin 3D : une règle de hauteur à gauche et un point numéroté par domaine sur le corps.
// Toucher un point ouvre le détail du domaine. Les points suivent le mannequin ; de dos, ils disparaissent.

/** Les points du repère du modèle qui servent à tracer la règle (voir « fixe: » dans ModeleAthleteRealiste). */
export const ANCRES_REGLE = { 'fixe:sol': { x: 0, y: 0 }, 'fixe:sommet': { x: 0, y: 1.8 } };
/** Les points des domaines sur le corps, par clé de domaine. */
export const ANCRES_DOMAINES: Record<string, { x: number; y: number }> = Object.fromEntries(DOMAINES.map((d) => [d.cle, d.point]));

export const NOM_COURT: Record<DomaineCle, string> = {
  cardio: 'Cardio',
  endurance: 'Endurance',
  puissance: 'Puissance',
  explosivite: 'Explosivité',
  force: 'Force',
  endurance_musc: 'Endu. musc.',
  composition: 'Compo.',
  recuperation: 'Récup.',
};

const PASTILLE = 26;
const GAUCHE_REGLE = 44;

interface Props {
  palette: Palette;
  accent: string;
  largeur: number;
  hauteur: number;
  points: Record<string, PointEcran>;
  domaines: NoteDomaine[];
  active: DomaineCle | null;
  onDomaine: (cle: DomaineCle) => void;
  /** Taille de la personne (cm) : la règle va de 0 à cette hauteur ; inconnue, de 0 à 1,80 m. */
  tailleCm: number;
}

const virgule = (n: number, d: number) => n.toFixed(d).replace('.', ',');

export function PlancheAnatomique({ palette: p, accent, largeur, hauteur, points, domaines, active, onDomaine, tailleCm }: Props) {
  const regle = useMemo(() => {
    const sol = points['fixe:sol'];
    const sommet = points['fixe:sommet'];
    if (!sol || !sommet) return [];
    const metres = tailleCm > 0 ? tailleCm / 100 : 1.8;
    return Array.from({ length: 7 }, (_, i) => {
      const k = i / 6;
      return { y: (sol.y + (sommet.y - sol.y) * k) * hauteur, texte: i === 0 ? '0 m' : virgule(metres * k, 2) };
    });
  }, [points, hauteur, tailleCm]);

  if (largeur <= 0 || hauteur <= 0) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Svg width={largeur} height={hauteur} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {regle.length ? <Line x1={GAUCHE_REGLE} x2={GAUCHE_REGLE} y1={regle[6].y} y2={regle[0].y} stroke={p.traitFort} strokeWidth={1} /> : null}
        {regle.map((t) => (
          <Line key={t.texte} x1={GAUCHE_REGLE - 5} x2={GAUCHE_REGLE + 4} y1={t.y} y2={t.y} stroke={p.texteMuet} strokeWidth={1} />
        ))}
      </Svg>

      {regle.map((t) => (
        <Text key={t.texte} pointerEvents="none" style={[styles.graduation, { top: t.y - 8, color: p.texteMuet }]} accessibilityElementsHidden importantForAccessibility="no">
          {t.texte}
        </Text>
      ))}

      {domaines.map((d, i) => {
        const point = points[d.domaine.cle];
        if (!point?.visible) return null;
        const choisi = active === d.domaine.cle;
        return (
          <Pressable
            key={d.domaine.cle}
            onPress={() => onDomaine(d.domaine.cle)}
            hitSlop={9}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. ${d.domaine.nom} : ${d.note === null ? 'pas encore de mesure' : `${d.note} sur 100`}`}
            style={({ pressed }) => [
              styles.pastille,
              { left: point.x * largeur - PASTILLE / 2, top: point.y * hauteur - PASTILLE / 2, backgroundColor: choisi ? p.texte : accent, borderColor: p.fond, transform: [{ scale: pressed ? 1.15 : 1 }] },
            ]}
          >
            <Text style={[styles.numero, { color: choisi ? p.fond : p.encreSurCouleur }]}>{i + 1}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  graduation: { position: 'absolute', left: 4, width: GAUCHE_REGLE - 10, textAlign: 'right', fontFamily: police.texte500, fontSize: 12, fontVariant: ['tabular-nums'] },
  pastille: { position: 'absolute', width: PASTILLE, height: PASTILLE, borderRadius: PASTILLE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: police.titre700, fontSize: 13, lineHeight: 15 },
});
