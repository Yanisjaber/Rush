import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { familleAffichage } from '@/data/familles';
import { formatDuree } from '@/data/format';
import { semaineCourante } from '@/data/synthese';
import type { Prevue, Seance } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La semaine en cours, du lundi au dimanche. Sur le web, sept colonnes côte à côte ; sur téléphone,
// une ligne par jour (sept colonnes de 46 pt seraient illisibles). Mêmes calculs, autre mise en page.
// Séance faite : aplat de la couleur du sport. Séance prévue : simple contour.
interface Props {
  seances: Seance[];
  planifiees: Prevue[];
  aujourdhui?: Date;
}

const nom = (sport: string) => SPORTS[familleAffichage(sport) as CleSport]?.court ?? SPORTS.autre.court;

export function WidgetSemaine({ seances, planifiees, aujourdhui = new Date() }: Props) {
  const p = usePalette();
  const jours = semaineCourante(seances, aujourdhui, planifiees);
  const nbSeances = jours.reduce((n, j) => n + j.seances.length, 0);

  return (
    <Bloc titre="Cette semaine">
      <View accessible accessibilityLabel={`${nbSeances} séance${nbSeances > 1 ? 's' : ''} cette semaine`} accessibilityElementsHidden={false}>
        {jours.map((j, i) => {
          const libelle = [
            `${j.jour} ${j.num}`,
            ...j.seances.map((s) => `${nom(s.sport)} ${formatDuree(s.moving_time)}`),
            ...j.prevues.map((x) => `prévu : ${nom(x.sport)}`),
          ].join(', ');
          return (
            <View
              key={j.iso}
              accessible
              accessibilityLabel={libelle}
              style={[styles.jour, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
            >
              <View style={[styles.date, j.aujourdhui && { backgroundColor: p.texte }]}>
                <Text style={[typo.micro, { color: j.aujourdhui ? p.fond : p.texteDoux }]}>{j.jour}</Text>
                <Text style={[styles.num, { color: j.aujourdhui ? p.fond : p.texte }]}>{j.num}</Text>
              </View>
              <View style={styles.contenu}>
                {j.seances.map((s) => (
                  <View key={s.id} style={[styles.puce, { backgroundColor: couleurSport(p, familleAffichage(s.sport)) }]}>
                    <Text style={[typo.petit, styles.puceTexte, { color: p.encreSurCouleur }]}>
                      {nom(s.sport)} · {formatDuree(s.moving_time)}
                    </Text>
                  </View>
                ))}
                {j.prevues.map((x) => (
                  <View key={x.id} style={[styles.puce, styles.prevue, { borderColor: couleurSport(p, familleAffichage(x.sport)) }]}>
                    <Text style={[typo.petit, styles.puceTexte, { color: p.texte }]}>
                      {nom(x.sport)}
                      {x.duration ? ` · ${formatDuree(x.duration * 60)}` : ''}
                    </Text>
                  </View>
                ))}
                {!j.seances.length && !j.prevues.length && !j.futur ? (
                  <Text style={[typo.petit, { color: p.texteMuet }]}>Repos</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  jour: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  // Le bloc de date : fixe, pour que les pastilles s'alignent d'un jour à l'autre
  date: { width: 52, alignItems: 'center', borderRadius: rayon.base, paddingVertical: 4 },
  num: { fontFamily: police.titre700, fontSize: 20, lineHeight: 22 },
  contenu: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  puce: { borderRadius: rayon.base, paddingHorizontal: 10, paddingVertical: 4 },
  puceTexte: { fontFamily: police.texte600 },
  prevue: { borderWidth: 1.5 },
});
