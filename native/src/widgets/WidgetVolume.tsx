import { StyleSheet, Text, View } from 'react-native';
import { Anneau } from '@/components/Anneau';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { formatDuree } from '@/data/format';
import { repartition7Jours } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps passé sur chaque sport pendant les 7 derniers jours : un anneau et sa légende.
// tuile : tuile (le temps total + une barre découpée par sport).
export function WidgetVolume({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const rep = repartition7Jours(contexte.seances, new Date());
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;
  const resume = rep.segments.map((s) => `${nom(s.famille)} ${formatDuree(s.secondes)}`).join(', ');

  if (tuile) {
    return (
      <Tuile titre="Volume, 7 jours" valeur={rep.totalSecondes ? formatDuree(rep.totalSecondes) : '—'} note={rep.totalSecondes ? 'cette semaine' : 'Aucune séance'}>
        {rep.totalSecondes ? (
          <View accessible accessibilityRole="image" accessibilityLabel={`Répartition du temps sur 7 jours : ${resume}`} style={styles.repartition}>
            {rep.segments.map((s) => (
              <View key={s.famille} style={{ flex: s.secondes, backgroundColor: couleurSport(p, s.famille) }} />
            ))}
          </View>
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Volume, 7 derniers jours">
      {rep.totalSecondes ? (
        <>
          <View style={styles.corps}>
            <Anneau
              taille={130}
              etiquette={`Répartition du temps d'entraînement sur 7 jours, ${formatDuree(rep.totalSecondes)} au total : ${resume}`}
              segments={rep.segments.map((s) => ({ valeur: s.secondes, couleur: couleurSport(p, s.famille) }))}
            >
              <Text style={[styles.total, { color: p.texte }]}>{formatDuree(rep.totalSecondes)}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>cette semaine</Text>
            </Anneau>
            <View style={styles.legende}>
              {rep.segments.slice(0, 5).map((s) => (
                <View key={s.famille} accessible accessibilityLabel={`${nom(s.famille)}, ${formatDuree(s.secondes)}`} style={styles.ligne}>
                  <View style={[styles.pastille, { backgroundColor: couleurSport(p, s.famille) }]} />
                  <Text style={[typo.corps, styles.nom, { color: p.texte }]}>{nom(s.famille)}</Text>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{formatDuree(s.secondes)}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Aucune séance sur les 7 derniers jours.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  corps: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legende: { flex: 1, minWidth: 0 },
  total: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28 },
  // 44 pt de haut : la ligne reste confortable même si elle n'est pas cliquable
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nom: { flex: 1 },
  repartition: { flexDirection: 'row', height: 10, gap: 2, borderRadius: 3, overflow: 'hidden' },
});
