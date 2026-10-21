import { FondDegrade } from '@/components/FondDegrade';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bientot } from '@/actions/bientot';
import { BarreSports } from '@/components/BarreSports';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { GrapheSeries } from '@/components/GrapheSeries';
import {
  activitesAnnee, activitesAnneePrecedente, anneesDisponibles, avancement, cumulParAnnee, ecartPct, NOM_SPORT_BILAN, normaliser, recordRecent, recordsVolume,
  repartitionSport, sommer, volumeMensuel, familleBilanDuFiltre,
} from '@/data/bilan';
import { formatDateLongue, formatNum, texteHM } from '@/data/format';
import { useDonneesBilan } from '@/hooks/useDonneesBilan';
import { useMenu } from '@/stores/menu';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const BARRE_ONGLETS = 72;
const nomUnite = (u: string) => (u ? ` ${u}` : '');

// Le bilan d'une année : chiffres contre l'an dernier à la même date, objectifs, records, cumul sur 3 ans, volume par mois, répartition.
// Lecture seule pour l'instant : ajouter ou modifier un objectif arrive avec son panneau.
export default function Bilan() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre } = useMenu();
  const maintenant = useMemo(() => new Date(), []);
  const [anneeChoisie, setAnneeChoisie] = useState(maintenant.getFullYear());
  const [metrique, setMetrique] = useState<'distance_km' | 'd_plus'>('distance_km');
  const { brutes, objectifs, chargement, erreur, actualisation, recharger } = useDonneesBilan();
  const annee = anneeChoisie;

  const toutes = useMemo(() => brutes.map(normaliser), [brutes]);
  const annees = useMemo(() => anneesDisponibles(toutes, maintenant), [toutes, maintenant]);
  // Le filtre global de sport concerne les chiffres, records et graphiques ; pas les objectifs annuels
  const filtrees = useMemo(() => (filtre === 'tout' ? toutes : toutes.filter((a) => a.famille === filtre)), [toutes, filtre]);

  const courant = sommer(activitesAnnee(filtrees, annee, maintenant));
  const precedent = sommer(activitesAnneePrecedente(filtrees, annee, maintenant));
  const tuiles = [
    { cle: 'distance', libelle: 'Distance', val: courant.distance, prec: precedent.distance, unite: 'km', dec: 0 },
    { cle: 'heures', libelle: 'Temps', val: courant.heures, prec: precedent.heures, unite: 'h', dec: 1 },
    { cle: 'seances', libelle: 'Séances', val: courant.seances, prec: precedent.seances, unite: '', dec: 0 },
    { cle: 'tss', libelle: 'Charge', val: courant.tss, prec: precedent.tss, unite: 'TSS', dec: 0 },
  ];

  const familleFiltre = familleBilanDuFiltre(filtre);
  const objectifsAnnee = objectifs.filter((o) => o.annee === annee && (!familleFiltre || o.sport === 'tous' || o.sport === familleFiltre));
  const avancements = objectifsAnnee.map((o) => ({ objectif: o, av: avancement(o, toutes, annee, maintenant) })).filter((x): x is { objectif: typeof x.objectif; av: NonNullable<typeof x.av> } => !!x.av);

  const records = recordsVolume(activitesAnnee(filtrees, annee, maintenant));
  const cumul = cumulParAnnee(filtrees, [annee, annee - 1, annee - 2], metrique, maintenant);
  const mensuel = volumeMensuel(filtrees, annee);
  const maxMois = Math.max(1, ...mensuel);
  const repartition = repartitionSport(activitesAnnee(toutes, annee, maintenant));

  return (
    <View style={[styles.page, { backgroundColor: 'transparent' }]}>
      <FondDegrade />
      <BarreSports />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        {/* Pas de titre à l'écran (l'onglet du bas et les pastilles d'année le disent déjà) ; VoiceOver le lit quand même */}
        <Text accessibilityRole="header" style={styles.titreInvisible}>
          Bilan {annee}
        </Text>
        <View style={styles.annees} accessibilityRole="tablist">
          {annees.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAnneeChoisie(a)}
              accessibilityRole="button"
              accessibilityLabel={`Année ${a}`}
              accessibilityState={{ selected: a === annee }}
              style={[styles.pastille, { backgroundColor: a === annee ? p.texte : 'transparent', borderColor: a === annee ? p.texte : p.contourChamp }]}
            >
              <Text style={[typo.corpsFort, { color: a === annee ? p.fond : p.texteDoux }]}>{a}</Text>
            </Pressable>
          ))}
        </View>

        {chargement ? (
          <View accessible accessibilityLabel="Chargement du bilan" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : (
          <>
            <View style={styles.tuiles}>
              {tuiles.map((t) => {
                const e = ecartPct(t.val, t.prec);
                return (
                  <View key={t.cle} accessible style={[styles.tuile, { backgroundColor: p.surface }]}>
                    <Text style={[typo.micro, { color: p.texteDoux }]}>{t.libelle}</Text>
                    <Text style={[styles.valeur, { color: p.texte }]}>
                      {formatNum(t.val, t.dec)}
                      <Text style={[typo.petit, { color: p.texteDoux }]}>{nomUnite(t.unite)}</Text>
                    </Text>
                    {e != null ? (
                      <>
                        <Text style={[typo.petit, styles.delta, { color: e >= 0 ? p.ok : p.alerte }]}>
                          {e >= 0 ? '+' : ''}
                          {e} % contre {annee - 1}
                        </Text>
                        <Text style={[typo.petit, { color: p.texteMuet }]}>
                          {annee - 1} à la même date : {formatNum(t.prec, t.dec)}
                          {nomUnite(t.unite)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[typo.petit, { color: p.texteMuet }]}>Pas de référence {annee - 1}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <Bloc titre={`Objectifs de ${annee}`}>
              {avancements.length ? (
                avancements.map(({ objectif, av }, i) => (
                  <Pressable
                    key={objectif.id}
                    onPress={() => bientot("La modification d'un objectif")}
                    accessibilityRole="button"
                    accessibilityLabel={`${av.modele.label}, ${av.actuel == null ? 'valeur inconnue' : `${Math.round(av.pct)} pour cent`}. Modifier l'objectif`}
                    style={[styles.objectif, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={styles.tete}>
                      <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                        {objectif.sport !== 'tous' ? `${NOM_SPORT_BILAN[objectif.sport]} · ` : ''}
                        {av.modele.label}
                      </Text>
                    </View>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>
                      <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>
                        {av.actuel == null ? '—' : formatNum(av.actuel, av.modele.unit === 'h' || av.modele.unit === 'W/kg' ? 1 : 0)}
                      </Text>
                      {` / ${formatNum(av.cible, av.modele.unit === 'h' ? 1 : 0)}${nomUnite(av.modele.unit)} · ${av.actuel == null ? '—' : `${Math.round(av.pct)} %`}`}
                    </Text>
                    <View style={[styles.barre, { backgroundColor: p.surface2 }]}>
                      <View style={[styles.remplie, { width: `${av.pct}%`, backgroundColor: av.enRythme ? p.ok : p.sportCourse }]} />
                      {av.repere != null ? <View style={[styles.repere, { left: `${av.repere}%`, backgroundColor: p.texte }]} /> : null}
                    </View>
                    {av.projection != null ? (
                      <Text style={[typo.petit, { color: (av.projectionPct ?? 0) >= 100 ? p.ok : p.texteDoux }]}>
                        Projection fin d'année : {formatNum(av.projection, av.modele.unit === 'h' ? 1 : 0)}
                        {nomUnite(av.modele.unit)} · {av.projectionPct} % de la cible
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              ) : (
                <Text style={[typo.corps, { color: p.texteDoux }]}>Aucun objectif pour {annee}. Ajoutes-en un : distance annuelle, heures, chrono visé…</Text>
              )}
              <View style={{ marginTop: espace.e3 }}>
                <Bouton variante="discret" onPress={() => bientot("L'ajout d'un objectif")}>
                  Ajouter un objectif
                </Bouton>
              </View>
            </Bloc>

            {records.length ? (
              <Bloc titre={`Records de ${annee}`}>
                {records.map((r, i) => (
                  <View
                    key={r.cle}
                    accessible
                    accessibilityLabel={`${r.libelle}, ${r.cle === 'duree' ? texteHM(Math.round(r.valeur)) : `${formatNum(r.valeur, r.cle === 'distance' ? 1 : 0)} ${r.unite}`}, ${r.nom}, ${formatDateLongue(r.iso)}`}
                    style={[styles.record, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={styles.enteteRecord}>
                      <Text style={[typo.micro, { color: p.texteDoux }]}>{r.libelle}</Text>
                      {recordRecent(r.iso, maintenant) ? (
                        <View style={[styles.nouveau, { backgroundColor: p.sportMuscu }]}>
                          <Text style={[typo.micro, { color: p.encreSurCouleur }]}>Nouveau</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.valeurRecord, { color: p.texte }]}>
                      {r.cle === 'duree' ? texteHM(Math.round(r.valeur)) : formatNum(r.valeur, r.cle === 'distance' ? 1 : 0)}
                      {r.cle !== 'duree' ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {r.unite}</Text> : null}
                    </Text>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{r.nom}</Text>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{formatDateLongue(r.iso)}</Text>
                  </View>
                ))}
              </Bloc>
            ) : null}

            <Bloc titre="Cumul sur 3 ans">
              <View style={styles.bascule} accessibilityRole="tablist">
                {(['distance_km', 'd_plus'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetrique(m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: metrique === m }}
                    style={[styles.pastille, { backgroundColor: metrique === m ? p.surface2 : 'transparent', borderColor: p.contourChamp }]}
                  >
                    <Text style={[typo.petit, { color: metrique === m ? p.texte : p.texteDoux, fontFamily: police.texte600 }]}>{m === 'distance_km' ? 'Distance' : 'Dénivelé'}</Text>
                  </Pressable>
                ))}
              </View>
              <GrapheSeries
                etiquettes={cumul.etiquettes}
                lignes={[
                  { nom: String(annee), valeurs: cumul.series[0].valeurs, couleur: p.texte },
                  { nom: String(annee - 1), valeurs: cumul.series[1].valeurs, couleur: p.texteDoux },
                  { nom: String(annee - 2), valeurs: cumul.series[2].valeurs, couleur: p.texteMuet, pointille: true },
                ]}
                min={0}
                hauteur={190}
                titre={`Cumul ${metrique === 'd_plus' ? 'du dénivelé' : 'de la distance'} sur trois ans`}
                formater={(v) => `${formatNum(v)} ${metrique === 'd_plus' ? 'm' : 'km'}`}
              />
              <View style={styles.cles}>
                {[
                  [String(annee), p.texte],
                  [String(annee - 1), p.texteDoux],
                  [String(annee - 2), p.texteMuet],
                ].map(([nom, couleur]) => (
                  <View key={nom} style={styles.cle}>
                    <View style={[styles.traitCle, { backgroundColor: couleur }]} />
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{nom}</Text>
                  </View>
                ))}
              </View>
            </Bloc>

            <Bloc titre="Volume par mois">
              <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 12 }]}>Heures d'entraînement chaque mois de {annee}.</Text>
              <View accessible accessibilityRole="image" accessibilityLabel={`Heures d'entraînement par mois en ${annee} : ${mensuel.map((h, i) => `${NOMS_MOIS[i]} ${formatNum(h, 1)} heures`).join(', ')}`} style={styles.mois}>
                {mensuel.map((h, i) => (
                  <View key={i} style={styles.col}>
                    <Text style={[typo.micro, styles.val, { color: p.texteDoux }]}>{h >= 1 ? formatNum(h, 0) : ''}</Text>
                    <View style={styles.zoneBarre}>
                      <View style={{ height: `${(h / maxMois) * 100}%`, minHeight: 2, backgroundColor: p.texte, opacity: 0.85, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                    </View>
                    <Text style={[typo.micro, { color: p.texteMuet }]}>{MOIS[i]}</Text>
                  </View>
                ))}
              </View>
            </Bloc>

            <Bloc titre="Répartition par sport">
              <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 12 }]}>Part du temps d'entraînement de {annee}.</Text>
              {repartition.length ? (
                repartition.map((r) => (
                  <View key={r.sport} accessible accessibilityLabel={`${NOM_SPORT_BILAN[r.sport]}, ${formatNum(r.heures, 0)} heures, ${r.part} pour cent`} style={styles.ligneRepartition}>
                    <Text style={[typo.petit, { color: p.texte, width: 104 }]}>{NOM_SPORT_BILAN[r.sport]}</Text>
                    <View style={[styles.piste, { backgroundColor: avecAlpha(p.texte, 0.1) }]}>
                      <View style={{ width: `${r.part}%`, height: '100%', backgroundColor: p.texte, opacity: 0.85, borderRadius: 4 }} />
                    </View>
                    <Text style={[typo.petit, { color: p.texteDoux, width: 78, textAlign: 'right' }]}>
                      {formatNum(r.heures, 0)} h · {r.part} %
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore d'activité en {annee}.</Text>
              )}
            </Bloc>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titreInvisible: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  annees: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e2 },
  pastille: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e3 },
  tuile: { width: '48%', flexGrow: 1, borderRadius: rayon.base, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  valeur: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36, marginTop: 4, fontVariant: ['tabular-nums'] },
  delta: { fontFamily: police.texte600, marginTop: 2 },
  objectif: { paddingVertical: 12, gap: 6 },
  tete: { flexDirection: 'row', alignItems: 'baseline' },
  barre: { height: 10, borderRadius: 5, overflow: 'visible', justifyContent: 'center' },
  remplie: { height: '100%', borderRadius: 5 },
  repere: { position: 'absolute', top: -3, bottom: -3, width: 2 },
  record: { paddingVertical: 12, gap: 2 },
  enteteRecord: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nouveau: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  valeurRecord: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36, fontVariant: ['tabular-nums'] },
  bascule: { flexDirection: 'row', gap: espace.e2, marginBottom: espace.e3 },
  cles: { flexDirection: 'row', gap: 16, marginTop: 10 },
  cle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  traitCle: { width: 16, height: 3, borderRadius: 2 },
  mois: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150 },
  col: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  val: { height: 16 },
  zoneBarre: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  ligneRepartition: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  piste: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
});
