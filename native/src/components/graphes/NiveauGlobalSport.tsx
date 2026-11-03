import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { ChaleurPiliers } from '@/components/graphes/ChaleurPiliers';
import { CourbeGlobale } from '@/components/graphes/CourbeGlobale';
import { IconeSport } from '@/components/ui/IconeSport';
import { PILIERS_MINI_GLOBAL } from '@/data/bilan/piliers-niveau';
import type { NiveauGlobalSport as Niveau } from '@/data/bilan/piliers-sport';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page Progrès de la course et de la musculation, sur le modèle de celle du vélo (NiveauGlobalVelo) : le niveau global de l'année choisie (le chiffre seul), la courbe du score global de toutes les années,
// la carte de chaleur des quatre piliers par année, puis les blocs propres au sport (`children` : la courbe du niveau, la force par exercice, la forme semaine par semaine).
// Calculs : data/bilan/piliers-course.ts, piliers-muscu.ts et docs/native/PROGRESSION_NIVEAU.md.
interface Props {
  /** Le sport : « course », « muscu », « triathlon », « duathlon » ou « hyrox » (icône, couleur). */
  famille: 'course' | 'muscu' | 'triathlon' | 'duathlon' | 'hyrox';
  global: Niveau;
  /** L'année choisie en haut du Bilan : le niveau du haut, le point cerclé, la fenêtre de la carte des piliers. */
  annee: number;
  /** Choisit l'année de tout le Bilan (toucher un point du score par année). */
  onChoisirAnnee?: (an: number) => void;
  /** Ce qui s'ajoute sous la carte des piliers : courbe du niveau, force par exercice, forme par saison. */
  children?: ReactNode;
}

export function NiveauGlobalSport({ famille, global: g, annee, onChoisirAnnee, children }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, famille);
  // L'année choisie peut ne pas avoir de score (trop peu de mesures : moins de 3 piliers sur 4 prouvés) : le niveau s'affiche alors « — »
  const choisie = g.annees.find((a) => a.an === annee) ?? null;
  const scoreChoisi = choisie ? choisie.global : null;
  const score = scoreChoisi !== null ? String(scoreChoisi) : '—';
  const avecScore = g.annees.filter((a): a is typeof a & { global: number } => a.global !== null);

  return (
    <View style={styles.tout}>
      <View style={styles.tete}>
        <IconeSport sport={famille} taille={22} />
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
          Pas de score global en {annee} : {choisie.nbPiliers} pilier{choisie.nbPiliers > 1 ? 's' : ''} sur {g.piliers.length} mesuré{choisie.nbPiliers > 1 ? 's' : ''}, il en faut {PILIERS_MINI_GLOBAL}. Les piliers sont quand même détaillés plus bas.
        </Text>
      ) : null}

      {avecScore.length ? (
        <Bloc titre="Score par année">
          <CourbeGlobale
            points={avecScore.map((a) => ({ an: a.an, score: a.global }))}
            anneeCerclee={annee}
            couleur={couleur}
            onChoisir={onChoisirAnnee}
            etiquette={`Score global par année : ${avecScore.map((a) => `${a.an} : ${a.global}`).join(', ')}, sur 100.`}
          />
        </Bloc>
      ) : null}

      <Bloc titre="Piliers par année">
        <ChaleurPiliers annees={g.annees} colonnes={g.piliers} couleur={couleur} annee={annee} />
      </Bloc>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tout: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  score: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
