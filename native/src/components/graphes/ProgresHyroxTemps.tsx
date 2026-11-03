import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeLissee } from '@/components/graphes/CourbeLissee';
import { testsExploitables } from '@/data/bilan/hyrox-bilan';
import { ecrireTemps, formatEcartLong } from '@/data/sports/hyrox';
import { deriveRuns, evolutionTotal } from '@/data/sports/hyrox-suivi';
import type { ObjectifHyrox, TestHyrox } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps total de tes tests et courses Hyrox, test après test, jusqu'à la fin de l'année choisie en haut du Bilan : la courbe descend quand tu vas plus vite (plus bas = plus rapide),
// avec le premier et le dernier test, ton objectif de temps et la dérive des runs du dernier test (les 2 derniers kilomètres contre les 2 premiers).
interface Props {
  tests: TestHyrox[];
  objectif: ObjectifHyrox | null;
  /** L'année choisie : la courbe s'arrête à la fin de cette année. */
  annee: number;
}

export function ProgresHyroxTemps({ tests, objectif, annee }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'hyrox');
  const jusquaLAnnee = useMemo(() => testsExploitables(tests).filter((t) => Number(String(t.date).slice(0, 4)) <= annee), [tests, annee]);
  const evolution = useMemo(() => evolutionTotal(jusquaLAnnee), [jusquaLAnnee]);
  const derive = useMemo(() => deriveRuns(jusquaLAnnee[0]), [jusquaLAnnee]); // la liste vient du plus récent au plus ancien : le premier est le dernier test
  if (!evolution) return null;
  const ecartObjectif = objectif && objectif.total_s > 0 ? Math.round(evolution.dernier.total - objectif.total_s) : null;

  return (
    <Bloc titre="Temps total, test après test">
      <Text style={[typo.petit, styles.texte, { color: p.texteDoux }]}>
        {evolution.points.length > 1
          ? `${ecrireTemps(evolution.premier.total)} au premier test, ${ecrireTemps(evolution.dernier.total)} au dernier (${formatEcartLong(evolution.ecart)}) · record ${ecrireTemps(evolution.record)}`
          : `Un seul test pour l'instant : ${ecrireTemps(evolution.dernier.total)}. La courbe apparaît dès le deuxième.`}
      </Text>
      {evolution.points.length > 1 ? (
        <CourbeLissee
          valeurs={evolution.points.map((x) => x.total)}
          couleur={couleur}
          hauteur={110}
          etiquette={`Temps total de tes tests et courses Hyrox, du plus ancien au plus récent : ${evolution.points.map((x) => ecrireTemps(x.total)).join(', ')}. Plus bas, c'est plus rapide.`}
        />
      ) : null}
      {evolution.points.length > 1 ? <Text style={[typo.micro, { color: p.texteMuet }]}>Plus bas = plus rapide</Text> : null}
      {ecartObjectif !== null ? (
        <Text style={[typo.petit, styles.texte, { color: ecartObjectif <= 0 ? p.texte : p.texteDoux }]}>
          {ecartObjectif <= 0 ? '✓ ' : ''}Objectif {ecrireTemps(objectif!.total_s)} : {ecartObjectif <= 0 ? `atteint de ${formatEcartLong(Math.abs(ecartObjectif)).slice(1)}` : `encore ${formatEcartLong(ecartObjectif).slice(1)} à gagner`}
        </Text>
      ) : null}
      {derive ? (
        <Text style={[typo.petit, styles.texte, { color: p.texteDoux }]}>
          Dérive des runs (dernier test) : {derive.ecart > 0 ? '+' : derive.ecart < 0 ? '−' : ''}
          {Math.abs(derive.ecart)} s par km entre le début et la fin ({derive.pct > 0 ? '+' : ''}
          {String(derive.pct).replace('.', ',')} %)
        </Text>
      ) : null}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  texte: { marginTop: 4, marginBottom: 6 },
});
