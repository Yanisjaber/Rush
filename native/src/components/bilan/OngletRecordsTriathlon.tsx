import { useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OngletRecordsCourse } from '@/components/bilan/OngletRecordsCourse';
import { OngletRecordsNatation } from '@/components/bilan/OngletRecordsNatation';
import { OngletRecordsVelo } from '@/components/bilan/OngletRecordsVelo';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { enAnnee } from '@/data/bilan/records-texte';
import { recordsTriathlon } from '@/data/bilan/records-triathlon';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records du triathlon et du duathlon : un menu « Discipline » choisit ce qu'on regarde.
//  - Tout : les records de séance de l'ensemble (la plus longue séance, la plus grosse charge, la plus longue natation, la plus longue sortie à vélo, la plus longue course, le plus gros D+) ;
//  - Natation, Vélo, Course : l'onglet Records complet de cette discipline (tuiles, courbe de meilleurs efforts : puissance pour le vélo, allure pour la course, classement).
// Chaque discipline garde ainsi ses propres courbes, sans mélanger des watts et des allures.
type VeloProps = Omit<ComponentProps<typeof OngletRecordsVelo>, 'portee' | 'annee' | 'maintenant' | 'onOuvrir'>;

interface Props {
  portee: 'annee' | 'tout';
  /** Les séances du filtre (natation, vélo, course, et celles de type triathlon). */
  toutes: ActiviteBilan[];
  /** Les disciplines de l'onglet : triathlon (natation, vélo, course) ou duathlon (course, vélo). */
  disciplines: ('natation' | 'velo' | 'course')[];
  annee: number;
  maintenant: Date;
  /** Ce que l'onglet vélo demande (sorties, courbes) : chargé par l'écran quand le vélo fait partie du filtre. */
  velo: VeloProps;
  onOuvrir: (id: string) => void;
}

type Choix = 'tout' | 'natation' | 'velo' | 'course';
const NOMS: Record<Choix, string> = { tout: 'Tout', natation: 'Natation', velo: 'Vélo', course: 'Course' };

export function OngletRecordsTriathlon({ portee, toutes, disciplines, annee, maintenant, velo, onOuvrir }: Props) {
  const p = usePalette();
  const [choix, setChoix] = useState<Choix>('tout');
  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const records = useMemo(() => recordsTriathlon(portee === 'annee' ? sortiesAnnee : toutes), [portee, sortiesAnnee, toutes]);
  const recordsAutre = useMemo(() => recordsTriathlon(portee === 'annee' ? toutes : sortiesAnnee), [portee, sortiesAnnee, toutes]);
  const options: Choix[] = ['tout', ...disciplines];
  const actif: Choix = options.includes(choix) ? choix : 'tout';

  return (
    <>
      <View style={styles.menu}>
        <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Discipline</Text>
        <MenuMesure etiquette="Discipline" valeur={actif} options={options.map((c) => ({ cle: c, nom: NOMS[c] }))} onChoisir={(c) => setChoix(c as Choix)} />
      </View>

      {actif === 'tout' ? (
        records.length ? (
          <TuilesRecords records={records} recordsAutre={recordsAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleurSport(p, 'triathlon')} onOuvrir={onOuvrir} />
        ) : (
          <Bloc titre="Records">
            <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
          </Bloc>
        )
      ) : actif === 'velo' ? (
        <OngletRecordsVelo portee={portee} annee={annee} maintenant={maintenant} onOuvrir={onOuvrir} {...velo} />
      ) : actif === 'course' ? (
        <OngletRecordsCourse portee={portee} toutes={toutes.filter((a) => a.famille === 'course')} annee={annee} maintenant={maintenant} onOuvrir={onOuvrir} />
      ) : (
        <OngletRecordsNatation portee={portee} toutes={toutes.filter((a) => a.famille === 'natation')} annee={annee} maintenant={maintenant} onOuvrir={onOuvrir} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
