import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { classementTotaux, recordsParSegment, recordTotal, testsDeLAnnee, type RecordSegment } from '@/data/bilan/hyrox-bilan';
import { recordsBasiquesActivites } from '@/data/bilan/records';
import { EnAnnee, enAnnee, texteRecordSimple } from '@/data/bilan/records-texte';
import { ecrireTemps, formatEcartLong } from '@/data/sports/hyrox';
import { formatDateLongue } from '@/data/outils/format';
import type { TestHyrox } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de l'Hyrox : tes records de séance (mini tuiles : durée, charge…), ton meilleur temps total avec le classement de tes tests et courses, puis le record de chacun des 16 segments
// (les 8 runs d'1 km et les 8 stations) avec l'écart de ton dernier test. L'année choisie ou « Tout » change la période, et chaque record dit ce que vaut l'autre.
interface Props {
  portee: 'annee' | 'tout';
  /** Les séances de type Hyrox (toutes années). */
  toutes: ActiviteBilan[];
  /** Tous les tests et courses Hyrox (table hyrox_tests). */
  tests: TestHyrox[];
  chargement: boolean;
  annee: number;
  maintenant: Date;
  onOuvrir: (id: string) => void;
}

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

export function OngletRecordsHyrox({ portee, toutes, tests, chargement, annee, maintenant, onOuvrir }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'hyrox');
  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const basiques = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? sortiesAnnee : toutes, 'hyrox'), [portee, sortiesAnnee, toutes]);
  const basiquesAutre = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? toutes : sortiesAnnee, 'hyrox'), [portee, sortiesAnnee, toutes]);
  const testsAnnee = useMemo(() => testsDeLAnnee(tests, annee), [tests, annee]);
  const testsPortee = portee === 'annee' ? testsAnnee : tests;
  const testsAutre = portee === 'annee' ? tests : testsAnnee;
  const total = useMemo(() => recordTotal(testsPortee), [testsPortee]);
  const totalAutre = useMemo(() => recordTotal(testsAutre), [testsAutre]);
  const classement = useMemo(() => classementTotaux(testsPortee), [testsPortee]);
  const segments = useMemo(() => recordsParSegment(testsPortee), [testsPortee]);

  /** Ce que vaut l'autre période pour le temps total : une coche quand c'est le même record (le plus court gagne). */
  const comparaison = (): { texte: string; ok: boolean } | null => {
    if (!total) return null;
    if (portee === 'annee') {
      if (!totalAutre) return null;
      return total.valeur <= totalAutre.valeur ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${ecrireTemps(totalAutre.valeur)}`, ok: false };
    }
    if (!totalAutre) return { texte: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return total.valeur === totalAutre.valeur ? { texte: `Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${ecrireTemps(totalAutre.valeur)}`, ok: false };
  };
  const cmp = comparaison();

  if (!basiques.length && !total) {
    return (
      <Bloc titre="Records">
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {chargement ? 'Chargement de tes tests Hyrox…' : `Pas encore de record${portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}. Ajoute un test ou une course Hyrox pour voir tes temps.`}
        </Text>
      </Bloc>
    );
  }
  const runs = segments.filter((s) => s.segment.type === 'run');
  const stations = segments.filter((s) => s.segment.type === 'station');
  return (
    <>
      {basiques.length ? <TuilesRecords records={basiques} recordsAutre={basiquesAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleur} onOuvrir={onOuvrir} /> : null}

      {total ? (
        <Bloc titre="Meilleur temps total">
          <View accessible accessibilityLabel={`Meilleur temps total : ${ecrireTemps(total.valeur)}, ${total.test.label}, ${dateAnnee(String(total.test.date).slice(0, 10))}`} style={styles.lecture}>
            <Text style={[styles.valeur, { color: p.texte }]}>{ecrireTemps(total.valeur)}</Text>
            <Text style={[typo.petit, { color: p.texteDoux }]}>
              {total.test.label} · {dateAnnee(String(total.test.date).slice(0, 10))}
            </Text>
            {cmp ? (
              <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet }]}>
                {cmp.ok ? '✓ ' : ''}
                {cmp.texte}
              </Text>
            ) : null}
          </View>
        </Bloc>
      ) : null}

      {classement.length > 1 ? (
        <PodiumEfforts
          titre="Classement · temps total"
          entrees={classement}
          unite="chrono"
          sousPremiere={null}
          ecart={(meilleur, valeur) => formatEcartLong(valeur - meilleur)}
          onOuvrir={(id) => {
            if (id) onOuvrir(id); // un test saisi à la main n'a pas de séance à ouvrir
          }}
        />
      ) : null}

      {runs.length ? <BlocSegments titre="Records des runs (1 km)" lignes={runs} couleur={couleur} /> : null}
      {stations.length ? <BlocSegments titre="Records des stations" lignes={stations} couleur={couleur} /> : null}
    </>
  );
}

/** Une carte de records de segments : le nom, le record, sa date, et ce que ton dernier test a fait en plus. */
function BlocSegments({ titre, lignes, couleur }: { titre: string; lignes: RecordSegment[]; couleur: string }) {
  const p = usePalette();
  return (
    <Bloc titre={titre}>
      <View accessible accessibilityLabel={`${titre} : ${lignes.map((l) => `${l.segment.nom} ${ecrireTemps(l.meilleur)}`).join(', ')}`} style={styles.liste}>
        {lignes.map((l) => (
          <View key={l.segment.cle} style={styles.ligne}>
            <View style={[styles.pastille, { backgroundColor: couleur }]} />
            <View style={styles.centre}>
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                {l.segment.nom}
              </Text>
              <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                {l.segment.detail} · {dateAnnee(String(l.test.date).slice(0, 10))}
              </Text>
            </View>
            <View style={styles.droite}>
              <Text style={[styles.temps, { color: p.texte }]}>{ecrireTemps(l.meilleur)}</Text>
              <Text style={[typo.petit, { color: p.texteMuet }]}>{l.ecart != null ? `Dernier ${formatEcartLong(l.ecart)}` : '✓ Dernier test'}</Text>
            </View>
          </View>
        ))}
      </View>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  lecture: { gap: 2 },
  valeur: { fontFamily: police.titre800, fontSize: 38, lineHeight: 42, fontVariant: ['tabular-nums'] },
  liste: { gap: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  pastille: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginVertical: 6 },
  centre: { flex: 1, minWidth: 0 },
  droite: { alignItems: 'flex-end' },
  temps: { fontFamily: police.titre700, fontSize: 18, fontVariant: ['tabular-nums'] },
});
