import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { PointEcran } from '@/components/profil/ModeleAthleteRealiste';
import type { NoteDomaine } from '@/data/profil/evaluation';
import { DOMAINES, type DomaineCle } from '@/data/profil/reperes';
import type { Palette } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';

// La planche anatomique posée sur le mannequin 3D : une règle de hauteur à gauche, un point numéroté par domaine sur le corps,
// relié par un trait pointillé à son étiquette (nom court + note) dans la colonne de droite. Les points suivent le mannequin ;
// de dos, ils disparaissent et les étiquettes restent à leur place.

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
  composition: 'Composition',
  recuperation: 'Récup.',
};

const LARGEUR_ETIQUETTE = 96;
const HAUTEUR_ETIQUETTE = 40;
const PASTILLE = 22;
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

  const etiquettes = useMemo(() => {
    const xEtiquette = largeur - LARGEUR_ETIQUETTE - 12;
    const liste = domaines.map((d, i) => {
      const point = points[d.domaine.cle];
      const suit = !!point?.visible;
      // Rangement de repli (de dos, ou avant la première image) : dans l'ordre de la liste, de haut en bas
      const brut = suit ? point.y * hauteur : hauteur * (0.12 + i * 0.1);
      return { d, numero: i + 1, point, suit, brut, y: brut - HAUTEUR_ETIQUETTE / 2, x: xEtiquette };
    });
    // Deux étiquettes ne se chevauchent jamais : de haut en bas, chacune est poussée sous la précédente, puis on remonte celles qui débordent
    const triees = [...liste].sort((a, b) => a.brut - b.brut);
    let limite = 4;
    for (const e of triees) {
      e.y = Math.max(e.y, limite);
      limite = e.y + HAUTEUR_ETIQUETTE + 4;
    }
    let plafond = hauteur - HAUTEUR_ETIQUETTE - 4;
    for (const e of [...triees].reverse()) {
      e.y = Math.min(e.y, plafond);
      plafond = e.y - HAUTEUR_ETIQUETTE - 4;
    }
    return liste;
  }, [domaines, points, largeur, hauteur]);

  if (largeur <= 0 || hauteur <= 0) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Svg width={largeur} height={hauteur} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {regle.length ? <Line x1={GAUCHE_REGLE} x2={GAUCHE_REGLE} y1={regle[6].y} y2={regle[0].y} stroke={p.traitFort} strokeWidth={1} /> : null}
        {regle.map((t) => (
          <Line key={t.texte} x1={GAUCHE_REGLE - 5} x2={GAUCHE_REGLE + 4} y1={t.y} y2={t.y} stroke={p.texteMuet} strokeWidth={1} />
        ))}
        {etiquettes.map((e) =>
          e.suit ? (
            <Line
              key={e.d.domaine.cle}
              x1={e.point.x * largeur + PASTILLE / 2}
              y1={e.point.y * hauteur}
              x2={e.x - 4}
              y2={e.y + HAUTEUR_ETIQUETTE / 2}
              stroke={active === e.d.domaine.cle ? accent : p.texteDoux}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null,
        )}
      </Svg>

      {regle.map((t) => (
        <Text key={t.texte} pointerEvents="none" style={[styles.graduation, { top: t.y - 8, color: p.texteMuet }]} accessibilityElementsHidden importantForAccessibility="no">
          {t.texte}
        </Text>
      ))}

      {etiquettes.map((e) =>
        e.suit ? (
          <Pressable
            key={`p-${e.d.domaine.cle}`}
            onPress={() => onDomaine(e.d.domaine.cle)}
            hitSlop={11}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.pastille, { left: e.point.x * largeur - PASTILLE / 2, top: e.point.y * hauteur - PASTILLE / 2, backgroundColor: active === e.d.domaine.cle ? p.texte : accent }]}
          >
            <Text style={[styles.numero, { color: active === e.d.domaine.cle ? p.fond : p.encreSurCouleur }]}>{e.numero}</Text>
          </Pressable>
        ) : null,
      )}

      {etiquettes.map((e) => (
        <Pressable
          key={`e-${e.d.domaine.cle}`}
          onPress={() => onDomaine(e.d.domaine.cle)}
          accessibilityRole="button"
          accessibilityState={{ selected: active === e.d.domaine.cle }}
          accessibilityLabel={`${e.numero}. ${e.d.domaine.nom} : ${e.d.note === null ? 'pas encore de mesure' : `${e.d.note} sur 100`}`}
          style={[styles.etiquette, { left: e.x, top: e.y }]}
        >
          <Text numberOfLines={1} style={[typo.micro, { color: active === e.d.domaine.cle ? p.texte : p.texteDoux }]}>
            {e.numero} · {NOM_COURT[e.d.domaine.cle]}
          </Text>
          <Text style={[styles.note, { color: e.d.note === null ? p.texteMuet : p.texte }]}>{e.d.note === null ? '—' : e.d.note}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  graduation: { position: 'absolute', left: 4, width: GAUCHE_REGLE - 10, textAlign: 'right', fontFamily: police.texte500, fontSize: 12, fontVariant: ['tabular-nums'] },
  pastille: { position: 'absolute', width: PASTILLE, height: PASTILLE, borderRadius: PASTILLE / 2, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: police.titre700, fontSize: 12, lineHeight: 14 },
  etiquette: { position: 'absolute', width: LARGEUR_ETIQUETTE, minHeight: 44, height: HAUTEUR_ETIQUETTE + 4, justifyContent: 'center' },
  note: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
});
