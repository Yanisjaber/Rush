import { FondDegrade } from '@/components/FondDegrade';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bientot } from '@/actions/bientot';
import { BarreSports } from '@/components/BarreSports';
import { BarresHebdo } from '@/components/BarresHebdo';
import { BarresMois } from '@/components/BarresMois';
import { CarteChaleur } from '@/components/CarteChaleur';
import { Dossard } from '@/components/Dossard';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { MenuMesure } from '@/components/MenuMesure';
import { CumulAnnees } from '@/components/CumulAnnees';
import { AnneauRepartition } from '@/components/AnneauRepartition';
import { IconeSport } from '@/components/IconeSport';
import { ObjectifSegments } from '@/components/ObjectifSegments';
import { OngletsIcones } from '@/components/OngletsIcones';
import type { IconeOnglet } from '@/components/OngletsIcones.types';
import {
  activitesAnnee, anneesDisponibles, avancement, chargeParSemaine, cumulParAnnee, kmParMois, MESURES_CUMUL, NOM_SPORT_BILAN, normaliser, recordRecent, recordsVolume,
  regulariteAnnee, repartitionSport, sommer, volumeMensuel, familleBilanDuFiltre, type MetriqueCumul,
} from '@/data/bilan';
import { formatDateLongue, formatNum, texteHM } from '@/data/format';
import { useDonneesBilan } from '@/hooks/useDonneesBilan';
import { useMenu } from '@/stores/menu';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const BARRE_ONGLETS = 72;
type OngletBilan = 'resume' | 'rythme' | 'records';
const ONGLETS: { cle: OngletBilan; nom: string; icone: IconeOnglet }[] = [
  { cle: 'resume', nom: 'Résumé', icone: 'resume' },
  { cle: 'rythme', nom: 'Rythme', icone: 'rythme' },
  { cle: 'records', nom: 'Records', icone: 'records' },
];
const nomUnite = (u: string) => (u ? ` ${u}` : '');
// Famille de bilan d'un objectif → famille de couleur de l'app (la couleur désigne le sport)
const FAMILLE_COULEUR: Record<string, string> = { cyclisme: 'velo', course: 'course', natation: 'natation', musculation: 'muscu', autre: 'autre' };

// Le bilan d'une année, en trois onglets : Résumé (une phrase, les objectifs, cumul sur 3 ans, répartition), Rythme (mois, semaines, régularité) et Records.
// Lecture seule pour l'instant : ajouter ou modifier un objectif arrive avec son panneau.
export default function Bilan() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre } = useMenu();
  const maintenant = useMemo(() => new Date(), []);
  const [anneeChoisie, setAnneeChoisie] = useState(maintenant.getFullYear());
  const [onglet, setOnglet] = useState<OngletBilan>('resume');
  const [metrique, setMetrique] = useState<MetriqueCumul>('distance_km');
  const [mesureRepartition, setMesureRepartition] = useState<MetriqueCumul>('heures'); // la mesure de la répartition par sport (le temps par défaut)
  const { brutes, objectifs, chargement, erreur, pret, actualisation, recharger } = useDonneesBilan();
  const annee = anneeChoisie;

  const toutes = useMemo(() => brutes.map(normaliser), [brutes]);
  const annees = useMemo(() => anneesDisponibles(toutes, maintenant), [toutes, maintenant]);
  // Le filtre global de sport concerne les chiffres, records et graphiques ; pas les objectifs annuels
  const filtrees = useMemo(() => (filtre === 'tout' ? toutes : toutes.filter((a) => a.famille === filtre)), [toutes, filtre]);

  const courant = sommer(activitesAnnee(filtrees, annee, maintenant));
  // Le grand chiffre : la distance de l'année (ou les séances quand le sport n'a pas de distance, comme la musculation), puis trois chiffres en colonnes
  const enCours = annee === maintenant.getFullYear();
  const grand =
    courant.seances === 0
      ? null
      : courant.distance > 0
        ? { val: formatNum(courant.distance, 0), unite: 'km' }
        : { val: formatNum(courant.seances, 0), unite: courant.seances > 1 ? 'séances' : 'séance' };
  const colonnes = [
    courant.heures > 0 ? { cle: 'heures', libelle: 'Temps', val: formatNum(courant.heures, 0), unite: 'h' } : null,
    courant.distance > 0 && courant.seances > 0 ? { cle: 'seances', libelle: 'Séances', val: formatNum(courant.seances, 0), unite: '' } : null,
    courant.tss > 0 ? { cle: 'effort', libelle: 'Effort', val: formatNum(courant.tss, 0), unite: '' } : null,
  ].filter((x): x is { cle: string; libelle: string; val: string; unite: string } => !!x);

  const familleFiltre = familleBilanDuFiltre(filtre);
  // Sur un onglet de sport, seulement les objectifs de ce sport : ceux « tous sports » n'apparaissent que sur l'onglet Tous
  const objectifsAnnee = objectifs.filter((o) => o.annee === annee && (!familleFiltre || o.sport === familleFiltre));
  const avancements = objectifsAnnee.map((o) => ({ objectif: o, av: avancement(o, toutes, annee, maintenant) })).filter((x): x is { objectif: typeof x.objectif; av: NonNullable<typeof x.av> } => !!x.av);

  const records = recordsVolume(activitesAnnee(filtrees, annee, maintenant));
  const cumul = cumulParAnnee(filtrees, [annee, annee - 1, annee - 2], metrique, maintenant);
  const mesure = MESURES_CUMUL.find((m) => m.cle === metrique) ?? MESURES_CUMUL[0];
  // Rythme : par mois (en km, ou en heures quand le sport n'a pas de distance, comme la musculation), charge par semaine, régularité
  const enKm = courant.distance > 0;
  const parMois = enKm ? kmParMois(filtrees, annee) : volumeMensuel(filtrees, annee);
  const moisEnCours = annee === maintenant.getFullYear() ? maintenant.getMonth() : null;
  const dernierMois = moisEnCours ?? 11;
  const meilleurMois = Math.max(0, ...parMois);
  const semaines = chargeParSemaine(filtrees, annee, maintenant);
  const moyenneSemaine = Math.round(semaines.reduce((a, b) => a + b, 0) / semaines.length);
  const regularite = regulariteAnnee(filtrees, annee, maintenant);
  const seancesParSemaine = (n: number) => (regularite.jours ? n / (regularite.jours / 7) : 0);
  const repartition = repartitionSport(activitesAnnee(toutes, annee, maintenant), mesureRepartition);
  const mesureRep = MESURES_CUMUL.find((m) => m.cle === mesureRepartition) ?? MESURES_CUMUL[0];

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
        <View style={styles.entete}>
          <MenuMesure grand etiquette="Année" valeur={String(annee)} options={annees.map((a) => ({ cle: String(a), nom: String(a) }))} onChoisir={(c) => setAnneeChoisie(Number(c))} />
          <OngletsIcones onglets={ONGLETS} actuel={onglet} onChoisir={setOnglet} etiquette="Parties du bilan" />
        </View>

        {chargement ? (
          <View accessible accessibilityLabel="Chargement du bilan" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : (
          <>
            {erreur ? (
              <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
                <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
                <Bouton variante="discret" onPress={() => void recharger()}>
                  Réessayer
                </Bouton>
              </View>
            ) : null}
            {pret && onglet === 'resume' ? (
              <>
                {grand ? (
                  <Dossard etiquette={enCours ? 'Depuis janvier' : `En ${annee}`} valeur={grand.val} uniteValeur={grand.unite} sport={filtre !== 'tout' ? filtre : undefined} chiffreMax={44}>
                    {colonnes.length ? (
                      <View style={[styles.colonnesDossard, { borderTopColor: avecAlpha(p.dossardTexte, 0.28) }]}>
                        {colonnes.map((c) => (
                          <View key={c.cle} accessible style={{ width: `${100 / colonnes.length}%`, gap: 2 }}>
                            <Text style={[typo.micro, { color: p.dossardTexte, opacity: 0.62 }]}>{c.libelle}</Text>
                            <Text style={[styles.valeurColonne, { color: p.dossardTexte }]}>
                              {c.val}
                              {c.unite ? <Text style={[typo.petit, { color: p.dossardTexte, opacity: 0.62 }]}> {c.unite}</Text> : null}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Dossard>
                ) : (
                  <Text style={[typo.titre2, { color: p.texte }]}>Pas encore d'activité en {annee}.</Text>
                )}

                <View>
                  <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
                    Objectifs de {annee}
                  </Text>
                  {avancements.length ? (
                    <View style={styles.pistes}>
                      {avancements.map(({ objectif, av }) => {
                        const dec = av.modele.unit === 'h' ? 1 : 0;
                        const unite = nomUnite(av.modele.unit);
                        const couleur = objectif.sport === 'tous' ? p.texte : couleurSport(p, FAMILLE_COULEUR[objectif.sport]);
                        // En gros : ce que mesure l'objectif ; en petit : son sport (« Tous » pour un objectif tous sports)
                        const nom = av.modele.label;
                        const sport = objectif.sport === 'tous' ? 'Tous' : NOM_SPORT_BILAN[objectif.sport];
                        return (
                          <Pressable
                            key={objectif.id}
                            onPress={() => bientot("La modification d'un objectif")}
                            accessibilityRole="button"
                            accessibilityLabel={`${nom}, ${sport}, ${av.actuel == null ? 'valeur inconnue' : `${Math.round(av.pct)} pour cent`}. Modifier l'objectif`}
                            style={styles.caseObjectif}
                          >
                            <ObjectifSegments
                              nom={nom}
                              detail={sport}
                              famille={objectif.sport === 'tous' ? undefined : FAMILLE_COULEUR[objectif.sport]}
                              couleur={couleur}
                              pct={av.actuel == null ? null : av.pct}
                              attendu={av.repere != null && av.repere < 100 ? av.repere : null}
                              fait={av.actuel == null ? '—' : formatNum(av.actuel, av.modele.unit === 'h' || av.modele.unit === 'W/kg' ? 1 : 0)}
                              cible={`${formatNum(av.cible, dec)}${unite}`}
                              etiquette={`${nom}, ${sport} : ${av.actuel == null ? 'valeur inconnue' : `${Math.round(av.pct)} pour cent`}`}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[typo.corps, { color: p.texteDoux, marginTop: espace.e3 }]}>Aucun objectif</Text>
                  )}
                  <View style={{ marginTop: espace.e3 }}>
                    <Bouton variante="discret" onPress={() => bientot("L'ajout d'un objectif")}>
                      Ajouter un objectif
                    </Bouton>
                  </View>
                </View>

                <Bloc>
                  <View style={styles.enteteBloc}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      Cumul sur 3 ans
                    </Text>
                    <MenuMesure etiquette="Mesure" valeur={metrique} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => setMetrique(c as MetriqueCumul)} />
                  </View>
                  <CumulAnnees
                    series={cumul.series}
                    enCours={enCours}
                    formater={(v) => `${formatNum(v)} ${mesure.unite}`}
                    titre={`Cumul ${mesure.phrase} sur trois ans`}
                  />
                </Bloc>

                <Bloc>
                  <View style={styles.enteteBloc}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      Répartition par sport
                    </Text>
                    <MenuMesure etiquette="Mesure de la répartition" valeur={mesureRepartition} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => setMesureRepartition(c as MetriqueCumul)} />
                  </View>
                  <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 12 }]}>Part {mesureRep.phrase} de {annee}.</Text>
                  {repartition.length ? (
                    <View
                      accessible
                      accessibilityLabel={`Répartition par sport : ${repartition.map((r) => `${NOM_SPORT_BILAN[r.sport]}, ${formatNum(r.valeur, 0)} ${mesureRep.unite}, ${r.part} pour cent`).join(' ; ')}`}
                      style={styles.repartition}
                    >
                      <AnneauRepartition
                        parts={repartition.map((r) => ({ cle: r.sport, couleur: couleurSport(p, FAMILLE_COULEUR[r.sport]), valeur: r.valeur }))}
                        taille={132}
                        epaisseur={18}
                        piste={p.surface2}
                        etiquette="Anneau de la répartition du temps par sport"
                      >
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[styles.totalAnneau, { color: p.texte }]}>
                          {formatNum(repartition.reduce((t, r) => t + r.valeur, 0), 0)}
                        </Text>
                        <Text style={[typo.petit, { color: p.texteDoux }]}>{mesureRep.unite === 'h' ? 'heures' : mesureRep.unite}</Text>
                      </AnneauRepartition>
                      <View style={styles.legendeRepartition}>
                        {repartition.map((r) => (
                          <View key={r.sport} style={styles.ligneRepartition}>
                            <IconeSport sport={FAMILLE_COULEUR[r.sport]} taille={16} />
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
                                {NOM_SPORT_BILAN[r.sport]}
                              </Text>
                              {/* La stat elle-même (281 h, 3 120 km…), en plus du pourcentage */}
                              <Text numberOfLines={1} style={[typo.micro, { color: p.texteMuet }]}>
                                {formatNum(r.valeur, 0)} {mesureRep.unite}
                              </Text>
                            </View>
                            <Text style={[typo.petit, { color: p.texte, fontFamily: police.titre700 }]}>{r.part} %</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore d'activité en {annee}.</Text>
                  )}
                </Bloc>
              </>
            ) : null}

            {pret && onglet === 'rythme' ? (
              <>
                <Bloc titre={enKm ? 'Distance par mois' : 'Heures par mois'}>
                  <BarresMois
                    valeurs={parMois}
                    moisEnCours={moisEnCours}
                    dernierMois={dernierMois}
                    formater={(v) => formatNum(v, 0)}
                    etiquette={`${enKm ? 'Kilomètres' : "Heures d'entraînement"} par mois en ${annee} : ${parMois.map((v, i) => `${NOMS_MOIS[i]} ${formatNum(v, enKm ? 0 : 1)}`).join(', ')}. Meilleur mois : ${formatNum(meilleurMois, enKm ? 0 : 1)} ${enKm ? 'kilomètres' : 'heures'}.`}
                  />
                </Bloc>

                <Bloc titre="Charge par semaine">
                  <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 12 }]}>
                    TSS des 12 dernières semaines · moyenne {formatNum(moyenneSemaine, 0)}.
                  </Text>
                  <BarresHebdo
                    valeurs={semaines}
                    couleur={p.texte}
                    repere={moyenneSemaine}
                    hauteur={110}
                    etiquette={`Charge des 12 dernières semaines : ${semaines.map((v) => formatNum(v, 0)).join(', ')}. Moyenne ${formatNum(moyenneSemaine, 0)}.`}
                  />
                </Bloc>

                <Bloc titre="Régularité">
                  <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 12 }]}>Une case par jour. Sa couleur est celle du sport du jour, plus elle est vive plus la charge est forte.</Text>
                  <CarteChaleur
                    cases={regularite.cases}
                    colonnes={regularite.colonnes}
                    ecart={1}
                    hauteurCase={6}
                    etiquette={`Carte des jours d'entraînement de ${annee} : ${regularite.joursActifs} jours actifs sur ${regularite.jours}`}
                  />
                  <View style={styles.serie}>
                    {[
                      moisEnCours != null
                        ? { libelle: 'Série en cours', val: String(regularite.serieEnCours), unite: regularite.serieEnCours > 1 ? 'jours' : 'jour', note: `record : ${regularite.serieRecord}` }
                        : { libelle: 'Plus longue série', val: String(regularite.serieRecord), unite: regularite.serieRecord > 1 ? 'jours' : 'jour', note: `en ${annee}` },
                      { libelle: 'Jours actifs', val: String(regularite.joursActifs), unite: `/ ${regularite.jours}`, note: `${regularite.jours ? Math.round((regularite.joursActifs / regularite.jours) * 100) : 0} % des jours` },
                      {
                        libelle: 'Par semaine',
                        val: formatNum(seancesParSemaine(courant.seances), 1),
                        unite: 'séances',
                        note: '',
                      },
                    ].map((c) => (
                      <View key={c.libelle} accessible style={styles.statSerie}>
                        <Text style={[typo.micro, { color: p.texteDoux }]}>{c.libelle}</Text>
                        <Text style={[styles.valeurSerie, { color: p.texte }]}>
                          {c.val}
                          <Text style={[typo.micro, { color: p.texteDoux }]}> {c.unite}</Text>
                        </Text>
                        {c.note ? <Text style={[typo.petit, { color: p.texteMuet }]}>{c.note}</Text> : null}
                      </View>
                    ))}
                  </View>
                </Bloc>

              </>
            ) : null}

            {pret && onglet === 'records' ? (
              <>
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
                ) : (
                  <Bloc titre={`Records de ${annee}`}>
                    <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record en {annee}.</Text>
                  </Bloc>
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titreInvisible: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { gap: espace.e2, borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  colonnesDossard: { flexDirection: 'row', borderTopWidth: 1.5, borderStyle: 'dashed', paddingTop: espace.e2, marginTop: -espace.e2 },
  valeurColonne: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  pistes: { marginTop: espace.e3 },
  caseObjectif: { paddingVertical: espace.e3, minHeight: 44 },
  record: { paddingVertical: 12, gap: 2 },
  enteteRecord: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nouveau: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  valeurRecord: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36, fontVariant: ['tabular-nums'] },
  enteteBloc: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, marginBottom: espace.e3 },
  serie: { flexDirection: 'row', gap: espace.e3, marginTop: espace.e3 },
  statSerie: { flex: 1, gap: 2 },
  valeurSerie: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
  repartition: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  // Le total tient dans le trou de l'anneau (132 − 2 × 18 = 96 pt, moins une marge) : un grand nombre (22 535 TSS) rétrécit au lieu de toucher les parts
  totalAnneau: { width: 78, textAlign: 'center', fontFamily: police.titre800, fontSize: 28, lineHeight: 30, fontVariant: ['tabular-nums'] },
  legendeRepartition: { flex: 1, gap: 2 },
  ligneRepartition: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
});
