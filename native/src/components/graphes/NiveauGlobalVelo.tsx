import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { ChaleurPiliers } from '@/components/graphes/ChaleurPiliers';
import { CompositionGlobale } from '@/components/graphes/CompositionGlobale';
import { CourbeGlobale } from '@/components/graphes/CourbeGlobale';
import { EcartsPiliers } from '@/components/graphes/EcartsPiliers';
import { ProgresNiveau } from '@/components/graphes/ProgresNiveau';
import { Bouton } from '@/components/ui/Bouton';
import { IconeSport } from '@/components/ui/IconeSport';
import { PagerCartes } from '@/components/ui/PagerCartes';
import type { RecordsAnnee, SerieNiveau } from '@/data/bilan/niveau-annees';
import { ecartsPiliers, PILIERS, type NiveauGlobal, type PilierCle } from '@/data/bilan/piliers-niveau';
import type { PeriodeProgression, Progression } from '@/data/bilan/progression';
import { recitNiveau } from '@/data/bilan/recit-niveau';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page Progrès du vélo : le niveau global de l'athlète (cinq piliers : puissance, endurance, durabilité, répétabilité, capacité de charge, chacun noté de 0 à 100,
// et leur moyenne), sur quatre cartes qu'on fait glisser : le récit (maquette 8 de « Progrès vélo : 8 maquettes », sans le gros titre : phrase, courbe commentée, trois lignes), ce qui le compose, ce qui a bougé depuis l'an dernier, et le détail par durée
// (Sprint, 5, 20, 60 minutes, Endurance : la courbe d'avant). Calculs : data/bilan/piliers-niveau.ts et docs/native/PROGRESSION_NIVEAU.md.
interface Props {
  global: NiveauGlobal;
  /** Le niveau d'endurance et les records de chaque année, pour la dernière carte. */
  serie: SerieNiveau;
  records: RecordsAnnee[];
  preuve: Progression | null;
  jours: PeriodeProgression;
}

const nomPilier = (cle: PilierCle): string => PILIERS.find((q) => q.cle === cle)!.nom;

export function NiveauGlobalVelo({ global: g, serie, records, preuve, jours }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'velo');
  const incomplet = g.actuel.nbPiliers < PILIERS.length ? `Score calculé sur ${g.actuel.nbPiliers} piliers sur ${PILIERS.length}.` : '';
  const ecarts = ecartsPiliers(g);
  const recit = recitNiveau(g);

  const pages = [
    {
      nom: 'Récit',
      contenu: (aller: (i: number) => void) => (
        <View style={styles.page}>
          <Text style={[typo.corps, { color: p.texteDoux }]}>{[recit.phrase, incomplet].filter(Boolean).join(' ')}</Text>
          <Bloc>
            <CourbeGlobale
              points={g.annees.map((a) => ({ an: a.an, score: a.global! }))}
              reperes={recit.reperes}
              couleur={couleur}
              etiquette={`Score global par année : ${g.annees.map((a) => `${a.an} : ${a.global}`).join(', ')}, sur 100.`}
            />
          </Bloc>
          <View>
            {recit.lignes.map((l, i) => (
              <View key={i} style={[styles.ligne, { borderTopColor: p.trait }, i === recit.lignes.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.trait }]}>
                <Text style={[styles.valeur, { color: p.texte }]}>{l.valeur}</Text>
                <Text style={[typo.corps, styles.flex, { color: p.texte }]}>
                  <Text style={{ fontFamily: police.texte600 }}>{l.gras}</Text> : {l.texte}
                </Text>
              </View>
            ))}
          </View>
          <Bouton variante="discret" onPress={() => aller(1)} accessibilityLabel="Voir les 5 piliers en détail">
            Voir les 5 piliers en détail
          </Bouton>
        </View>
      ),
    },
    {
      nom: 'Composition',
      contenu: (
        <View style={styles.page}>
          <Bloc titre="Ce qui compose le score">
            <CompositionGlobale annees={g.annees} couleur={couleur} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Chaque bloc est la part d'un pilier. De bas en haut : puissance, endurance, durabilité, répétabilité, charge.</Text>
          </Bloc>
          <Bloc titre="Les piliers par année">
            <Text style={[typo.corps, { color: p.texte }]}>
              {nomPilier(g.fort)} est ton point fort ({Math.round(g.actuel.piliers[g.fort]!)}). {nomPilier(g.faible)} est ce qui te tire vers le bas ({Math.round(g.actuel.piliers[g.faible]!)}).
            </Text>
            <ChaleurPiliers annees={g.annees} couleur={couleur} />
          </Bloc>
        </View>
      ),
    },
    {
      nom: 'Ce qui a bougé',
      contenu: (
        <View style={styles.page}>
          <Bloc titre={g.precedent ? `Depuis ${g.precedent.an}` : 'Ce qui a bougé'}>
            {ecarts.length ? (
              <>
                <Text style={[typo.petit, { color: p.texteDoux }]}>En points de score, pilier par pilier.</Text>
                <EcartsPiliers ecarts={ecarts} />
              </>
            ) : (
              <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut deux années avec un niveau global pour voir ce qui a bougé.</Text>
            )}
          </Bloc>
        </View>
      ),
    },
    {
      nom: 'Détail par durée',
      contenu: <ProgresNiveau famille="velo" serie={serie} records={records} preuve={preuve} jours={jours} sansEntete />,
    },
  ];

  return (
    <View style={styles.tout}>
      <View style={styles.tete}>
        <IconeSport sport="velo" taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>Cyclisme</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>Niveau global</Text>
        </View>
      </View>
      <PagerCartes pages={pages} etiquette="Niveau global : quatre cartes à faire glisser (récit, composition, ce qui a bougé, détail par durée)" />
    </View>
  );
}

const styles = StyleSheet.create({
  tout: { gap: espace.e3 },
  page: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  ligne: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: espace.e3, borderTopWidth: StyleSheet.hairlineWidth },
  valeur: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, width: 52, fontVariant: ['tabular-nums'] },
});
