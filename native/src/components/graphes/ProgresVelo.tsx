import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CascadeVelo } from '@/components/graphes/CascadeVelo';
import { FourchetteVelo } from '@/components/graphes/FourchetteVelo';
import { NuageVelo } from '@/components/graphes/NuageVelo';
import { Dossard } from '@/components/ui/Dossard';
import { IconeSport } from '@/components/ui/IconeSport';
import { PERIODES_PROGRESSION, type PeriodeProgression, type Progression } from '@/data/bilan/progression';
import { MOT, formatPct } from '@/data/bilan/progression-texte';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Progrès du vélo (maquette 1 : « le verdict, puis la preuve »). Le dossard donne le verdict, puis on montre comment l'algorithme y arrive :
// la fourchette, le nuage de sorties avec les deux droites, la cascade de l'écart brut à l'écart à cardio égal, et les sorties retenues.
// Le détail du calcul vient de `progression.detailVelo` (voir data/bilan/progression-velo.ts et docs/native/PROGRESSION_VELO.md).
const SORTIES_AFFICHEES = 5;

/** « 28 oct. » : la date sans le jour de la semaine, pour que la ligne tienne sur un petit écran. */
const dateJourMois = (iso: string): string => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function ProgresVelo({ progression, jours }: { progression: Progression; jours: PeriodeProgression }) {
  const p = usePalette();
  const e = progression.detailVelo;
  if (!e || !progression.intervalle) return null;
  const periode = PERIODES_PROGRESSION.find((x) => x.jours === jours)!;
  const velo = couleurSport(p, 'velo');
  const couleurVerdict = progression.statut === 'hausse' ? p.ok : progression.statut === 'baisse' ? p.alerte : p.texteDoux;
  const recentes = [...e.sorties].reverse().slice(0, SORTIES_AFFICHEES);
  const autres = e.sorties.length - recentes.length;

  return (
    <View style={styles.page}>
      <View style={styles.tete}>
        <IconeSport sport="velo" taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>Cyclisme</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{progression.indicateur}</Text>
        </View>
      </View>

      <Dossard
        sport="velo"
        etiquette={`${periode.court} vs ${periode.court} d'avant`}
        valeur={formatPct(progression.variationPct!)}
        detail={`${MOT[progression.statut]}\nentre ${formatPct(progression.intervalle.bas)} et ${formatPct(progression.intervalle.haut)}`}
        chiffreMax={64}
      />

      <Bloc titre="Fourchette">
        <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>Où se trouve le vrai écart, une fois le bruit des sorties pris en compte.</Text>
        <FourchetteVelo pct={progression.variationPct!} bas={progression.intervalle.bas} haut={progression.intervalle.haut} statut={progression.statut} />
      </Bloc>

      <Bloc titre="Chaque sortie">
        <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>Deux droites parallèles : l'écart entre elles est ton évolution à cardio égal.</Text>
        <NuageVelo estimation={e} couleurVerdict={couleurVerdict} />
      </Bloc>

      <Bloc titre="Du brut à l'ajusté">
        <CascadeVelo estimation={e} statut={progression.statut} />
      </Bloc>

      <Bloc titre="Les sorties retenues">
        <View>
          {recentes.map((s, i) => (
            <View
              key={`${s.date}-${i}`}
              accessible
              accessibilityLabel={`${dateJourMois(s.date)}, ${Math.round(s.watts)} watts à ${Math.round(s.fc)} battements par minute${s.interieur ? ', en salle' : ''}, soit ${Math.round(s.ajuste)} watts à ${e.fcReference} battements par minute. ${s.actuelle ? 'Période actuelle' : "Période d'avant"}.`}
              style={[styles.ligne, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.trait }]}
            >
              <Text style={[typo.petit, styles.date, { color: p.texteDoux }]}>{dateJourMois(s.date)}</Text>
              <Text style={[typo.petit, styles.flex, { color: p.texte }]}>
                <Text style={styles.gras}>{Math.round(s.watts)} W</Text> · {Math.round(s.fc)} bpm{s.interieur ? ' · salle' : ''}
                <Text style={{ color: p.texteDoux }}> → </Text>
                <Text style={[styles.gras, s.actuelle && { color: velo }]}>{Math.round(s.ajuste)} W</Text>
              </Text>
              <View
                style={[styles.point, { borderColor: s.actuelle ? velo : p.texteDoux, backgroundColor: s.actuelle ? velo : 'transparent' }]}
              />
            </View>
          ))}
        </View>
        {autres > 0 ? <Text style={[typo.petit, styles.sous, { color: p.texteDoux }]}>+ {autres} autres sorties</Text> : null}
        <Text style={[typo.petit, { color: p.texteDoux }]}>● maintenant  ○ avant. La flèche donne les watts de la sortie une fois ramenés à {e.fcReference} bpm et à l'extérieur.</Text>
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
