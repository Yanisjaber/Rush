import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeEfforts, type AxeCourbe } from '@/components/graphes/CourbeEfforts';
import { indexDureeProche, texteDuree } from '@/data/bilan/records';
import { allureAxe, echelleAllure } from '@/data/bilan/records-course';
import { texteRecordSimple } from '@/data/bilan/records-texte';
import { effortsDeSortie } from '@/data/outils/efforts-sortie';
import type { FluxBruts } from '@/data/outils/courbes-sortie';
import { useCourbeCourse } from '@/hooks/useCourbeCourse';
import { useRecordsVelo } from '@/hooks/useRecordsVelo';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les records de la sortie : la courbe de ses meilleurs efforts (la meilleure moyenne sur chaque durée), comme Bilan › Records, avec tes records de tous les temps en pointillés.
// Course : l'allure sur chaque durée. Vélo : la puissance. On touche la courbe pour lire une durée, et on voit si la sortie en est le record. Les autres sports n'ont pas cette courbe.
interface Props {
  brut: FluxBruts | null | undefined;
  famille: 'course' | 'velo';
  /** Date de la sortie (AAAA-MM-JJ). */
  iso: string;
  couleur: string;
}

/** L'axe des durées de la course : de 1 min à 3 h. */
const AXE_DUREE_COURSE: AxeCourbe = {
  min: 60,
  max: 10800,
  reperes: [[60, '1 min'], [300, '5 min'], [600, '10 min'], [1200, '20 min'], [3600, '1 h'], [10800, '3 h']],
  cles: [60, 300, 600, 1200, 3600],
  texte: texteDuree,
};
/** La durée montrée au départ : 20 minutes (celle de ton niveau). */
const DUREE_DEPART = 1200;

export function RecordsSortie({ brut, famille, iso, couleur }: Props) {
  const p = usePalette();
  const [choix, setChoix] = useState<number | null>(null);
  const annee = Number(iso.slice(0, 4)) || new Date().getFullYear();
  const course = famille === 'course';
  // Les records de tous les temps (en pointillés) : chargés seulement pour le sport de la sortie
  const refCourse = useCourbeCourse('pacedur', annee, course);
  const refVelo = useRecordsVelo(!course, annee);
  const toutTemps = course ? refCourse.courbeTout : refVelo.courbeTout;
  const courbe = effortsDeSortie(brut, famille, iso);
  if (!courbe.length) return null;

  const unite = course ? 'allure' : 'W';
  const formater = (v: number): string => texteRecordSimple(v, unite);
  const indexChoisi = indexDureeProche(courbe, choix ?? DUREE_DEPART);
  const point = indexChoisi >= 0 ? courbe[indexChoisi] : null;
  const valeur = point?.top[0]?.valeur;
  const record = point ? toutTemps.find((x) => x.duree === point.duree)?.top[0]?.valeur : undefined;
  // Une sortie qui égale ou dépasse le record de tous les temps l'est elle-même (elle fait partie des données) : « Ton record »
  const estRecord = valeur != null && record != null && valeur >= record - 1e-6;
  const distanceFaite = point && valeur != null && course ? `${texteRecordSimple((valeur * point.duree) / 3600, 'km')} en ${texteDuree(point.duree)}` : null;

  return (
    <Bloc titre="Records de la sortie">
      <CourbeEfforts
        courbe={courbe}
        autre={toutTemps.some((x) => x.top.length) ? toutTemps : undefined}
        formater={formater}
        axe={course ? AXE_DUREE_COURSE : undefined}
        formaterAxe={course ? allureAxe : undefined}
        echelleY={course ? (echelleAllure([courbe, toutTemps]) ?? undefined) : undefined}
        serre={false}
        selection={indexChoisi >= 0 ? indexChoisi : null}
        onSelection={(i) => setChoix(i == null ? null : (courbe[i]?.duree ?? null))}
        couleur={couleur}
        etiquette={`Meilleurs efforts de la sortie : ${courbe.map((x) => `${texteDuree(x.duree)} ${formater(x.top[0].valeur)}`).join(', ')}.`}
      />
      {point && valeur != null ? (
        <View accessible accessibilityLabel={`${texteDuree(point.duree)} : ${formater(valeur)}${record != null ? (estRecord ? ', ton record' : `, ton record ${formater(record)}`) : ''}`} style={styles.lecture}>
          <Text style={[typo.petit, { color: p.texte, textAlign: 'center' }]}>
            {`${texteDuree(point.duree)} : ${formater(valeur)}`}
            {distanceFaite ? ` · ${distanceFaite}` : ''}
          </Text>
          {record != null ? (
            <Text style={[typo.petit, { color: estRecord ? p.texte : p.texteMuet, textAlign: 'center' }]}>{estRecord ? '✓ Ton record sur cette durée' : `Ton record : ${formater(record)}`}</Text>
          ) : null}
        </View>
      ) : null}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
});
