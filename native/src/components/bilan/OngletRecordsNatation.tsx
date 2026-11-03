import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeEfforts, type AxeCourbe } from '@/components/graphes/CourbeEfforts';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { indexDureeProche, recordsBasiquesActivites } from '@/data/bilan/records';
import { allureAxe, echelleAllure, texteDistance } from '@/data/bilan/records-course';
import { classementAllureNatation, courbeNatation, ecartAllure100 } from '@/data/bilan/records-natation';
import { EnAnnee, enAnnee, texteRecordSimple } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de la natation : tes records de séance (mini tuiles : durée, distance, charge, allure moyenne au 100 m), puis la courbe de tes meilleurs efforts : pour chaque distance de séance
// (300 m à 5 km), ta meilleure allure au 100 m sur une séance d'au moins cette distance (voir data/bilan/records-natation.ts : la piscine n'envoie presque jamais de flux détaillé, on lit les séances entières).
// On touche la courbe pour lire une distance et voir son classement. L'année choisie ou « Tout » change la période, et chaque record dit ce que vaut l'autre.
interface Props {
  portee: 'annee' | 'tout';
  /** Les séances de natation (toutes années). */
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  onOuvrir: (id: string) => void;
}

/** L'axe de la courbe : de 300 m à 5 km. */
const AXE: AxeCourbe = {
  min: 300,
  max: 5000,
  reperes: [[300, '300 m'], [500, '500 m'], [1000, '1 km'], [2000, '2 km'], [5000, '5 km']],
  cles: [500, 1000, 1500, 2000, 3000],
  texte: texteDistance,
};
/** Le point montré au départ : 1 km. */
const DEPART = 1000;

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

export function OngletRecordsNatation({ portee, toutes, annee, maintenant, onOuvrir }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'natation');
  const [choix, setChoix] = useState<number | null>(null);
  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const seancesPortee = portee === 'annee' ? sortiesAnnee : toutes;
  const seancesAutre = portee === 'annee' ? toutes : sortiesAnnee;
  const basiques = useMemo(() => recordsBasiquesActivites(seancesPortee, 'natation'), [seancesPortee]);
  const basiquesAutre = useMemo(() => recordsBasiquesActivites(seancesAutre, 'natation'), [seancesAutre]);
  const courbe = useMemo(() => courbeNatation(seancesPortee), [seancesPortee]);
  const autre = useMemo(() => courbeNatation(seancesAutre), [seancesAutre]);
  const indexChoisi = courbe.length ? indexDureeProche(courbe, choix ?? DEPART) : -1;
  const point = indexChoisi >= 0 ? courbe[indexChoisi] : null;
  const meilleur = point?.top[0];
  const pointAutre = point ? autre.find((x) => x.duree === point.duree) : undefined;
  const classement = useMemo(() => (point ? classementAllureNatation(seancesPortee, point.duree) : []), [point, seancesPortee]);

  /** Ce que vaut l'autre période : une coche quand c'est le même record. */
  const comparaison = (a: number | undefined, b: number | undefined): { texte: string; ok: boolean } | null => {
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, 'allure100')}`, ok: false };
    }
    if (b == null) return { texte: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${texteRecordSimple(b, 'allure100')}`, ok: false };
  };
  const cmp = meilleur ? comparaison(meilleur.valeur, pointAutre?.top[0]?.valeur) : null;
  const formater = (v: number): string => texteRecordSimple(v, 'allure100');

  if (!basiques.length && !courbe.length) {
    return (
      <Bloc titre="Records">
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
      </Bloc>
    );
  }
  return (
    <>
      {basiques.length ? <TuilesRecords records={basiques} recordsAutre={basiquesAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleur} onOuvrir={onOuvrir} /> : null}

      {courbe.length ? (
        <Bloc>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
            Meilleurs efforts
          </Text>
          <Text style={[typo.petit, styles.explication, { color: p.texteMuet }]}>Ta meilleure allure au 100 m sur une séance d'au moins cette distance.</Text>
          <CourbeEfforts
            courbe={courbe}
            autre={portee === 'annee' && autre.length ? autre : undefined}
            formater={formater}
            formaterAxe={(v) => allureAxe(v, 360)}
            echelleY={echelleAllure([courbe, ...(portee === 'annee' ? [autre] : [])], 360, 5, 10) ?? undefined}
            axe={AXE}
            serre
            selection={indexChoisi >= 0 ? indexChoisi : null}
            onSelection={(i) => setChoix(i == null ? null : (courbe[i]?.duree ?? null))}
            couleur={couleur}
            etiquette={`Courbe de ta meilleure allure au 100 m par distance de séance, ${portee === 'annee' ? annee : 'tous temps'} : ${courbe
              .filter((x) => AXE.cles.includes(x.duree))
              .map((x) => `${texteDistance(x.duree)} ${formater(x.top[0].valeur)}`)
              .join(', ')}.`}
          />
          {point && meilleur ? (
            <View accessible accessibilityLabel={`${texteDistance(point.duree)} ou plus : ${formater(meilleur.valeur)}, ${meilleur.nom}, ${dateAnnee(meilleur.iso)}`} style={styles.lecture}>
              <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
                {meilleur.nom} · {dateAnnee(meilleur.iso)}
              </Text>
              {cmp ? (
                <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet, textAlign: 'center' }]}>
                  {cmp.ok ? '✓ ' : ''}
                  {cmp.texte}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Bloc>
      ) : null}

      {point && classement.length > 1 ? (
        <PodiumEfforts titre={`Classement · ${texteDistance(point.duree)} ou plus`} entrees={classement} unite="allure100" sousPremiere={null} ecart={ecartAllure100} onOuvrir={onOuvrir} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  explication: { marginBottom: 10 },
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
});
