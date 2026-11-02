import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { ChaleurPiliers } from '@/components/graphes/ChaleurPiliers';
import { CourbeGlobale } from '@/components/graphes/CourbeGlobale';
import { ProgresNiveau } from '@/components/graphes/ProgresNiveau';
import { IconeSport } from '@/components/ui/IconeSport';
import type { RecordsAnnee, SerieNiveau } from '@/data/bilan/niveau-annees';
import { PILIERS, type NiveauGlobal } from '@/data/bilan/piliers-niveau';
import type { PeriodeProgression, Progression } from '@/data/bilan/progression';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page Progrès du vélo, sur une seule page qui défile (demande de Yanis, 2 nov. 2026) : le niveau global de l'année en taille normale,
// la courbe du score global de toutes les années (le score sur chaque point), la carte de chaleur des cinq piliers par année,
// puis la courbe des niveaux (Sprint, 5, 20, 60 min, Endurance) avec son sélecteur. Pas de texte d'explication.
// Calculs : data/bilan/piliers-niveau.ts et docs/native/PROGRESSION_NIVEAU.md.
interface Props {
  global: NiveauGlobal;
  /** Le niveau d'endurance et les records de chaque année, pour la courbe du bas. */
  serie: SerieNiveau;
  records: RecordsAnnee[];
  preuve: Progression | null;
  jours: PeriodeProgression;
}

const signe = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;

export function NiveauGlobalVelo({ global: g, serie, records, preuve, jours }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'velo');
  const score = g.actuel.global!;
  const ecart = g.precedent ? score - g.precedent.global! : null;
  const details = [
    ecart !== null ? `${signe(ecart)} depuis ${g.precedent!.an}` : '',
    g.meilleur.an === g.actuel.an ? 'ton meilleur' : `meilleur : ${g.meilleur.global} en ${g.meilleur.an}`,
    g.actuel.nbPiliers < PILIERS.length ? `${g.actuel.nbPiliers} piliers sur ${PILIERS.length}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.tout}>
      <View style={styles.tete}>
        <IconeSport sport="velo" taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>Niveau global {g.actuel.an}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{details}</Text>
        </View>
        <Text accessibilityLabel={`${score} sur 100`} style={[styles.score, { color: p.texte }]}>
          {score}
          <Text style={[typo.petit, { color: p.texteDoux }]}> / 100</Text>
        </Text>
      </View>

      <Bloc titre="Score par année">
        <CourbeGlobale
          points={g.annees.map((a) => ({ an: a.an, score: a.global! }))}
          meilleurAn={g.meilleur.an}
          couleur={couleur}
          etiquette={`Score global par année : ${g.annees.map((a) => `${a.an} : ${a.global}`).join(', ')}, sur 100.`}
        />
      </Bloc>

      <Bloc titre="Piliers par année">
        <ChaleurPiliers annees={g.annees} couleur={couleur} />
      </Bloc>

      <ProgresNiveau famille="velo" serie={serie} records={records} preuve={preuve} jours={jours} courbeSeule />
    </View>
  );
}

const styles = StyleSheet.create({
  tout: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  score: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
