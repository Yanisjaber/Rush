import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeEfforts, type AxeCourbe } from '@/components/graphes/CourbeEfforts';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { indexDureeProche, recordsBasiquesActivites, texteDuree } from '@/data/bilan/records';
import { chronoSurDistance, ecartAllure, SIGNAUX_COURSE, texteDistance, type CleCourbeCourse } from '@/data/bilan/records-course';
import { EnAnnee, enAnnee, texteRecordSimple } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { useCourbeCourse, usePodiumCourse } from '@/hooks/useCourbeCourse';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de la course à pied : tes records de séance (mini tuiles : durée, distance, D+, charge, allure moyenne, FC moyenne), puis tes meilleurs efforts :
// la courbe de ton allure sur chaque distance (400 m à marathon), de ta distance sur chaque durée, ou de ta FC sur chaque durée (un menu), qu'on touche pour lire un point,
// et le classement de ce point. Comme pour le vélo, l'année choisie ou « Tout » change la période, et chaque record dit ce que vaut l'autre.
interface Props {
  portee: 'annee' | 'tout';
  /** Les séances de course (toutes années). */
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  onOuvrir: (id: string) => void;
}

/** L'axe d'une courbe par distance : de 400 m au marathon. */
const AXE_DISTANCE: AxeCourbe = {
  min: 400,
  max: 42195,
  reperes: [[400, '400 m'], [1000, '1 km'], [5000, '5 km'], [10000, '10 km'], [21097, 'Semi'], [42195, 'Marathon']],
  cles: [1000, 5000, 10000, 21097],
  texte: texteDistance,
};
/** L'axe d'une courbe par durée : d'une minute à trois heures. */
const AXE_DUREE: AxeCourbe = {
  min: 60,
  max: 10800,
  reperes: [[60, '1 min'], [300, '5 min'], [600, '10 min'], [1200, '20 min'], [3600, '1 h'], [10800, '3 h']],
  cles: [60, 300, 600, 1200, 3600],
  texte: texteDuree,
};
/** Le point montré au départ : le 5 km pour l'allure, 30 minutes pour la distance, 20 minutes pour la FC. */
const DEPART: Record<CleCourbeCourse, number> = { pace: 5000, dis: 1800, fc: 1200 };

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;
/** Une vitesse (km/h) écrite en allure sur l'axe vertical : « 5'00" ». */
const allureAxe = (kmh: number): string => {
  if (!(kmh > 0)) return '';
  const s = Math.round(3600 / kmh);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
};

export function OngletRecordsCourse({ portee, toutes, annee, maintenant, onOuvrir }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'course');
  const [signal, setSignal] = useState<CleCourbeCourse>('pace');
  const [choix, setChoix] = useState<number | null>(null); // la distance ou la durée touchée ; null : celle de départ
  const info = SIGNAUX_COURSE.find((s) => s.cle === signal) ?? SIGNAUX_COURSE[0];
  const axe = info.axe === 'distance' ? AXE_DISTANCE : AXE_DUREE;
  const { courbeTout, courbeAnnee, chargement, erreur } = useCourbeCourse(signal, annee, true);
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';

  const sortiesAnnee = useMemo(() => activitesAnnee(toutes, annee, maintenant), [toutes, annee, maintenant]);
  const basiques = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? sortiesAnnee : toutes, 'course'), [portee, sortiesAnnee, toutes]);
  const basiquesAutre = useMemo(() => recordsBasiquesActivites(portee === 'annee' ? toutes : sortiesAnnee, 'course'), [portee, sortiesAnnee, toutes]);
  const courbe = portee === 'annee' ? courbeAnnee : courbeTout;
  const autre = portee === 'annee' ? courbeTout : courbeAnnee;

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

  const indexChoisi = courbe.length ? indexDureeProche(courbe, choix ?? DEPART[signal]) : -1;
  const point = indexChoisi >= 0 ? courbe[indexChoisi] : null;
  const pointAutre = point ? autre.find((x) => x.duree === point.duree) : undefined;
  const meilleur = point?.top[0];
  const cmp = meilleur ? comparaison(meilleur.valeur, pointAutre?.top[0]?.valeur, info.unite) : null;
  const podiumLong = usePodiumCourse(signal, point?.duree ?? null, portee === 'annee' ? annee : null);
  const podium = podiumLong ?? point?.top ?? [];
  const formater = (v: number): string => texteRecordSimple(v, info.unite);
  // Le texte du point lu : le chrono pour l'allure (« 5 km en 23'23" »), sinon la valeur
  const chrono = point && meilleur && signal === 'pace' ? `${texteDistance(point.duree)} en ${chronoSurDistance(point.duree, meilleur.valeur)}` : null;
  const nomPoint = point ? (info.axe === 'distance' ? texteDistance(point.duree) : texteDuree(point.duree)) : '';

  if (chargement && !courbeTout.length && !basiques.length) {
    return (
      <View accessible accessibilityLabel="Chargement des records" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  return (
    <>
      {basiques.length ? (
        <TuilesRecords records={basiques} recordsAutre={basiquesAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleur} onOuvrir={onOuvrir} />
      ) : (
        <Bloc titre="Records">
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
        </Bloc>
      )}

      <Bloc>
        <View style={styles.entete}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
            Meilleurs efforts
          </Text>
          <MenuMesure
            etiquette="Mesure de la courbe"
            valeur={signal}
            options={SIGNAUX_COURSE.map((s) => ({ cle: s.cle, nom: s.court }))}
            onChoisir={(c) => {
              setSignal(c as CleCourbeCourse);
              setChoix(null);
            }}
          />
        </View>
        {chargement && !courbeTout.length ? (
          <View accessible accessibilityLabel="Chargement de la courbe" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : erreur && !courbeTout.length ? (
          <Text style={[typo.corps, { color: p.texteDoux }]}>{erreur}</Text>
        ) : courbe.some((x) => x.top.length) ? (
          <>
            <CourbeEfforts
              courbe={courbe}
              autre={portee === 'annee' && autre.some((x) => x.top.length) ? autre : undefined}
              formater={formater}
              axe={axe}
              formaterAxe={signal === 'pace' ? allureAxe : undefined}
              serre={signal !== 'dis'}
              selection={indexChoisi >= 0 ? indexChoisi : null}
              onSelection={(i) => setChoix(i == null ? null : (courbe[i]?.duree ?? null))}
              couleur={couleur}
              etiquette={`Courbe de ${info.nom.toLowerCase()}, ${nomPortee} : ${courbe
                .filter((x) => x.top.length && axe.cles.includes(x.duree))
                .map((x) => `${info.axe === 'distance' ? texteDistance(x.duree) : texteDuree(x.duree)} ${formater(x.top[0].valeur)}`)
                .join(', ')}.`}
            />
            {point && meilleur ? (
              <View accessible accessibilityLabel={`${nomPoint} : ${formater(meilleur.valeur)}${chrono ? `, ${chrono}` : ''}, ${meilleur.nom}, ${dateAnnee(meilleur.iso)}`} style={styles.lecture}>
                <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
                  {chrono ? `${chrono} · ` : ''}
                  {dateAnnee(meilleur.iso)}
                </Text>
                {cmp ? (
                  <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet, textAlign: 'center' }]}>
                    {cmp.ok ? '✓ ' : ''}
                    {cmp.texte}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[typo.corps, { color: p.texteDoux }]}>
            Pas encore de {info.nom.toLowerCase()} enregistrée{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}. Les courbes de la course se calculent depuis tes flux Strava : lance « Re-synchroniser » dans Réglages › Connexions si tes anciennes courses n'y sont pas.
          </Text>
        )}
      </Bloc>

      {point && podium.length > 1 ? (
        <PodiumEfforts
          titre={`Classement · ${nomPoint}`}
          entrees={podium}
          unite={info.unite}
          sousPremiere={chrono ? chronoSurDistance(point.duree, podium[0].valeur) : null}
          ecart={signal === 'pace' ? ecartAllure : undefined}
          onOuvrir={onOuvrir}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  attente: { paddingVertical: 40, alignItems: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
});
