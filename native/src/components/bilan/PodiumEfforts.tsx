import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { Coupe } from '@/components/ui/Coupe';
import type { EntreeCourbe } from '@/data/bilan/records';
import { texteRecordSimple } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le podium d'une durée de la courbe : jusqu'à 30 séances, une coupe pour les trois premières, le nom sur une seule ligne et, pour chaque séance, l'écart avec la meilleure.
// Une zone de hauteur fixe qui défile (cinq lignes visibles) : tout le classement sans allonger la page. On touche une ligne pour ouvrir la séance.
interface Props {
  titre: string;
  entrees: EntreeCourbe[];
  unite: string;
  /** Ce qu'on écrit sous la valeur de la première (« 3,8 W/kg ») ; rien sinon. */
  sousPremiere: string | null;
  onOuvrir: (id: string) => void;
}

/** La hauteur d'une ligne, et le nombre de lignes que la zone qui défile montre d'un coup. */
const HAUTEUR_LIGNE = 62;
const LIGNES_VISIBLES = 5;

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

export function PodiumEfforts({ titre, entrees, unite, sousPremiere, onOuvrir }: Props) {
  const p = usePalette();
  const meilleure = entrees[0]?.valeur ?? 0;
  return (
    <Bloc titre={titre}>
      <Text style={[typo.petit, styles.compte, { color: p.texteMuet }]}>
        {entrees.length} {entrees.length > 1 ? 'séances' : 'séance'}
      </Text>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.zone} contentContainerStyle={styles.contenu} accessibilityLabel={`${titre}, ${entrees.length} séances`}>
        {entrees.map((e, i) => {
          const sous = i === 0 ? sousPremiere : `−${texteRecordSimple(meilleure - e.valeur, unite)}`;
          const etiquette = `${i + 1}, ${e.nom}, ${dateAnnee(e.iso)}, ${texteRecordSimple(e.valeur, unite)}${i > 0 ? `, ${sous} sur la première` : ''}`;
          return (
            <Pressable key={`${e.id}-${i}`} onPress={() => onOuvrir(e.id)} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} style={styles.ligne}>
              <View style={styles.rang}>
                {i < 3 ? <Coupe rang={(i + 1) as 1 | 2 | 3} /> : <Text style={[styles.numero, { color: p.texteMuet }]}>{i + 1}</Text>}
              </View>
              <View style={styles.centre}>
                <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                  {e.nom}
                </Text>
                <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                  {dateAnnee(e.iso)}
                </Text>
              </View>
              <View style={styles.valeur}>
                <Text style={[styles.nombre, { color: p.texte }]}>{texteRecordSimple(e.valeur, unite)}</Text>
                {sous ? <Text style={[typo.petit, { color: p.texteMuet }]}>{sous}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  compte: { marginBottom: 4 },
  // La zone déborde de 10 pt dans la marge de la carte : la barre de défilement s'y dessine, pas sur les valeurs
  zone: { height: HAUTEUR_LIGNE * LIGNES_VISIBLES, marginRight: -10 },
  contenu: { paddingRight: 14 },
  ligne: { height: HAUTEUR_LIGNE, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rang: { width: 30, alignItems: 'center' },
  numero: { fontFamily: police.titre800, fontSize: 16 },
  centre: { flex: 1, minWidth: 0 },
  valeur: { alignItems: 'flex-end' },
  nombre: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
