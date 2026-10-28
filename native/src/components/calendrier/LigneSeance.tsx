import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une ligne de liste de séances : une barre de la couleur du sport, un nom, un détail,
// et à droite un élément libre (les points de charge, un badge…).
interface Props {
  /** Clé de sport (course, velo…) : couleur de la barre. */
  sport: string;
  nom: string;
  detail: string;
  /** Étiquette à côté du nom (ex. « Record »). */
  badge?: string;
  droite?: ReactNode;
  /** Pas de séparateur au-dessus (première ligne d'une liste). */
  premiere?: boolean;
}

export function LigneSeance({ sport, nom, detail, badge, droite, premiere }: Props) {
  const p = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={[nom, badge, detail].filter(Boolean).join(', ')}
      style={[styles.ligne, !premiere && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.barre, { backgroundColor: couleurSport(p, sport) }]} />
      <View style={styles.infos}>
        <View style={styles.titreLigne}>
          <Text numberOfLines={1} style={[typo.corpsFort, styles.nom, { color: p.texte }]}>
            {nom}
          </Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: p.sportMuscu }]}>
              <Text style={[typo.micro, { color: p.encreSurCouleur }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
          {detail}
        </Text>
      </View>
      {droite}
    </View>
  );
}

/** Les points de charge, à droite d'une ligne : un grand chiffre et « pts » dessous. */
export function Points({ valeur }: { valeur: number }) {
  const p = usePalette();
  return (
    <View style={styles.points}>
      <Text style={[styles.valeur, { color: p.texte }]}>{valeur}</Text>
      <Text style={[typo.petit, { color: p.texteDoux }]}>pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 52 pt de haut au minimum : au-dessus des 44 pt de cible tactile
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  barre: { width: 6, height: 36, borderRadius: 3 },
  infos: { flex: 1, minWidth: 0 },
  titreLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  nom: { flexShrink: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  points: { alignItems: 'flex-end' },
  valeur: { fontFamily: police.titre700, fontSize: 20, lineHeight: 22 },
});
