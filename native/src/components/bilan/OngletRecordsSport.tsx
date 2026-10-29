import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { recordsBasiquesActivites } from '@/data/bilan/records';
import { enAnnee } from '@/data/bilan/records-texte';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records d'un sport qui n'est pas le vélo (course, natation, musculation, Hyrox…) : les mêmes mini tuiles que le vélo, avec l'évolution et le classement.
// Les records se calculent sur les activités déjà chargées, de l'année choisie ou de tout l'historique.
interface Props {
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: 'annee' | 'tout';
  /** Les activités du sport filtré. */
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  /** Le sport du filtre du haut (« course », « natation », « muscu »…). */
  filtre: string;
  onOuvrir: (id: string) => void;
}

export function OngletRecordsSport({ portee, toutes, annee, maintenant, filtre, onOuvrir }: Props) {
  const p = usePalette();
  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const records = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? sortiesAnnee : toutes, filtre), [portee, sortiesAnnee, toutes, filtre]);
  const recordsAutre = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? toutes : sortiesAnnee, filtre), [portee, sortiesAnnee, toutes, filtre]);

  if (!records.length) {
    return (
      <Bloc titre="Records">
        <Text style={[typo.corps, styles.vide, { color: p.texteDoux }]}>Pas encore de record{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
      </Bloc>
    );
  }
  return <TuilesRecords records={records} recordsAutre={recordsAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleurSport(p, filtre)} onOuvrir={onOuvrir} />;
}

const styles = StyleSheet.create({
  vide: {},
});
