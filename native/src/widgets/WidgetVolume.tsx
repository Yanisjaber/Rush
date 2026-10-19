import { StyleSheet, Text, View } from 'react-native';
import { Anneau } from '@/components/Anneau';
import { Bloc } from '@/components/Bloc';
import { formatDuree } from '@/data/format';
import { repartition7Jours } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps passé sur chaque sport pendant les 7 derniers jours : un anneau et sa légende.
export function WidgetVolume({ contexte }: WidgetProps) {
  const p = usePalette();
  const rep = repartition7Jours(contexte.seances, new Date());
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;
  const resume = rep.segments.map((s) => `${nom(s.famille)} ${formatDuree(s.secondes)}`).join(', ');

  return (
    <Bloc titre="Volume, 7 derniers jours">
      {rep.totalSecondes ? (
        <>
          <View style={styles.centre}>
            <Anneau
              taille={170}
              etiquette={`Répartition du temps d'entraînement sur 7 jours, ${formatDuree(rep.totalSecondes)} au total : ${resume}`}
              segments={rep.segments.map((s) => ({ valeur: s.secondes, couleur: couleurSport(p, s.famille) }))}
            >
              <Text style={[styles.total, { color: p.texte }]}>{formatDuree(rep.totalSecondes)}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>cette semaine</Text>
            </Anneau>
          </View>
          {rep.segments.map((s) => (
            <View key={s.famille} accessible accessibilityLabel={`${nom(s.famille)}, ${formatDuree(s.secondes)}`} style={styles.ligne}>
              <View style={[styles.pastille, { backgroundColor: couleurSport(p, s.famille) }]} />
              <Text style={[typo.corps, styles.nom, { color: p.texte }]}>{nom(s.famille)}</Text>
              <Text style={[typo.corpsFort, { color: p.texte }]}>{formatDuree(s.secondes)}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Aucune séance sur les 7 derniers jours.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', marginBottom: 16 },
  total: { fontFamily: police.titre700, fontSize: 30, lineHeight: 32 },
  // 44 pt de haut : la ligne reste confortable même si elle n'est pas cliquable
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nom: { flex: 1 },
});
