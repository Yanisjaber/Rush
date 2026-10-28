import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbePuissance } from '@/components/graphes/CourbePuissance';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { recordRecent } from '@/data/bilan/bilan';
import { indexDureeProche, recordsBasiquesVelo, texteDuree, wattsParKg, type PointCourbe, type RecordTop, type SortieVelo } from '@/data/bilan/records';
import { jourMois, texteRecordSimple, texteValeurRecord } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records du Cyclisme : tes records basiques (cinq tuiles), puis tes meilleurs efforts (la courbe de puissance de 1 s à 5 h, qu'on touche pour lire une durée) et le podium de cette durée.
// Un sélecteur « année choisie / Tous temps » change la période ; chaque record dit ce que vaut l'autre : « Ton record absolu » (coche) ou « Record absolu : … ».
interface Props {
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

type Portee = 'annee' | 'tout';

/** La durée montrée au départ : 20 minutes, celle de ton niveau (FTP). */
const DUREE_DEPART = 1200;

export function OngletRecordsVelo({ annee, maintenant, sorties, poids, courbeAnnee, courbeTout, chargement, erreur, onOuvrir }: Props) {
  const p = usePalette();
  const [portee, setPortee] = useState<Portee>('annee');
  const [duree, setDuree] = useState<number | null>(null); // la durée touchée, en secondes ; null : la durée de départ
  const couleur = couleurSport(p, 'velo');
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';
  const nomAutre = portee === 'annee' ? 'Tous temps' : String(annee);

  const sortiesAnnee = useMemo(() => sorties.filter((s) => s.iso.startsWith(`${annee}-`)), [sorties, annee]);
  const basiques = useMemo(() => recordsBasiquesVelo(portee === 'annee' ? sortiesAnnee : sorties), [portee, sortiesAnnee, sorties]);
  const basiquesAutre = useMemo(() => recordsBasiquesVelo(portee === 'annee' ? sorties : sortiesAnnee), [portee, sortiesAnnee, sorties]);
  const courbe = portee === 'annee' ? courbeAnnee : courbeTout;
  const autre = portee === 'annee' ? courbeTout : courbeAnnee;

  /** Ce que vaut l'autre période pour un record : une coche quand c'est le même record. */
  const comparaison = (a: number | undefined, b: number | undefined, unite: string): { texte: string; ok: boolean } | null => {
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, unite)}`, ok: false };
    }
    if (b == null) return { texte: `Rien en ${annee}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait en ${annee}`, ok: true } : { texte: `En ${annee} : ${texteRecordSimple(b, unite)}`, ok: false };
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
      <OngletsSegment<Portee>
        etiquette="Période des records"
        onglets={[
          { cle: 'annee', nom: String(annee) },
          { cle: 'tout', nom: 'Tous temps' },
        ]}
        actuel={portee}
        onChoisir={setPortee}
      />

      {basiques.length ? (
        <View style={styles.tuiles}>
          {basiques.map((r: RecordTop) => {
            const e = r.top[0];
            const t = texteValeurRecord(e.valeur, r.unite);
            const cmp = comparaison(e.valeur, basiquesAutre.find((x) => x.cle === r.cle)?.top[0]?.valeur, r.unite);
            const etiquette = `${r.libelle}, ${texteRecordSimple(e.valeur, r.unite)}, ${e.nom}, ${formatDateLongue(e.iso)}${cmp ? `, ${cmp.texte}` : ''}. Ouvrir la séance`;
            return (
              <Pressable key={r.cle} onPress={() => e.id && onOuvrir(e.id)} accessibilityRole="button" accessibilityLabel={etiquette} style={[styles.tuile, { backgroundColor: p.surface, borderTopColor: couleur }]}>
                <View style={styles.ligneEntete}>
                  <Text numberOfLines={2} style={[typo.micro, { color: p.texteDoux, flexShrink: 1 }]}>
                    {r.libelle}
                  </Text>
                  {recordRecent(e.iso, maintenant) ? <View style={[styles.nouveau, { backgroundColor: p.texte }]} /> : null}
                </View>
                <Text style={[styles.nombre, { color: p.texte }]}>
                  {t.nombre}
                  {t.unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {t.unite}</Text> : null}
                </Text>
                <View style={{ marginTop: 'auto' }}>
                  <Text numberOfLines={1} style={[typo.micro, { color: p.texteMuet, textTransform: 'none' }]}>
                    {jourMois(e.iso)} {e.iso.slice(0, 4)}
                  </Text>
                  {cmp ? (
                    <Text numberOfLines={2} style={[typo.micro, { color: cmp.ok ? p.texte : p.texteMuet, textTransform: 'none' }]}>
                      {cmp.ok ? '✓ ' : ''}
                      {cmp.texte}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Bloc titre="Records">
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record {portee === 'annee' ? `en ${annee}` : ''}.</Text>
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
              <View accessible accessibilityLabel={`${texteDuree(point.duree)} : ${meilleur.watts} watts${wkg ? `, ${wkg} watts par kilo` : ''}, ${meilleur.nom}, ${formatDateLongue(meilleur.iso)}`} style={styles.lecture}>
                <Text style={[typo.micro, { color: p.texteMuet }]}>Puissance · {texteDuree(point.duree)}</Text>
                <Text style={[styles.valeur, { color: p.texte }]}>
                  {meilleur.watts}
                  <Text style={[typo.corpsFort, { color: p.texteDoux }]}> W</Text>
                </Text>
                <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
                  {wkg ? `${wkg.toFixed(1).replace('.', ',')} W/kg · ` : ''}
                  {meilleur.nom} · {formatDateLongue(meilleur.iso)}
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
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de puissance enregistrée {portee === 'annee' ? `en ${annee}` : ''}.</Text>
        )}
      </Bloc>

      {point && point.top.length > 1 ? (
        <Bloc titre={`Podium · ${texteDuree(point.duree)}`}>
          {point.top.map((e, i) => {
            const etiquette = `${i + 1}, ${e.nom}, ${formatDateLongue(e.iso)}, ${e.watts} watts`;
            return (
              <Pressable key={`${e.id}-${i}`} onPress={() => onOuvrir(e.id)} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} style={styles.podium}>
                <Text style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typo.corps, { color: p.texte }]}>
                    {e.nom}
                  </Text>
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                    {formatDateLongue(e.iso)}
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
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuile: { width: '48.5%', minHeight: 112, borderRadius: rayon.base, borderTopWidth: 3, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 2 },
  ligneEntete: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minHeight: 32 },
  nouveau: { width: 8, height: 8, borderRadius: 4 },
  nombre: { fontFamily: police.titre800, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
  valeur: { fontFamily: police.titre800, fontSize: 38, lineHeight: 42, fontVariant: ['tabular-nums'] },
  podium: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rang: { width: 20, fontFamily: police.titre800, fontSize: 18 },
  valeurPodium: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
