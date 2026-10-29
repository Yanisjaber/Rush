import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbePuissance } from '@/components/graphes/CourbePuissance';
import { indexDureeProche, recordsBasiquesVelo, texteDuree, wattsParKg, type PointCourbe, type SortieVelo } from '@/data/bilan/records';
import { texteRecordSimple, EnAnnee, enAnnee } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records du Cyclisme : tes records basiques (mini tuiles, évolution et classement), puis tes meilleurs efforts (la courbe de puissance de 1 s à 5 h, qu'on touche pour lire une durée) et le podium de cette durée.
// Un sélecteur « année choisie / Tous temps » change la période ; chaque record dit ce que vaut l'autre : « Ton record absolu » (coche) ou « Record absolu : … ».
interface Props {
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: Portee;
  annee: number;
  maintenant: Date;
  sorties: SortieVelo[];
  poids: number | null;
  courbeAnnee: PointCourbe[];
  courbeTout: PointCourbe[];
  chargement: boolean;
  erreur: string;
  onOuvrir: (id: string) => void;
}

export type Portee = 'annee' | 'tout';

/** La durée montrée au départ : 20 minutes, celle de ton niveau (FTP). */
const DUREE_DEPART = 1200;

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

export function OngletRecordsVelo({ portee, annee, maintenant, sorties, poids, courbeAnnee, courbeTout, chargement, erreur, onOuvrir }: Props) {
  const p = usePalette();
  const [duree, setDuree] = useState<number | null>(null); // la durée touchée, en secondes ; null : la durée de départ
  const couleur = couleurSport(p, 'velo');
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';
  const nomAutre = portee === 'annee' ? 'Tous temps' : annee === maintenant.getFullYear() ? 'cette année' : String(annee);

  const sortiesAnnee = useMemo(() => sorties.filter((s) => s.iso.startsWith(`${annee}-`)), [sorties, annee]);
  const basiques = useMemo(() => recordsBasiquesVelo(portee === 'annee' ? sortiesAnnee : sorties), [portee, sortiesAnnee, sorties]);
  const basiquesAutre = useMemo(() => recordsBasiquesVelo(portee === 'annee' ? sorties : sortiesAnnee), [portee, sortiesAnnee, sorties]);
  const courbe = portee === 'annee' ? courbeAnnee : courbeTout;
  const autre = portee === 'annee' ? courbeTout : courbeAnnee;

  /** Ce que vaut l'autre période pour un record : une coche quand c'est le même record. */
  const comparaison = (a: number | undefined, b: number | undefined, unite: string): { texte: string; court: string; ok: boolean } | null => {
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', court: '✓ Record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, unite)}`, court: `Absolu : ${texteRecordSimple(b, unite)}`, ok: false };
    }
    if (b == null) return { texte: `Rien ${enAnnee(annee, maintenant)}`, court: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait ${enAnnee(annee, maintenant)}`, court: `✓ Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${texteRecordSimple(b, unite)}`, court: `${annee} : ${texteRecordSimple(b, unite)}`, ok: false };
  };

  const indexChoisi = courbe.length ? indexDureeProche(courbe, duree ?? DUREE_DEPART) : -1;
  const point = indexChoisi >= 0 ? courbe[indexChoisi] : null;
  const pointAutre = point ? autre.find((x) => x.duree === point.duree) : undefined;
  const meilleur = point?.top[0];
  const wkg = meilleur ? wattsParKg(meilleur.watts, poids) : null;
  const cmpEffort = meilleur ? comparaison(meilleur.watts, pointAutre?.top[0]?.watts, 'W') : null;

  if (chargement && !courbeTout.length) {
    return (
      <View accessible accessibilityLabel="Chargement des records" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (erreur && !courbeTout.length) return <Text style={[typo.corps, { color: p.texteDoux }]}>{erreur}</Text>;

  return (
    <>
      {basiques.length ? (
        <TuilesRecords records={basiques} recordsAutre={basiquesAutre} portee={portee} annee={annee} maintenant={maintenant} couleur={couleur} onOuvrir={onOuvrir} />
      ) : (
        <Bloc titre="Records">
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
        </Bloc>
      )}

      <Bloc titre="Meilleurs efforts">
        {courbe.some((x) => x.top.length) ? (
          <>
            <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>
              Puissance, {nomPortee}. Pointillés : {nomAutre}. Touche la courbe pour lire une durée.
            </Text>
            <CourbePuissance
              courbe={courbe}
              autre={autre.some((x) => x.top.length) ? autre : undefined}
              selection={indexChoisi >= 0 ? indexChoisi : null}
              onSelection={(i) => setDuree(i == null ? null : (courbe[i]?.duree ?? null))}
              couleur={couleur}
              etiquette={`Courbe de puissance, ${nomPortee} : ${courbe
                .filter((x) => x.top.length && [5, 60, 300, 1200, 3600].includes(x.duree))
                .map((x) => `${texteDuree(x.duree)} ${x.top[0].watts} watts`)
                .join(', ')}.`}
            />
            {point && meilleur ? (
              <View accessible accessibilityLabel={`${texteDuree(point.duree)} : ${meilleur.watts} watts${wkg ? `, ${wkg} watts par kilo` : ''}, ${meilleur.nom}, ${dateAnnee(meilleur.iso)}`} style={styles.lecture}>
                <Text style={[typo.micro, { color: p.texteMuet }]}>Puissance · {texteDuree(point.duree)}</Text>
                <Text style={[styles.valeur, { color: p.texte }]}>
                  {meilleur.watts}
                  <Text style={[typo.corpsFort, { color: p.texteDoux }]}> W</Text>
                </Text>
                <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
                  {wkg ? `${wkg.toFixed(1).replace('.', ',')} W/kg · ` : ''}
                  {meilleur.nom} · {dateAnnee(meilleur.iso)}
                </Text>
                {cmpEffort ? (
                  <Text style={[typo.petit, { color: cmpEffort.ok ? p.texte : p.texteMuet, textAlign: 'center' }]}>
                    {cmpEffort.ok ? '✓ ' : ''}
                    {cmpEffort.texte}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de puissance enregistrée{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.</Text>
        )}
      </Bloc>

      {point && point.top.length > 1 ? (
        <Bloc titre={`Podium · ${texteDuree(point.duree)}`}>
          {point.top.map((e, i) => {
            const etiquette = `${i + 1}, ${e.nom}, ${dateAnnee(e.iso)}, ${e.watts} watts`;
            return (
              <Pressable key={`${e.id}-${i}`} onPress={() => onOuvrir(e.id)} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} style={styles.podium}>
                <Text style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typo.corps, { color: p.texte }]}>
                    {e.nom}
                  </Text>
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                    {dateAnnee(e.iso)}
                  </Text>
                </View>
                <Text style={[styles.valeurPodium, { color: p.texte }]}>{e.watts} W</Text>
              </Pressable>
            );
          })}
        </Bloc>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  attente: { paddingVertical: 40, alignItems: 'center' },
  note: { marginBottom: 10 },
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
  valeur: { fontFamily: police.titre800, fontSize: 38, lineHeight: 42, fontVariant: ['tabular-nums'] },
  podium: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rang: { width: 30, fontFamily: police.titre800, fontSize: 18 },
  valeurPodium: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
