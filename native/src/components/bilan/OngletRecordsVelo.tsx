import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbePuissance } from '@/components/graphes/CourbePuissance';
import { indexDureeProche, recordsBasiquesVelo, texteDuree, wattsParKg, type PointCourbe, type RecordTop, type SortieVelo } from '@/data/bilan/records';
import { texteRecordSimple, texteValeurRecord, EnAnnee, enAnnee } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records du Cyclisme : tes records basiques (cinq tuiles), puis tes meilleurs efforts (la courbe de puissance de 1 s à 5 h, qu'on touche pour lire une durée) et le podium de cette durée.
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

/** Le nom d'un record sur une mini tuile (quatre par rangée, donc très étroite) : le détail, qui sort au toucher, donne le nom entier. */
const NOM_TUILE: Record<string, string> = { duree: 'Durée', distance: 'Distance', dplus: 'D+', tss: 'Charge', vmoy: 'Vitesse moy.', pmoy: 'Puiss. moy.', fcmoy: 'FC moy.', kj: 'Énergie' };

export function OngletRecordsVelo({ portee, annee, maintenant, sorties, poids, courbeAnnee, courbeTout, chargement, erreur, onOuvrir }: Props) {
  const p = usePalette();
  const [duree, setDuree] = useState<number | null>(null); // la durée touchée, en secondes ; null : la durée de départ
  const [ouvert, setOuvert] = useState<string | null>(null); // le record dont le détail est sorti
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
        <>
          {/* Les records basiques : de mini tuiles, quatre par rangée ; on en touche une pour que son détail sorte dessous */}
          <View style={styles.mini}>
            {basiques.map((r: RecordTop) => {
              const t = texteValeurRecord(r.top[0].valeur, r.unite);
              const actif = ouvert === r.cle;
              return (
                <Pressable
                  key={r.cle}
                  onPress={() => setOuvert(actif ? null : r.cle)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: actif }}
                  accessibilityLabel={`${r.libelle}, ${texteRecordSimple(r.top[0].valeur, r.unite)}. Voir le détail`}
                  style={[styles.tuileMini, { backgroundColor: p.surface, borderTopColor: couleur }, actif && { borderColor: p.texte, borderWidth: 1.5, borderTopWidth: 3, borderTopColor: couleur }]}
                >
                  <Text numberOfLines={2} style={[styles.nomMini, { color: p.texteDoux }]}>
                    {NOM_TUILE[r.cle] ?? r.libelle}
                  </Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.valeurMini, { color: p.texte }]}>
                    {t.nombre}
                    {t.unite ? <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none' }]}> {t.unite}</Text> : null}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {(() => {
            const r = basiques.find((x) => x.cle === ouvert);
            if (!r) return null;
            const e = r.top[0];
            const t = texteValeurRecord(e.valeur, r.unite);
            const cmp = comparaison(e.valeur, basiquesAutre.find((x) => x.cle === r.cle)?.top[0]?.valeur, r.unite);
            return (
              <Bloc titre={r.libelle}>
                <Text style={[styles.valeurDetail, { color: p.texte }]}>
                  {t.nombre}
                  {t.unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {t.unite}</Text> : null}
                </Text>
                {cmp ? (
                  <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet }]}>
                    {cmp.ok ? '✓ ' : ''}
                    {cmp.texte}
                  </Text>
                ) : null}
                {/* Le classement : une barre par sortie, proportionnelle au record ; on touche une ligne pour ouvrir la séance */}
                <View style={[styles.enteteClassement, { borderTopColor: p.trait }]}>
                  <Text style={[typo.corpsFort, { color: p.texteDoux, flex: 1 }]}>Classement</Text>
                  <Text style={[typo.petit, { color: p.texteMuet }]}>{r.top.length} sorties</Text>
                </View>
                {/* Une zone de hauteur fixe qui défile : tout le classement (jusqu'à 30 sorties) sans allonger la page */}
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.zoneClassement} accessibilityLabel={`Classement de ${r.top.length} sorties`}>
                  {r.top.map((x, i) => {
                    const tx = texteValeurRecord(x.valeur, r.unite);
                    const largeur = `${Math.max(4, Math.min(100, (x.valeur / e.valeur) * 100))}%` as `${number}%`;
                    const contenu = (
                      <>
                        <View style={styles.ligneClassement}>
                          <Text style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>{i + 1}</Text>
                          <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                            {x.nom}
                          </Text>
                          <Text style={[styles.valeurPodium, { color: p.texte }]}>
                            {tx.nombre}
                            {tx.unite ? <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none' }]}> {tx.unite}</Text> : null}
                          </Text>
                        </View>
                        <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                          <View style={{ width: largeur, height: '100%', borderRadius: 3, backgroundColor: couleur, opacity: i === 0 ? 1 : 0.6 }} />
                        </View>
                        <Text style={[typo.petit, styles.dateClassement, { color: p.texteMuet }]}>{dateAnnee(x.iso)}</Text>
                      </>
                    );
                    const etiquette = `${i + 1}, ${x.nom}, ${dateAnnee(x.iso)}, ${texteRecordSimple(x.valeur, r.unite)}`;
                    return x.id ? (
                      <Pressable key={`${x.iso}-${i}`} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} onPress={() => onOuvrir(x.id as string)} style={styles.classement}>
                        {contenu}
                      </Pressable>
                    ) : (
                      <View key={`${x.iso}-${i}`} accessible accessibilityLabel={etiquette} style={styles.classement}>
                        {contenu}
                      </View>
                    );
                  })}
                </ScrollView>
              </Bloc>
            );
          })()}
        </>
      ) : (
        <Bloc titre="Records">
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record {portee === 'annee' ? enAnnee(annee, maintenant) : ''}.</Text>
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
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de puissance enregistrée {portee === 'annee' ? enAnnee(annee, maintenant) : ''}.</Text>
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
  mini: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuileMini: { width: '23.1%', minHeight: 70, borderRadius: rayon.base, borderTopWidth: 3, borderWidth: 0, paddingHorizontal: 7, paddingTop: 8, paddingBottom: 8, gap: 1 },
  nomMini: { fontFamily: police.texte600, fontSize: 10, lineHeight: 13, letterSpacing: 0.2, textTransform: 'uppercase', minHeight: 28 },
  valeurMini: { fontFamily: police.titre800, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  valeurDetail: { fontFamily: police.titre800, fontSize: 24, lineHeight: 28, marginBottom: 2, fontVariant: ['tabular-nums'] },
  lecture: { alignItems: 'center', gap: 2, marginTop: 10 },
  valeur: { fontFamily: police.titre800, fontSize: 38, lineHeight: 42, fontVariant: ['tabular-nums'] },
  enteteClassement: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  zoneClassement: { height: 240 },
  classement: { paddingVertical: 8, minHeight: 56 },
  ligneClassement: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piste: { height: 6, borderRadius: 3, marginLeft: 28, marginTop: 4, overflow: 'hidden' },
  dateClassement: { marginLeft: 28, marginTop: 2 },
  podium: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rang: { width: 20, fontFamily: police.titre800, fontSize: 18 },
  valeurPodium: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
