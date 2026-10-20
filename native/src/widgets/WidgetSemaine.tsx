import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { familleAffichage } from '@/data/familles';
import { formatDuree } from '@/data/format';
import { semaineCourante } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La semaine en cours, du lundi au dimanche. Sur le web, sept colonnes côte à côte ; sur téléphone,
// une ligne par jour (sept colonnes de 46 pt seraient illisibles). Mêmes calculs, autre mise en page.
// Séance faite : aplat de la couleur du sport. Séance prévue : simple contour.
const nom = (sport: string) => SPORTS[familleAffichage(sport) as CleSport]?.court ?? SPORTS.autre.court;

// tuile : le nombre de séances de la semaine + une barre par jour (lundi → dimanche).
export function WidgetSemaine({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const { seances, planifiees } = contexte;
  const aujourdhui = new Date();
  const jours = semaineCourante(seances, aujourdhui, planifiees);
  const nbSeances = jours.reduce((n, j) => n + j.seances.length, 0);

  if (tuile) {
    const parJour = jours.map((j) => j.seances.length);
    const prevues = jours.reduce((n, j) => n + j.prevues.length, 0);
    return (
      <Tuile
        titre="Cette semaine"
        valeur={String(nbSeances)}
        unite={nbSeances > 1 ? 'séances' : 'séance'}
        note={prevues ? `${prevues} prévue${prevues > 1 ? 's' : ''} à venir` : nbSeances > 1 ? 'faites' : 'faite'}
      >
        <MiniBarres valeurs={parJour} max={Math.max(2, ...parJour)} couleur={p.sportNeutre} etiquette="Séances par jour cette semaine, du lundi au dimanche" />
      </Tuile>
    );
  }

  // Sept colonnes (lundi → dimanche) : le jour, puis un carré par séance (plein : faite, contour : prévue)
  return (
    <Bloc titre="Cette semaine">
      <View accessible accessibilityLabel={`${nbSeances} séance${nbSeances > 1 ? 's' : ''} cette semaine`} style={styles.semaine}>
        {jours.map((j) => {
          const libelle = [
            `${j.jour} ${j.num}`,
            ...j.seances.map((s) => `${nom(s.sport)} ${formatDuree(s.moving_time)}`),
            ...j.prevues.map((x) => `prévu : ${nom(x.sport)}`),
          ].join(', ');
          return (
            <View key={j.iso} accessible accessibilityLabel={libelle} style={styles.colonne}>
              <View style={[styles.date, j.aujourdhui && { backgroundColor: p.texte }]}>
                <Text style={[typo.micro, { color: j.aujourdhui ? p.fond : p.texteDoux }]}>{j.jour}</Text>
                <Text style={[styles.num, { color: j.aujourdhui ? p.fond : p.texte }]}>{j.num}</Text>
              </View>
              {j.seances.map((s) => (
                <View key={s.id} style={[styles.carre, { backgroundColor: couleurSport(p, familleAffichage(s.sport)) }]} />
              ))}
              {j.prevues.map((x) => (
                <View key={x.id} style={[styles.carre, styles.prevue, { borderColor: couleurSport(p, familleAffichage(x.sport)) }]} />
              ))}
            </View>
          );
        })}
      </View>
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>
        {nbSeances} séance{nbSeances > 1 ? 's' : ''} · {formatDuree(jours.reduce((t, j) => t + j.seances.reduce((n, s) => n + s.moving_time, 0), 0))} cette semaine. Plein : fait, contour : prévu.
      </Text>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  semaine: { flexDirection: 'row', gap: 4 },
  colonne: { flex: 1, alignItems: 'center', gap: 6 },
  // Le bloc de date : le jour en dessous de la lettre, aujourd'hui en inversé
  date: { alignSelf: 'stretch', alignItems: 'center', borderRadius: rayon.base, paddingVertical: 4 },
  num: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22 },
  carre: { width: 20, height: 20, borderRadius: 6 },
  prevue: { backgroundColor: 'transparent', borderWidth: 2 },
});
