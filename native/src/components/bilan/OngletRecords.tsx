import { useMemo, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { ClassementBarres } from '@/components/graphes/ClassementBarres';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { activitesAnnee, MESURES_CUMUL, recordRecent, type ActiviteBilan, type MetriqueCumul } from '@/data/bilan/bilan';
import { recordsPeriodes, recordsRegularite, recordsSeance, type GroupeRecords, type RecordTop } from '@/data/bilan/records';
import { jourMois, libelleEntree, texteRecordSimple, texteValeurRecord, EnAnnee, enAnnee } from '@/data/bilan/records-texte';
import { rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records du Bilan : tes meilleurs résultats, de l'année choisie ou de tous les temps.
//  - Un graphique en haut : la courbe de puissance pour le vélo, les meilleures semaines sinon.
//  - Un sélecteur de thème (Puissance, Vitesse, Sorties, Périodes pour le vélo ; Périodes, Séance, Régularité sinon), les records du thème, et le podium du record touché.
//  - Chaque record dit ce que vaut l'autre période : « Ton record absolu » (coche) ou « Record absolu : 291 W ».
interface Props {
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: Portee;
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  /** Le sport du filtre du haut (« tout », « velo », « muscu »…). */
  filtre: string;
  mesure: MetriqueCumul;
  onMesure: (m: MetriqueCumul) => void;
  onOuvrir: (id: string) => void;
}

export type Portee = 'annee' | 'tout';

const SEMAINES_GRAPHIQUE = 8;

export function OngletRecords({ portee, toutes, annee, maintenant, filtre, mesure, onMesure, onOuvrir }: Props) {
  const p = usePalette();
  const [categorie, setCategorie] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const couleur = filtre === 'tout' ? p.texte : couleurSport(p, filtre);
  const mesureInfo = MESURES_CUMUL.find((m) => m.cle === mesure) ?? MESURES_CUMUL[0];

  const construire = (acts: ActiviteBilan[]): GroupeRecords[] => [recordsPeriodes(acts, mesure, SEMAINES_GRAPHIQUE), recordsSeance(acts), recordsRegularite(acts)];
  const groupesAnnee = useMemo(() => construire(activitesAnnee(toutes, annee, maintenant)), [toutes, annee, maintenant, mesure]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupesTout = useMemo(() => construire(toutes), [toutes, mesure]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupes = portee === 'annee' ? groupesAnnee : groupesTout;
  const autres = portee === 'annee' ? groupesTout : groupesAnnee;

  const groupe = groupes.find((g) => g.cle === categorie) ?? groupes[0];
  const record = groupe?.records.find((r) => r.cle === choisi) ?? groupe?.records[0];
  const autreRecord = (r: RecordTop): RecordTop | undefined => autres.find((g) => g.cle === groupe?.cle)?.records.find((x) => x.cle === r.cle);
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';
  const nomAutre = portee === 'annee' ? 'Tous temps' : annee === maintenant.getFullYear() ? 'cette année' : String(annee);

  /** Ce que vaut l'autre période pour ce record : une coche quand c'est le même record. */
  const comparaison = (r: RecordTop): { texte: string; ok: boolean } | null => {
    const a = r.top[0]?.valeur;
    const b = autreRecord(r)?.top[0]?.valeur;
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, r.unite)}`, ok: false };
    }
    if (b == null) return { texte: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${texteRecordSimple(b, r.unite)}`, ok: false };
  };

  const graphique = (): { titre: string; contenu: ReactElement } | null => {
    const semaines = groupes.find((g) => g.cle === 'periodes')?.records.find((r) => r.cle === 'semaine');
    if (!semaines || semaines.top.length < 2) return null;
    const lignes = semaines.top.map((e) => ({ libelle: portee === 'tout' ? `${jourMois(e.iso)} ${e.iso.slice(2, 4)}` : jourMois(e.iso), valeur: e.valeur, texte: texteRecordSimple(e.valeur, semaines.unite) }));
    return {
      titre: `Tes ${lignes.length} meilleures semaines`,
      contenu: (
        <>
          <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>
            {mesureInfo.nom}, {nomPortee === 'Tous temps' ? 'tous temps' : nomPortee}. Le lundi de chaque semaine.
          </Text>
          <ClassementBarres lignes={lignes} couleur={couleur} etiquette={`Meilleures semaines, ${mesureInfo.nom} : ${lignes.map((l) => `${l.libelle} ${l.texte}`).join(', ')}.`} />
        </>
      ),
    };
  };
  const g = graphique();

  return (
    <>
      {g ? (
        <Bloc titre={g.titre}>
          {g.contenu}
        </Bloc>
      ) : null}

      {groupes.length ? (
        <>
          <OngletsSegment<string>
            etiquette="Thème des records"
            taille={groupes.length > 3 ? 13 : 15}
            onglets={groupes.map((x) => ({ cle: x.cle, nom: x.libelle }))}
            actuel={groupe?.cle ?? ''}
            onChoisir={(c) => {
              setCategorie(c);
              setChoisi(null);
            }}
          />
          <Bloc>
            <View style={styles.entete}>
              <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                {groupe?.libelle} · {nomPortee}
              </Text>
              {groupe?.cle === 'periodes' ? <MenuMesure etiquette="Mesure des records de période" valeur={mesure} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => onMesure(c as MetriqueCumul)} /> : null}
            </View>
            {groupe && groupe.records.length ? (
              groupe.records.map((r, i) => {
                const meilleur = r.top[0];
                const t = texteValeurRecord(meilleur.valeur, r.unite);
                const sel = record?.cle === r.cle;
                const cmp = comparaison(r);
                const l = libelleEntree(r, meilleur);
                return (
                  <Pressable
                    key={r.cle}
                    onPress={() => setChoisi(r.cle)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={`${r.libelle}, ${texteRecordSimple(meilleur.valeur, r.unite)}, ${l.titre}, ${l.sous}${cmp ? `, ${cmp.texte}` : ''}. Voir le podium`}
                    style={[styles.record, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, sel && { backgroundColor: p.surface2 }]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.ligneEntete}>
                        <Text style={[typo.micro, { color: p.texteDoux }]}>{r.libelle}</Text>
                        {recordRecent(meilleur.iso, maintenant) ? (
                          <View style={[styles.nouveau, { backgroundColor: p.texte }]}>
                            <Text style={[typo.micro, { color: p.fond }]}>Nouveau</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
                        {l.titre}
                        {l.sous ? ` · ${l.sous}` : ''}
                      </Text>
                      {cmp ? (
                        <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet }]}>
                          {cmp.ok ? '✓ ' : ''}
                          {cmp.texte}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.valeur}>
                      <Text style={[styles.nombre, { color: p.texte }]}>
                        {t.nombre}
                        {t.unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {t.unite}</Text> : null}
                      </Text>
                      
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record {portee === 'annee' ? enAnnee(annee, maintenant) : ''} dans ce thème.</Text>
            )}
          </Bloc>

          {record && record.top.length > 1 ? (
            <Bloc titre={`Podium · ${record.libelle}`}>
              {record.top.map((e, i) => {
                const l = libelleEntree(record, e);
                const contenu = (
                  <>
                    <Text style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[typo.corps, { color: p.texte }]}>
                        {l.titre}
                      </Text>
                      {l.sous ? (
                        <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                          {l.sous}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.valeurPodium, { color: p.texte }]}>{texteRecordSimple(e.valeur, record.unite)}</Text>
                  </>
                );
                const etiquette = `${i + 1}, ${l.titre}, ${l.sous}, ${texteRecordSimple(e.valeur, record.unite)}`;
                return e.id ? (
                  <Pressable key={`${e.iso}-${i}`} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} onPress={() => onOuvrir(e.id as string)} style={styles.podium}>
                    {contenu}
                  </Pressable>
                ) : (
                  <View key={`${e.iso}-${i}`} accessible accessibilityLabel={etiquette} style={styles.podium}>
                    {contenu}
                  </View>
                );
              })}
            </Bloc>
          ) : null}
        </>
      ) : (
        <Bloc titre="Records">
          <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record {portee === 'annee' ? enAnnee(annee, maintenant) : ''}.</Text>
        </Bloc>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: 10 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: rayon.base },
  ligneEntete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nouveau: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: rayon.s },
  valeur: { alignItems: 'flex-end', maxWidth: '45%' },
  nombre: { fontFamily: police.titre800, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  podium: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rang: { width: 20, fontFamily: police.titre800, fontSize: 18 },
  valeurPodium: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
