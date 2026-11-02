import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { ChaleurPiliers } from '@/components/graphes/ChaleurPiliers';
import { CourbeGlobale } from '@/components/graphes/CourbeGlobale';
import { FormeSaison } from '@/components/graphes/FormeSaison';
import { ProgresNiveau } from '@/components/graphes/ProgresNiveau';
import { IconeSport } from '@/components/ui/IconeSport';
import type { FormeSaison as Forme } from '@/data/bilan/forme-saison';
import type { RecordsAnnee, SerieNiveau } from '@/data/bilan/niveau-annees';
import { PILIERS_MINI_GLOBAL, type NiveauGlobal } from '@/data/bilan/piliers-niveau';
import type { PeriodeProgression, Progression } from '@/data/bilan/progression';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page Progrès du vélo, sur une seule page qui défile (demande de Yanis, 2 nov. 2026) : le niveau global de l'année en taille normale (le chiffre seul),
// la courbe du score global de toutes les années (le score sur chaque point), la carte de chaleur des quatre piliers par année,
// puis la courbe des niveaux (Sprint, 5, 20, 60 min, Forme) avec son sélecteur, et la forme semaine par semaine de l'année choisie. Pas de texte d'explication.
// Calculs : data/bilan/piliers-niveau.ts et docs/native/PROGRESSION_NIVEAU.md.
interface Props {
  global: NiveauGlobal;
  /** La forme et les records de chaque année, pour la courbe des niveaux. */
  serie: SerieNiveau;
  records: RecordsAnnee[];
  preuve: Progression | null;
  jours: PeriodeProgression;
  /** L'année choisie en haut du Bilan : le niveau du haut, le point cerclé, la fenêtre des piliers et de la courbe du bas. */
  annee: number;
  /** La forme semaine par semaine de l'année choisie ; null s'il n'y a pas de quoi la tracer. */
  forme: Forme | null;
  /** Choisit l'année de tout le Bilan (toucher un point du score par année). */
  onChoisirAnnee?: (an: number) => void;
}

export function NiveauGlobalVelo({ global: g, serie, records, preuve, jours, annee, forme, onChoisirAnnee }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'velo');
  // L'année choisie peut ne pas avoir de score (trop peu de sorties, ou moins de 3 piliers mesurables : pas de capteur de puissance) : le niveau s'affiche alors « — »
  const choisie = g.annees.find((a) => a.an === annee) ?? null;
  const scoreChoisi = choisie ? choisie.global : null;
  const score = scoreChoisi !== null ? String(scoreChoisi) : '—';
  const avecScore = g.annees.filter((a): a is typeof a & { global: number } => a.global !== null);

  return (
    <View style={styles.tout}>
      <View style={styles.tete}>
        <IconeSport sport="velo" taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>Niveau global {annee}</Text>
        </View>
        <Text accessibilityLabel={scoreChoisi !== null ? `${score} sur 100` : 'pas de niveau mesuré'} style={[styles.score, { color: p.texte }]}>
          {score}
          <Text style={[typo.petit, { color: p.texteDoux }]}> / 100</Text>
        </Text>
      </View>

      {choisie && choisie.global === null ? (
        <Text style={[typo.petit, { color: p.texteDoux }]}>
          Pas de score global en {annee} : {choisie.nbPiliers} pilier{choisie.nbPiliers > 1 ? 's' : ''} sur 4 mesuré{choisie.nbPiliers > 1 ? 's' : ''}, il en faut {PILIERS_MINI_GLOBAL} (le capteur de puissance manquait). Les piliers sont quand même détaillés plus bas.
        </Text>
      ) : null}

      <Bloc titre="Score par année">
        <CourbeGlobale
          points={avecScore.map((a) => ({ an: a.an, score: a.global }))}
          anneeCerclee={annee}
          couleur={couleur}
          onChoisir={onChoisirAnnee}
          etiquette={`Score global par année : ${avecScore.map((a) => `${a.an} : ${a.global}`).join(', ')}, sur 100.`}
        />
      </Bloc>

      <Bloc titre="Piliers par année">
        <ChaleurPiliers annees={g.annees} couleur={couleur} annee={annee} />
      </Bloc>

      <ProgresNiveau famille="velo" serie={serie} records={records} preuve={preuve} jours={jours} courbeSeule jusquAn={annee} />

      {forme ? <FormeSaison forme={forme} couleur={couleur} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tout: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  score: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
