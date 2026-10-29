import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PodiumEfforts } from '@/components/bilan/PodiumEfforts';
import { TuilesRecords } from '@/components/bilan/TuilesRecords';
import { Bloc } from '@/components/feuilles/Bloc';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { CourbeEfforts } from '@/components/graphes/CourbeEfforts';
import { DUREE_MIN_SIGNAL, indexDureeProche, recordsBasiquesVelo, SIGNAUX_VELO, texteDuree, wattsParKg, type CleSignal, type PointCourbe, type SortieVelo } from '@/data/bilan/records';
import { texteRecordSimple, EnAnnee, enAnnee } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { useCourbeSignal } from '@/hooks/useCourbeSignal';
import { usePodium } from '@/hooks/usePodium';
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

export function OngletRecordsVelo({ portee, annee, maintenant, sorties, poids, courbeAnnee: puissanceAnnee, courbeTout: puissanceTout, chargement, erreur, onOuvrir }: Props) {
  const p = usePalette();
  const [duree, setDuree] = useState<number | null>(null); // la durée touchée, en secondes ; null : la durée de départ
  const [signal, setSignal] = useState<CleSignal>('puissance'); // le signal de la courbe : la puissance, la FC, la cadence…
  const info = SIGNAUX_VELO.find((x) => x.cle === signal) ?? SIGNAUX_VELO[0];
  const autresSignaux = useCourbeSignal(signal, annee);
  const courbeTout = signal === 'puissance' ? puissanceTout : autresSignaux.courbeTout;
  const courbeAnnee = signal === 'puissance' ? puissanceAnnee : autresSignaux.courbeAnnee;
  const attenteSignal = signal !== 'puissance' && autresSignaux.chargement && !courbeTout.length;
  const couleur = couleurSport(p, 'velo');
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';

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
  const wkg = meilleur && signal === 'puissance' ? wattsParKg(meilleur.valeur, poids) : null;
  const cmpEffort = meilleur ? comparaison(meilleur.valeur, pointAutre?.top[0]?.valeur, info.unite) : null;
  const dureeMin = signal === 'puissance' ? undefined : DUREE_MIN_SIGNAL;
  // Le podium de la durée touchée : jusqu'à 30 séances, demandées au serveur ; en attendant, les trois de la courbe
  const podiumLong = usePodium(signal, point?.duree ?? null, portee === 'annee' ? annee : null);
  const podium = podiumLong ?? point?.top ?? [];

  if (chargement && !puissanceTout.length) {
    return (
      <View accessible accessibilityLabel="Chargement des records" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (erreur && !puissanceTout.length) return <Text style={[typo.corps, { color: p.texteDoux }]}>{erreur}</Text>;

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
        {/* Le signal de la courbe : la puissance, puis ce que le serveur calcule depuis les streams (FC, cadence, couple, vitesse, VAM, descente). Le menu natif d'Apple, comme celui de l'année */}
        <View style={styles.entete}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
            Meilleurs efforts
          </Text>
          <MenuMesure
            etiquette="Signal de la courbe"
            valeur={signal}
            options={SIGNAUX_VELO.map((x) => ({ cle: x.cle, nom: x.court }))}
            onChoisir={(c) => {
              setSignal(c as CleSignal);
              setDuree(null);
            }}
          />
        </View>
        {attenteSignal ? (
          <View accessible accessibilityLabel="Chargement de la courbe" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : signal !== 'puissance' && autresSignaux.erreur && !courbeTout.length ? (
          <Text style={[typo.corps, { color: p.texteDoux }]}>{autresSignaux.erreur}</Text>
        ) : courbe.some((x) => x.top.length) ? (
          <>
            <CourbeEfforts
              courbe={courbe}
              autre={autre.some((x) => x.top.length) ? autre : undefined}
              formater={(v) => texteRecordSimple(v, info.unite)}
              dureeMin={dureeMin}
              serre={signal === 'fc' || signal === 'cad'}
              selection={indexChoisi >= 0 ? indexChoisi : null}
              onSelection={(i) => setDuree(i == null ? null : (courbe[i]?.duree ?? null))}
              couleur={couleur}
              etiquette={`Courbe de ${info.nom.toLowerCase()}, ${nomPortee} : ${courbe
                .filter((x) => x.top.length && [5, 60, 300, 1200, 3600].includes(x.duree))
                .map((x) => `${texteDuree(x.duree)} ${texteRecordSimple(x.top[0].valeur, info.unite)}`)
                .join(', ')}.`}
            />
            {point && meilleur ? (
              <View accessible accessibilityLabel={`${texteDuree(point.duree)} : ${texteRecordSimple(meilleur.valeur, info.unite)}${wkg ? `, ${wkg} watts par kilo` : ''}, ${meilleur.nom}, ${dateAnnee(meilleur.iso)}`} style={styles.lecture}>
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
          <Text style={[typo.corps, { color: p.texteDoux }]}>
            Pas encore de {info.nom.toLowerCase()} enregistrée{portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.
          </Text>
        )}
      </Bloc>

      {point && podium.length > 1 ? (
        <PodiumEfforts
          titre={`Classement · ${texteDuree(point.duree)}`}
          entrees={podium}
          unite={info.unite}
          sousPremiere={signal === 'puissance' && wkg ? `${wkg.toFixed(1).replace('.', ',')} W/kg` : null}
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
