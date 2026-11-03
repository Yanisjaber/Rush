import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeEfforts, type AxeCourbe } from '@/components/graphes/CourbeEfforts';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { indexDureeProche, type EntreeCourbe } from '@/data/bilan/records';
import { classementRepetitions, courbeForce, exercicesDuCarnet, recordsExercice, recordsSeanceMuscu, REPETITIONS_COURBE_MAX, seriesDeLAnnee, type RecordsExercice } from '@/data/bilan/records-muscu';
import { EnAnnee, enAnnee, texteRecordSimple, texteValeurRecord } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import type { SerieForce } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de la musculation : tes records de séance (mini tuiles : tonnage, séries, répétitions, charge la plus lourde, durée), puis tes records par exercice
// (1RM estimé, charge max, répétitions max, volume de séance : on choisit l'exercice et la mesure dans deux menus), avec le classement des séances, puis la courbe de tes meilleurs efforts (la charge la plus lourde tenue pour 1 à 12 répétitions, qu'on touche pour lire un nombre de répétitions et voir son classement).
// Les séries viennent du carnet de force ; l'année choisie ou « Tout » (tout l'historique) change la période, et chaque record dit ce que vaut l'autre.
interface Props {
  portee: 'annee' | 'tout';
  /** Les séances de musculation avec leurs séries, répétitions et tonnage (voir avecForce). */
  toutes: ActiviteBilan[];
  /** Le carnet de force entier. */
  series: SerieForce[];
  chargement: boolean;
  annee: number;
  maintenant: Date;
  onOuvrir: (id: string) => void;
}

/** L'axe de la courbe de force : de 1 à 12 répétitions. */
const AXE_REPETITIONS: AxeCourbe = {
  min: 1,
  max: REPETITIONS_COURBE_MAX,
  reperes: [[1, '1'], [3, '3'], [5, '5'], [8, '8'], [12, '12']],
  cles: [1, 3, 5, 8, 10], // pas le 12 : sa valeur écrite sortirait de la carte, à droite de l'axe
  texte: (v) => `${v} rép.`,
};
/** Le point montré au départ : 5 répétitions (la série de force classique). */
const REPETITIONS_DEPART = 5;

type MesureExercice = keyof RecordsExercice;
const MESURES_EXERCICE: { cle: MesureExercice; nom: string }[] = [
  { cle: 'rm', nom: '1RM estimé' },
  { cle: 'poids', nom: 'Charge max' },
  { cle: 'reps', nom: 'Répétitions' },
  { cle: 'volume', nom: 'Volume de séance' },
];

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

export function OngletRecordsMuscu({ portee, toutes, series, chargement, annee, maintenant, onOuvrir }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'muscu');
  const [exerciceChoisi, setExerciceChoisi] = useState<string | null>(null);
  const [mesure, setMesure] = useState<MesureExercice>('rm');
  const [repsChoisies, setRepsChoisies] = useState<number | null>(null); // le nombre de répétitions touché sur la courbe ; null : 5

  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const seriesAnnee = useMemo(() => seriesDeLAnnee(series, annee), [series, annee]);
  const seriesPortee = portee === 'annee' ? seriesAnnee : series;
  const seriesAutre = portee === 'annee' ? series : seriesAnnee;
  const basiques = useMemo(() => recordsSeanceMuscu(portee === 'annee' ? sortiesAnnee : toutes, seriesPortee), [portee, sortiesAnnee, toutes, seriesPortee]);
  const basiquesAutre = useMemo(() => recordsSeanceMuscu(portee === 'annee' ? toutes : sortiesAnnee, seriesAutre), [portee, sortiesAnnee, toutes, seriesAutre]);

  // Les exercices de la période (le plus pratiqué d'abord) ; celui qu'on avait choisi reste si la période l'a encore, sinon le premier
  const exercices = useMemo(() => exercicesDuCarnet(seriesPortee), [seriesPortee]);
  const exercice = exercices.find((e) => e.cle === exerciceChoisi) ?? exercices[0] ?? null;
  const records = useMemo(() => (exercice ? recordsExercice(seriesPortee, exercice.cle) : null), [exercice, seriesPortee]);
  const recordsAutre = useMemo(() => (exercice ? recordsExercice(seriesAutre, exercice.cle) : null), [exercice, seriesAutre]);
  // La courbe des meilleurs efforts de l'exercice : la période choisie, et l'autre en pointillés
  const courbe = useMemo(() => (exercice ? courbeForce(seriesPortee, exercice.cle) : []), [exercice, seriesPortee]);
  const courbeAutre = useMemo(() => (exercice ? courbeForce(seriesAutre, exercice.cle) : []), [exercice, seriesAutre]);
  const indexChoisi = courbe.length ? indexDureeProche(courbe, repsChoisies ?? REPETITIONS_DEPART) : -1;
  const point = indexChoisi >= 0 ? courbe[indexChoisi] : null;
  const meilleurPoint = point?.top[0];
  const pointAutre = point ? courbeAutre.find((x) => x.duree === point.duree) : undefined;
  const classementReps = useMemo(() => (exercice && point ? classementRepetitions(seriesPortee, exercice.cle, point.duree) : []), [exercice, point, seriesPortee]);
  const mesureInfo = MESURES_EXERCICE.find((m) => m.cle === mesure) ?? MESURES_EXERCICE[0];
  const record = records?.[mesure] ?? null;
  const recordAutre = recordsAutre?.[mesure] ?? null;
  const classement: EntreeCourbe[] = (record?.top ?? []).filter((e): e is typeof e & { id: string } => !!e.id).map((e) => ({ valeur: e.valeur, id: e.id, nom: e.detail ? `${e.nom} · ${e.detail}` : e.nom, iso: e.iso }));

  /** Ce que vaut l'autre période : une coche quand c'est le même record. */
  const comparaison = (a: number | undefined, b: number | undefined, unite: string): { texte: string; ok: boolean } | null => {
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, unite)}`, ok: false };
    }
    if (b == null) return { texte: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${texteRecordSimple(b, unite)}`, ok: false };
  };
  const cmp = record?.top[0] ? comparaison(record.top[0].valeur, recordAutre?.top[0]?.valeur, record.unite) : null;
  const cmpPoint = meilleurPoint ? comparaison(meilleurPoint.valeur, pointAutre?.top[0]?.valeur, 'kg') : null;

  if (!basiques.length && !exercice) {
    return (
      <Bloc titre="Records">
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {chargement ? 'Chargement de ton carnet de force…' : `Pas encore de record${portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.`}
        </Text>
      </Bloc>
    );
  }
  return (
    <>
      {basiques.length ? <TuilesRecords records={basiques} recordsAutre={basiquesAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleur} onOuvrir={onOuvrir} /> : null}

      {exercice && record ? (
        <Bloc>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
            Par exercice
          </Text>
          {/* Les deux menus sur leur propre ligne : avec le titre, « Développé couché » et « 1RM estimé » ne tiennent pas côte à côte */}
          <View style={styles.menus}>
            <MenuMesure etiquette="Exercice" valeur={exercice.cle} options={exercices.map((e) => ({ cle: e.cle, nom: e.nom }))} onChoisir={(c) => setExerciceChoisi(c)} />
            <MenuMesure etiquette="Mesure" valeur={mesure} options={MESURES_EXERCICE.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => setMesure(c as MesureExercice)} />
          </View>
          {record.top[0] ? (
            <View accessible accessibilityLabel={`${exercice.nom}, ${mesureInfo.nom} : ${texteRecordSimple(record.top[0].valeur, record.unite)}, ${dateAnnee(record.top[0].iso)}`} style={styles.lecture}>
              <Text style={[styles.valeur, { color: p.texte }]}>
                {texteValeurRecord(record.top[0].valeur, record.unite).nombre}
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {texteValeurRecord(record.top[0].valeur, record.unite).unite}</Text>
              </Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {record.top[0].detail ? `${record.top[0].detail} · ` : ''}
                {dateAnnee(record.top[0].iso)}
              </Text>
              {cmp ? (
                <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet }]}>
                  {cmp.ok ? '✓ ' : ''}
                  {cmp.texte}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de {mesureInfo.nom.toLowerCase()} pour cet exercice.</Text>
          )}
        </Bloc>
      ) : null}

      {exercice && courbe.length ? (
        <Bloc>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
            Meilleurs efforts
          </Text>
          <Text style={[typo.petit, styles.explication, { color: p.texteMuet }]}>{exercice.nom} : la charge la plus lourde tenue pour au moins ce nombre de répétitions.</Text>
          <CourbeEfforts
            courbe={courbe}
            autre={portee === 'annee' && courbeAutre.length ? courbeAutre : undefined}
            formater={(v) => texteRecordSimple(v, 'kg')}
            axe={AXE_REPETITIONS}
            serre
            selection={indexChoisi >= 0 ? indexChoisi : null}
            onSelection={(i) => setRepsChoisies(i == null ? null : (courbe[i]?.duree ?? null))}
            couleur={couleur}
            etiquette={`Courbe de force au ${exercice.nom}, ${portee === 'annee' ? annee : 'tous temps'} : ${courbe
              .filter((x) => AXE_REPETITIONS.cles.includes(x.duree))
              .map((x) => `${x.duree} répétitions ${texteRecordSimple(x.top[0].valeur, 'kg')}`)
              .join(', ')}.`}
          />
          {point && meilleurPoint ? (
            <View accessible accessibilityLabel={`${point.duree} répétitions : ${texteRecordSimple(meilleurPoint.valeur, 'kg')}, ${meilleurPoint.nom}, ${dateAnnee(meilleurPoint.iso)}`} style={styles.lectureCourbe}>
              <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
                {meilleurPoint.nom} · {dateAnnee(meilleurPoint.iso)}
              </Text>
              {cmpPoint ? (
                <Text style={[typo.petit, { color: cmpPoint.ok ? p.texte : p.texteMuet, textAlign: 'center' }]}>
                  {cmpPoint.ok ? '✓ ' : ''}
                  {cmpPoint.texte}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Bloc>
      ) : null}

      {exercice && point && classementReps.filter((e) => e.id).length > 1 ? (
        <PodiumEfforts titre={`Classement · ${point.duree} rép. ou plus`} entrees={classementReps.filter((e) => e.id)} unite="kg" sousPremiere={null} onOuvrir={onOuvrir} />
      ) : null}

      {exercice && classement.length > 1 ? (
        <PodiumEfforts titre={`Classement · ${mesureInfo.nom}`} entrees={classement} unite={record?.unite ?? 'kg'} sousPremiere={null} onOuvrir={onOuvrir} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  menus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  lecture: { gap: 2 },
  valeur: { fontFamily: police.titre800, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  explication: { marginBottom: 10 },
  lectureCourbe: { alignItems: 'center', gap: 2, marginTop: 10 },
});
