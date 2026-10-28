import { StyleSheet, Text, View } from 'react-native';
import { IconeSport } from '@/components/IconeSport';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un objectif en barre de segments : 25 petits blocs, chacun vaut 4 %. Les blocs faits ont la couleur du sport,
// un trait marque le bloc où tu devrais en être aujourd'hui. À gauche, en gros, ce que mesure l'objectif avec le logo de son sport,
// et en petit le sport ; à droite le chiffre fait sur la cible.
interface Props {
  /** Ce que mesure l'objectif (« Distance annuelle »), en gros. */
  nom: string;
  /** Le sport de l'objectif (« Course à pied », « Autre », « Tous »), en petit. */
  detail: string;
  /** La famille de l'app (course, velo…) dont on dessine le logo ; absente pour un objectif tous sports (un point à la place). */
  famille?: string;
  couleur: string;
  /** Avancement de 0 à 100 (null : pas de valeur, aucun bloc plein). */
  pct: number | null;
  /** Où tu devrais en être, de 0 à 100 ; null = pas de repère (année passée, objectif manuel). */
  attendu: number | null;
  /** La valeur faite sans unité (« 781 ») et la cible avec son unité (« 1 500 km »). */
  fait: string;
  cible: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
  /** Une phrase sous la barre (« Fin d'année prévue : 1 340 km »), son ton donne la couleur ; absente = rien. */
  verdict?: { texte: string; ton: 'ok' | 'alerte' | 'neutre' } | null;
}

const NB_SEGMENTS = 25;

export function ObjectifSegments({ nom, detail, famille, couleur, pct, attendu, fait, cible, etiquette, verdict }: Props) {
  const p = usePalette();
  const pleins = pct == null ? 0 : Math.round((Math.min(100, Math.max(0, pct)) / 100) * NB_SEGMENTS);
  const reperage = attendu == null ? null : Math.min(NB_SEGMENTS, Math.max(1, Math.round((attendu / 100) * NB_SEGMENTS))); // numéro (de 1 à 25) du bloc marqué
  return (
    <View accessible accessibilityLabel={etiquette} style={styles.objectif}>
      <View style={styles.haut}>
        <View style={styles.nomBloc}>
          <View style={styles.ligneNom}>
            {famille ? <IconeSport sport={famille} taille={18} /> : <View style={[styles.pointSport, { backgroundColor: couleur }]} />}
            <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flexShrink: 1 }]}>
              {nom}
            </Text>
          </View>
          {detail ? (
            <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.fait, { color: p.texte }]}>
          {fait}
          <Text style={[typo.petit, { color: p.texteDoux, fontFamily: police.texte400 }]}> / {cible}</Text>
        </Text>
      </View>
      <View style={styles.segments}>
        {Array.from({ length: NB_SEGMENTS }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < pleins ? couleur : p.surface2 }]}>
            {reperage === i + 1 ? <View style={[styles.repere, { backgroundColor: p.texte }]} /> : null}
          </View>
        ))}
      </View>
      {verdict?.texte ? (
        <Text style={[typo.petit, { color: verdict.ton === 'ok' ? p.ok : verdict.ton === 'alerte' ? p.alerte : p.texteDoux }]}>{verdict.texte}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  objectif: { gap: 10 },
  haut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nomBloc: { flexShrink: 1, gap: 2 },
  ligneNom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointSport: { width: 10, height: 10, borderRadius: 5 },
  fait: { fontFamily: police.titre800, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 22, borderRadius: 3 },
  repere: { position: 'absolute', right: -2.5, top: -4, bottom: -4, width: 2 },
});
