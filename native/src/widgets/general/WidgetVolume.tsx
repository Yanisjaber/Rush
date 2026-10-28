import { StyleSheet, Text, View } from 'react-native';
import { Anneau } from '@/components/Anneau';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { familleAffichage } from '@/data/sports/familles';
import { dateIsoLocale, formatDuree } from '@/data/outils/format';
import { repartition7Jours } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps passé sur chaque sport pendant les 7 derniers jours : un anneau et sa légende.
export function WidgetVolume({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const rep = repartition7Jours(contexte.seances, new Date());
  const nom = (f: string) => SPORTS[f as CleSport]?.court ?? SPORTS.autre.court;
  const resume = rep.segments.map((s) => `${nom(s.famille)} ${formatDuree(s.secondes)}`).join(', ');

  // XS : le total ; S : + une barre découpée par sport ; M : + la liste des sports et leur temps ; L : + l'anneau et les 7 jours empilés par sport
  if (taille !== 'l') {
    return (
      <Tuile titre="Volume, 7 jours" valeur={rep.totalSecondes ? formatDuree(rep.totalSecondes) : '—'} note={rep.totalSecondes ? 'cette semaine' : 'Aucune séance'} large>
        {!rep.totalSecondes ? null : taille === 's' ? (
          <View accessible accessibilityRole="image" accessibilityLabel={`Répartition du temps sur 7 jours : ${resume}`} style={styles.repartition}>
            {rep.segments.map((s) => (
              <View key={s.famille} style={{ flex: s.secondes, backgroundColor: couleurSport(p, s.famille) }} />
            ))}
          </View>
        ) : taille === 'm' ? (
          <ListeCompacte lignes={rep.segments.slice(0, 4).map((s) => ({ cle: s.famille, nom: nom(s.famille), valeur: formatDuree(s.secondes), point: couleurSport(p, s.famille) }))} etiquette={`Temps par sport sur 7 jours : ${resume}`} />
        ) : null}
      </Tuile>
    );
  }

  // Les 7 derniers jours, jour par jour : minutes par sport (le dernier jour est aujourd'hui)
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const isos = jours.map((d) => dateIsoLocale(d));
  const series = rep.segments.map((s) => ({
    nom: s.famille,
    couleur: couleurSport(p, s.famille),
    valeurs: isos.map((iso) =>
      contexte.seances.filter((x) => String(x.start_date_local).slice(0, 10) === iso && familleAffichage(x.sport) === s.famille).reduce((t, x) => t + (x.moving_time || 0) / 60, 0),
    ),
  }));

  return (
    <CadreWidget titre="Volume, 7 derniers jours">
      {rep.totalSecondes ? (
        <>
          <View style={styles.corps}>
            <Anneau
              taille={118}
              etiquette={`Répartition du temps d'entraînement sur 7 jours, ${formatDuree(rep.totalSecondes)} au total : ${resume}`}
              segments={rep.segments.map((s) => ({ valeur: s.secondes, couleur: couleurSport(p, s.famille) }))}
            >
              <Text style={[styles.total, { color: p.texte }]}>{formatDuree(rep.totalSecondes)}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>7 jours</Text>
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
          <View style={styles.jours}>
            <BarresEmpilees series={series} etiquettes={[]} hauteur={76} etiquette="Minutes par jour et par sport sur les 7 derniers jours" />
            <View style={styles.axe}>
              {jours.map((d, i) => (
                <Text key={i} style={[typo.petit, styles.jour, { color: i === 6 ? p.texte : p.texteDoux }]}>
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()]}
                </Text>
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
  jours: { marginTop: 14 },
  axe: { flexDirection: 'row', gap: 10, marginTop: 6 },
  jour: { flex: 1, textAlign: 'center' },
  legende: { flex: 1, minWidth: 0 },
  total: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28 },
  // 44 pt de haut : la ligne reste confortable même si elle n'est pas cliquable
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nom: { flex: 1 },
  repartition: { flexDirection: 'row', height: 10, gap: 2, borderRadius: 3, overflow: 'hidden' },
});
