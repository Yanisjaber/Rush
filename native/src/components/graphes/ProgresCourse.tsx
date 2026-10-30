import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CascadeCourse } from '@/components/graphes/CascadeCourse';
import { FourchetteProgres } from '@/components/graphes/FourchetteProgres';
import { NuageCourse } from '@/components/graphes/NuageCourse';
import { Dossard } from '@/components/ui/Dossard';
import { IconeSport } from '@/components/ui/IconeSport';
import { PERIODES_PROGRESSION, type PeriodeProgression, type Progression } from '@/data/bilan/progression';
import { MOT, formatPct } from '@/data/bilan/progression-texte';
import { formatAllure, formatNum } from '@/data/outils/format';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Progrès de la course : la même page que celle du vélo (le verdict, puis la preuve). Le dossard donne le verdict, puis on montre comment l'algorithme y arrive :
// la fourchette, le nuage de courses avec les deux droites, la cascade de l'écart brut à l'écart à cardio égal, et les courses retenues.
// Le détail du calcul vient de `progression.detailCourse` (voir data/bilan/progression-course.ts).
const SORTIES_AFFICHEES = 5;

/** « 28 oct. » : la date sans le jour de la semaine, pour que la ligne tienne sur un petit écran. */
const dateJourMois = (iso: string): string => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function ProgresCourse({ progression, jours }: { progression: Progression; jours: PeriodeProgression }) {
  const p = usePalette();
  const e = progression.detailCourse;
  if (!e || !progression.intervalle) return null;
  const periode = PERIODES_PROGRESSION.find((x) => x.jours === jours)!;
  const couleur = couleurSport(p, 'course');
  const couleurVerdict = progression.statut === 'hausse' ? p.ok : progression.statut === 'baisse' ? p.alerte : p.texteDoux;
  const recentes = [...e.sorties].reverse().slice(0, SORTIES_AFFICHEES);
  const autres = e.sorties.length - recentes.length;

  return (
    <View style={styles.page}>
      <View style={styles.tete}>
        <IconeSport sport="course" taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>Course à pied</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{progression.indicateur}</Text>
        </View>
      </View>

      <Dossard
        sport="course"
        etiquette={`${periode.court} vs ${periode.court} d'avant`}
        valeur={formatPct(progression.variationPct!)}
        detail={`${MOT[progression.statut]}\nentre ${formatPct(progression.intervalle.bas)} et ${formatPct(progression.intervalle.haut)}`}
        chiffreMax={64}
      />

      <Bloc titre="Fourchette">
        <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>Où se trouve le vrai écart, une fois le bruit des courses pris en compte. Positif : tu cours plus vite.</Text>
        <FourchetteProgres pct={progression.variationPct!} bas={progression.intervalle.bas} haut={progression.intervalle.haut} statut={progression.statut} />
      </Bloc>

      <Bloc titre="Chaque course">
        <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>
          Deux droites parallèles : l'écart entre elles est ton évolution à cardio égal. Allures ramenées à {formatNum(e.deniveleReference, 1)} m de dénivelé par km.
        </Text>
        <NuageCourse estimation={e} couleurVerdict={couleurVerdict} />
      </Bloc>

      <Bloc titre="Du brut à l'ajusté">
        <CascadeCourse estimation={e} statut={progression.statut} />
      </Bloc>

      <Bloc titre="Les courses retenues">
        <View>
          {recentes.map((s, i) => (
            <View
              key={`${s.date}-${i}`}
              accessible
              accessibilityLabel={`${dateJourMois(s.date)}, ${formatAllure(s.allure)} à ${Math.round(s.fc)} battements par minute, ${formatNum(s.denivele, 1)} mètres de dénivelé par kilomètre${s.tapis ? ', sur tapis' : ''}, soit ${formatAllure(s.ajuste)} à ${e.fcReference} battements par minute. ${s.actuelle ? 'Période actuelle' : "Période d'avant"}.`}
              style={[styles.ligne, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.trait }]}
            >
              <Text style={[typo.petit, styles.date, { color: p.texteDoux }]}>{dateJourMois(s.date)}</Text>
              <Text style={[typo.petit, styles.flex, { color: p.texte }]}>
                <Text style={styles.gras}>{formatAllure(s.allure)}</Text> · {Math.round(s.fc)} bpm{s.tapis ? ' · tapis' : ''}
                <Text style={{ color: p.texteDoux }}> → </Text>
                <Text style={[styles.gras, s.actuelle && { color: couleur }]}>{formatAllure(s.ajuste)}</Text>
              </Text>
              <View style={[styles.point, { borderColor: s.actuelle ? couleur : p.texteDoux, backgroundColor: s.actuelle ? couleur : 'transparent' }]} />
            </View>
          ))}
        </View>
        {autres > 0 ? <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>+ {autres} autres courses</Text> : null}
        <Text style={[typo.petit, { color: p.texteDoux }]}>● maintenant  ○ avant. La flèche donne l'allure de la course une fois ramenée à {e.fcReference} bpm et à {formatNum(e.deniveleReference, 1)} m par km.</Text>
      </Bloc>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sous: { marginBottom: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, minHeight: 44 },
  date: { width: 62 },
  gras: { fontFamily: police.texte600, fontVariant: ['tabular-nums'] },
  point: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
