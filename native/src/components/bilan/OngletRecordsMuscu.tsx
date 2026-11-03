import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import type { EntreeCourbe } from '@/data/bilan/records';
import { chargeParRepetitions, exercicesDuCarnet, recordsExercice, recordsSeanceMuscu, seriesDeLAnnee, type RecordsExercice } from '@/data/bilan/records-muscu';
import { EnAnnee, enAnnee, texteRecordSimple, texteValeurRecord } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import type { SerieForce } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de la musculation : tes records de séance (mini tuiles : tonnage, séries, répétitions, charge la plus lourde, durée), puis tes records par exercice
// (1RM estimé, charge max, répétitions max, volume de séance : on choisit l'exercice et la mesure dans deux menus), avec le classement des séances et la charge tenue pour 1 à 12 répétitions.
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
  const force = useMemo(() => (exercice ? chargeParRepetitions(seriesPortee, exercice.cle) : []), [exercice, seriesPortee]);
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
  const maxForce = Math.max(1, ...force.map((f) => f.poids));

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
          <View style={styles.entete}>
            <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
              Par exercice
            </Text>
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

      {exercice && force.length ? (
        <Bloc titre={`Charge par répétitions · ${exercice.nom}`}>
          <Text style={[typo.petit, styles.explication, { color: p.texteMuet }]}>La charge la plus lourde tenue pour au moins ce nombre de répétitions.</Text>
          <View accessible accessibilityLabel={`Charge la plus lourde par nombre de répétitions, ${exercice.nom} : ${force.map((f) => `${f.reps} répétitions, ${texteRecordSimple(f.poids, 'kg')}`).join(' ; ')}`} style={styles.barres}>
            {force.map((f) => (
              <View key={f.reps} style={styles.ligne}>
                <Text style={[typo.petit, styles.reps, { color: p.texteDoux }]}>{f.reps} rép.</Text>
                <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                  <View style={{ width: `${Math.max(4, (f.poids / maxForce) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: couleur }} />
                </View>
                <Text style={[styles.poids, { color: p.texte }]}>{texteRecordSimple(f.poids, 'kg')}</Text>
              </View>
            ))}
          </View>
        </Bloc>
      ) : null}

      {exercice && classement.length > 1 ? (
        <PodiumEfforts titre={`Classement · ${exercice.nom} · ${mesureInfo.nom}`} entrees={classement} unite={record?.unite ?? 'kg'} sousPremiere={null} onOuvrir={onOuvrir} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  lecture: { gap: 2 },
  valeur: { fontFamily: police.titre800, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  explication: { marginBottom: 10 },
  barres: { gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  reps: { width: 52 },
  piste: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  poids: { width: 74, textAlign: 'right', fontFamily: police.titre700, fontSize: 15, fontVariant: ['tabular-nums'] },
});
