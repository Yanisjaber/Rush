import { FondDegrade } from '@/components/ui/FondDegrade';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarreSports } from '@/components/graphes/BarreSports';
import { BarresHebdo } from '@/components/graphes/BarresHebdo';
import { BarresMois } from '@/components/graphes/BarresMois';
import { CarteChaleur } from '@/components/graphes/CarteChaleur';
import { Dossard } from '@/components/ui/Dossard';
import { Bloc } from '@/components/feuilles/Bloc';
import { Bouton } from '@/components/ui/Bouton';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { CumulAnnees } from '@/components/graphes/CumulAnnees';
import { IconeSport } from '@/components/ui/IconeSport';
import { ObjectifSegments } from '@/components/graphes/ObjectifSegments';
import { OngletsIcones } from '@/components/menus/OngletsIcones';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { TraitTirets } from '@/components/graphes/TraitTirets';
import { ProgresSport } from '@/components/graphes/ProgresSport';
import type { IconeOnglet } from '@/components/menus/OngletsIcones.types';
import {
  activitesAnnee, anneesDisponibles, avancement, chargeParSemaine, cumulParAnnee, valeursParMois, MESURES_CUMUL, NOM_SPORT_BILAN, normaliser, recordRecent, recordsVolume,
  regulariteAnnee, repartitionSport, sommer, familleBilanDuFiltre, decimalesObjectif, phraseVerdict, type MetriqueCumul,
} from '@/data/bilan/bilan';
import { formatDateLongue, formatNum, texteHM } from '@/data/outils/format';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { courbeProgression, PERIODES_PROGRESSION, progressionTousSports, type PeriodeProgression } from '@/data/bilan/progression';
import { useDonneesBilan } from '@/hooks/useDonneesBilan';
import { useHistoriqueProgression, useSeriesForceProgression } from '@/hooks/useHistoriqueProgression';
import { useReferences } from '@/hooks/useReferences';
import { useMenu } from '@/stores/menu';
import { choisirMesure, useMesuresBilan } from '@/stores/mesures-bilan';
import { choisirPeriodeProgression, usePeriodeProgression } from '@/stores/progression';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const BARRE_ONGLETS = 72;
type OngletBilan = 'resume' | 'rythme' | 'records' | 'progres';
const ONGLETS: { cle: OngletBilan; nom: string; icone: IconeOnglet }[] = [
  { cle: 'resume', nom: 'Résumé', icone: 'resume' },
  { cle: 'rythme', nom: 'Rythme', icone: 'rythme' },
  { cle: 'records', nom: 'Records', icone: 'records' },
  { cle: 'progres', nom: 'Progrès', icone: 'progres' },
];
const nomUnite = (u: string) => (u ? ` ${u}` : '');
// Famille de bilan d'un objectif → famille de couleur de l'app (la couleur désigne le sport)
const FAMILLE_COULEUR: Record<string, string> = { cyclisme: 'velo', course: 'course', natation: 'natation', musculation: 'muscu', hyrox: 'hyrox', triathlon: 'triathlon', duathlon: 'duathlon', autre: 'autre' };

// Le bilan d'une année, en trois onglets : Résumé (une phrase, les objectifs, cumul sur 3 ans, répartition), Rythme (mois, semaines, régularité) et Records.
// Toucher un objectif l'ouvre pour le modifier ou le supprimer ; « Ajouter un objectif » en crée un (écran « objectif »). Toucher un record ouvre sa séance.
export default function Bilan() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const { filtre } = useMenu();
  // « Aujourd'hui » : l'onglet reste ouvert en arrière-plan, donc on le remet à jour en revenant sur l'écran ou dans l'app (minuit, Nouvel An)
  const [maintenant, setMaintenant] = useState(() => new Date());
  const actualiserDate = useCallback(() => {
    const m = new Date();
    setMaintenant((avant) => (avant.toDateString() === m.toDateString() ? avant : m));
  }, []);
  useFocusEffect(actualiserDate);
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') actualiserDate();
    });
    return () => abonnement.remove();
  }, [actualiserDate]);
  const [anneeChoisie, setAnneeChoisie] = useState(maintenant.getFullYear());
  // Nouvel An pendant que l'onglet est ouvert : si on regardait l'année qui vient de finir (l'« année en cours »), on passe à la nouvelle
  const anneeCourante = maintenant.getFullYear();
  const anneeVue = useRef(anneeCourante);
  useEffect(() => {
    if (anneeVue.current === anneeCourante) return;
    const ancienne = anneeVue.current;
    anneeVue.current = anneeCourante;
    setAnneeChoisie((choisie) => (choisie === ancienne ? anneeCourante : choisie));
  }, [anneeCourante]);
  const [onglet, setOnglet] = useState<OngletBilan>('resume');
  // Les mesures des menus (distance, temps…) : gardées tant que l'app n'est pas fermée, voir stores/mesures-bilan
  const mesures = useMesuresBilan();
  const metrique = mesures.cumul;
  const mesureRepartition = mesures.repartition;
  const { brutes, objectifs, chargement, erreur, pret, actualisation, recharger } = useDonneesBilan();
  const annee = anneeChoisie;
  // Progrès : l'historique long et le carnet de force ne se chargent qu'à la première ouverture de l'onglet
  const joursProgres = usePeriodeProgression();
  const progresOuvert = onglet === 'progres';
  const historique = useHistoriqueProgression(brutes, progresOuvert);
  const carnet = useSeriesForceProgression(progresOuvert);
  const { hrMax } = useReferences(); // la même FC max que le widget de l'accueil : sinon les deux ne diraient pas la même chose

  const toutes = useMemo(() => brutes.map(normaliser), [brutes]);
  const annees = useMemo(() => anneesDisponibles(toutes, maintenant), [toutes, maintenant]);
  // Le filtre global de sport concerne les chiffres, records et graphiques ; pas les objectifs annuels
  const filtrees = useMemo(() => (filtre === 'tout' ? toutes : toutes.filter((a) => a.famille === filtre)), [toutes, filtre]);

  const courant = useMemo(() => sommer(activitesAnnee(filtrees, annee, maintenant)), [filtrees, annee, maintenant]);
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
    courant.tss > 0 ? { cle: 'effort', libelle: 'Charge', val: formatNum(courant.tss, 0), unite: '' } : null,
  ].filter((x): x is { cle: string; libelle: string; val: string; unite: string } => !!x);

  const familleFiltre = familleBilanDuFiltre(filtre);
  // Sur un onglet de sport, seulement les objectifs de ce sport : ceux « tous sports » n'apparaissent que sur l'onglet Tous
  const avancements = useMemo(() => {
    if (onglet !== 'resume') return [];
    return objectifs
      .filter((o) => o.annee === annee && (!familleFiltre || o.sport === familleFiltre))
      .map((o) => ({ objectif: o, av: avancement(o, toutes, annee, maintenant) }))
      .filter((x): x is { objectif: (typeof objectifs)[number]; av: NonNullable<typeof x.av> } => !!x.av);
  }, [onglet, objectifs, annee, familleFiltre, toutes, maintenant]);

  // Chaque onglet ne calcule que ses propres chiffres, et seulement quand ses données changent
  const records = useMemo(() => (onglet === 'records' ? recordsVolume(activitesAnnee(filtrees, annee, maintenant)) : []), [onglet, filtrees, annee, maintenant]);
  const cumul = useMemo(() => (onglet === 'resume' ? cumulParAnnee(filtrees, [annee, annee - 1, annee - 2], metrique, maintenant) : { etiquettes: [], series: [] }), [onglet, filtrees, annee, metrique, maintenant]);
  const mesure = MESURES_CUMUL.find((m) => m.cle === metrique) ?? MESURES_CUMUL[0];
  // Rythme : par mois (en km, ou en heures quand le sport n'a pas de distance, comme la musculation), charge par semaine, régularité
  const enKm = courant.distance > 0;
  const mesureMois: MetriqueCumul = mesures.mois ?? (enKm ? 'distance_km' : 'heures');
  const mesureSemaine: MetriqueCumul = mesures.semaine ?? (enKm ? 'distance_km' : 'heures');
  const mesureM = MESURES_CUMUL.find((m) => m.cle === mesureMois) ?? MESURES_CUMUL[0];
  const decimalesMois = mesureMois === 'heures' ? 1 : 0;
  // L'unité écrite sur les graphiques : « km », « m », « TSS », « h » ; pour les séances, le titre le dit déjà
  const uniteGraphe = (m: { unite: string }) => (m.unite === 'séances' ? '' : m.unite);
  const mesureS = MESURES_CUMUL.find((m) => m.cle === mesureSemaine) ?? MESURES_CUMUL[0];
  const decimalesSemaine = mesureSemaine === 'heures' || mesureSemaine === 'seances' ? 1 : 0;
  const moisEnCours = annee === maintenant.getFullYear() ? maintenant.getMonth() : null;
  const dernierMois = moisEnCours ?? 11;
  const rythme = useMemo(() => {
    if (onglet !== 'rythme') return null;
    const parMois = valeursParMois(filtrees, annee, mesureMois);
    const semaines = chargeParSemaine(filtrees, annee, maintenant, 52, mesureSemaine);
    // La semaine en cours n'est pas finie : elle ne compte pas dans la moyenne (sinon celle-ci est tirée vers le bas)
    const completes = enCours ? semaines.slice(0, -1) : semaines;
    return { parMois, meilleurMois: Math.max(0, ...parMois), semaines, moyenneSemaine: completes.reduce((a, b) => a + b, 0) / completes.length, regularite: regulariteAnnee(filtrees, annee, maintenant) };
  }, [onglet, filtrees, annee, maintenant, mesureMois, mesureSemaine, enCours]);
  const repartition = useMemo(() => (onglet === 'resume' ? repartitionSport(activitesAnnee(filtrees, annee, maintenant), mesureRepartition, filtre !== 'tout') : []), [onglet, filtre, filtrees, annee, maintenant, mesureRepartition]);
  // `court` : pour le gros chiffre du haut, le mot « séances » est de trop (le libellé dessous le dit déjà)
  const texteRep = (v: number, court = false): string =>
    mesureRep.unite === 'h' ? texteHM(Math.round(v * 60)) : court && mesureRep.unite === 'séances' ? formatNum(v, 0) : `${formatNum(v, 0)} ${mesureRep.unite}`;
  const dense = repartition.length > 6; // beaucoup de sports : lignes et barres plus serrées
  const mesureRep = MESURES_CUMUL.find((m) => m.cle === mesureRepartition) ?? MESURES_CUMUL[0];
  // Les valeurs de l'onglet Rythme : elles n'existent que sur cet onglet (l'affichage plus bas est gardé par `rythme`)
  const { parMois, meilleurMois, semaines, moyenneSemaine, regularite } = rythme ?? ({} as NonNullable<typeof rythme>);
  const seancesParSemaine = (n: number) => (regularite?.jours ? n / (regularite.jours / 7) : 0);
  const heuresParSemaine = seancesParSemaine; // même calcul : une quantité divisée par le nombre de semaines écoulées
  // Les trois chiffres en haut de l'onglet Rythme
  const statsRythme: { libelle: string; val: string; unite: string; note: string }[] = regularite ? [
                      { libelle: 'Par semaine', val: texteHM(Math.round(heuresParSemaine(courant.heures) * 60)), unite: '', note: '' },
                      { libelle: 'Jours actifs', val: String(regularite.joursActifs), unite: `/ ${regularite.jours}`, note: '' },
                      {
                        libelle: 'Par semaine',
                        val: formatNum(seancesParSemaine(courant.seances), 1),
                        unite: 'séances',
                        note: '',
                      },
                    ] : [];
  // Un bloc par sport mesurable : celui du filtre, ou tous ceux que tu pratiques sur « Tout »
  const progres = useMemo(() => {
    if (!progresOuvert) return [];
    const familles = filtre === 'tout' ? [...new Set(toutes.map((a) => a.famille)), ...(carnet.series.length ? ['muscu'] : [])] : [filtre];
    const donnees = { seances: historique.seances, series: carnet.series, hrMax: hrMax ?? null };
    return progressionTousSports(familles, donnees, joursProgres, maintenant).map((prog) => ({ prog, courbe: courbeProgression(prog.famille, donnees, joursProgres, maintenant) }));
  }, [progresOuvert, filtre, toutes, historique.seances, carnet.series, hrMax, joursProgres, maintenant]);

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
          {/* Progrès suit ses propres périodes (4 semaines, 3 mois, 1 an) : l'année n'y sert à rien. Elle reste affichée mais grisée et non touchable, pour que les onglets ne bougent pas */}
          <View style={onglet === 'progres' ? styles.anneeMasquee : undefined} pointerEvents={onglet === 'progres' ? 'none' : 'auto'} accessibilityElementsHidden={onglet === 'progres'} importantForAccessibility={onglet === 'progres' ? 'no-hide-descendants' : 'auto'}>
            <MenuMesure grand etiquette="Année" valeur={String(annee)} options={annees.map((a) => ({ cle: String(a), nom: String(a) }))} onChoisir={(c) => setAnneeChoisie(Number(c))} />
          </View>
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
                      <View style={styles.separateurDossard}>
                        <TraitTirets couleur={avecAlpha(p.dossardTexte, 0.28)} epaisseur={1.5} />
                        <View style={styles.colonnesDossard}>
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
                        const dec = decimalesObjectif(av.modele.unit);
                        const unite = nomUnite(av.modele.unit);
                        const couleur = objectif.sport === 'tous' ? p.texte : couleurSport(p, FAMILLE_COULEUR[objectif.sport]);
                        // En gros : ce que mesure l'objectif ; en petit : son sport (« Tous » pour un objectif tous sports)
                        const nom = av.modele.label;
                        const sport = objectif.sport === 'tous' ? 'Tous' : NOM_SPORT_BILAN[objectif.sport];
                        const verdict = phraseVerdict(av, (v) => formatNum(v, dec));
                        const repere = av.repere != null && av.repere < 100 ? `, tu devrais être à ${Math.round(av.repere)} pour cent` : '';
                        const lu = `${nom}, ${sport} : ${av.actuel == null ? 'valeur inconnue' : `${Math.round(av.pct)} pour cent${repere}`}${verdict.texte ? `. ${verdict.texte}` : ''}`;
                        return (
                          <Pressable
                            key={objectif.id}
                            onPress={() =>
                              router.push({
                                pathname: '/objectif',
                                params: { id: objectif.id, annee: String(annee), sport: objectif.sport, template: objectif.template, cible: String(objectif.target), actuel: objectif.currentManual != null ? String(objectif.currentManual) : '' },
                              })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`${lu}. Modifier l'objectif`}
                            style={styles.caseObjectif}
                          >
                            <ObjectifSegments
                              nom={nom}
                              detail={sport}
                              famille={objectif.sport === 'tous' ? undefined : FAMILLE_COULEUR[objectif.sport]}
                              couleur={couleur}
                              pct={av.actuel == null ? null : av.pct}
                              attendu={av.repere != null && av.repere < 100 ? av.repere : null}
                              fait={av.actuel == null ? '—' : formatNum(av.actuel, dec)}
                              cible={`${formatNum(av.cible, dec)}${unite}`}
                              etiquette={lu}
                              verdict={verdict}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[typo.corps, { color: p.texteDoux, marginTop: espace.e3 }]}>Aucun objectif</Text>
                  )}
                  <View style={{ marginTop: espace.e3 }}>
                    <Bouton variante="discret" onPress={() => router.push({ pathname: '/objectif', params: { annee: String(annee), ...(familleFiltre ? { sport: familleFiltre } : {}) } })}>
                      Ajouter un objectif
                    </Bouton>
                  </View>
                </View>

                <Bloc>
                  <View style={styles.enteteBloc}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      Cumul sur 3 ans
                    </Text>
                    <MenuMesure etiquette="Mesure" valeur={metrique} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('cumul', c as MetriqueCumul)} />
                  </View>
                  <CumulAnnees
                    series={cumul.series}
                    enCours={enCours}
                    formater={(v) => `${formatNum(v)} ${mesure.unite}`}
                    titre={`Cumul ${mesure.phrase} sur trois ans`}
                  />
                </Bloc>

                {/* Sur « Tous » : les sports entre eux ; sur un sport : ses disciplines (route, VTT…), et rien s'il n'en a qu'une */}
                {filtre === 'tout' || repartition.length > 1 ? (
                  <Bloc>
                    <View style={styles.enteteBloc}>
                      <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                        {filtre === 'tout' ? 'Répartition par sport' : 'Répartition par discipline'}
                      </Text>
                      <MenuMesure etiquette="Mesure de la répartition" valeur={mesureRepartition} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('repartition', c as MetriqueCumul)} />
                    </View>
                    {repartition.length ? (
                      <View style={[styles.statsRepartition, { borderColor: p.trait }]}>
                        <View style={styles.statRepartition}>
                          <Text style={[styles.valeurSerie, { color: p.texte }]}>{texteRep(repartition.reduce((t, r) => t + r.valeur, 0), true)}</Text>
                          <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none' }]}>{mesureRep.nom} en {annee}</Text>
                        </View>
                        <View style={[styles.statRepartition, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.trait }]}>
                          <Text style={[styles.valeurSerie, { color: p.texte }]}>{repartition.length}</Text>
                          <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none' }]}>{filtre === 'tout' ? (repartition.length > 1 ? 'Sports' : 'Sport') : 'Disciplines'}</Text>
                        </View>
                      </View>
                    ) : null}
                    {repartition.length ? (
                      <View
                        accessible
                        accessibilityLabel={`${filtre === 'tout' ? 'Répartition par sport' : 'Répartition par discipline'} : ${repartition.map((r) => `${r.type ? nomDuType(r.type) : NOM_SPORT_BILAN[r.sport]}, ${texteRep(r.valeur)}, ${r.part} pour cent`).join(' ; ')}`}
                        style={{ gap: dense ? 8 : 14 }}
                      >
                        {repartition.map((r) => (
                          <View key={r.cle} style={{ gap: 4 }}>
                            <View style={styles.ligneRepartition}>
                              <IconeSport sport={r.type ?? FAMILLE_COULEUR[r.sport]} taille={16} />
                              <Text numberOfLines={1} style={[typo.petit, { color: p.texte, flex: 1 }]}>
                                {r.type ? nomDuType(r.type) : NOM_SPORT_BILAN[r.sport]}
                              </Text>
                              {/* La stat elle-même (281 h, 3 120 km…), en plus du pourcentage */}
                              <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none' }]}>
                                {texteRep(r.valeur)}
                              </Text>
                              <Text style={[typo.petit, { color: p.texte, fontFamily: police.titre700, minWidth: 46, textAlign: 'right' }]}>{r.part === 0 ? '< 1 %' : `${r.part} %`}</Text>
                            </View>
                            {/* La barre la plus longue est le sport n°1 : on compare les sports entre eux */}
                            <View style={[styles.pisteRepartition, { backgroundColor: p.surface2, height: dense ? 5 : 9 }]}>
                              <View style={{ width: `${Math.max((r.valeur / repartition[0].valeur) * 100, 1)}%`, height: '100%', borderRadius: 3, backgroundColor: couleurSport(p, r.type ?? FAMILLE_COULEUR[r.sport]) }} />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore d'activité en {annee}.</Text>
                    )}
                  </Bloc>
                ) : null}
              </>
            ) : null}

            {pret && onglet === 'rythme' && rythme ? (
              <>
                <View style={styles.bandeauRythme}>
                  {statsRythme.map((c, k) => (
                    <View key={k} accessible style={[styles.statRythme, { backgroundColor: avecAlpha(p.surface, 0.78) }]}>
                      <Text style={[styles.valeurSerie, { color: p.texte }]}>
                        {c.val}
                        <Text style={[typo.petit, { color: p.texteDoux }]}> {c.unite}</Text>
                      </Text>
                      <Text style={[typo.micro, { color: p.texteDoux, textAlign: 'center' }]}>{c.libelle}</Text>
                      {c.note ? <Text style={[typo.petit, { color: p.texteMuet, textAlign: 'center' }]}>{c.note}</Text> : null}
                    </View>
                  ))}
                </View>

                <Bloc>
                  <View style={styles.enteteBloc}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      {mesureM.nom} par mois
                    </Text>
                    <MenuMesure etiquette="Mesure par mois" valeur={mesureMois} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('mois', c as MetriqueCumul)} />
                  </View>
                  <BarresMois
                    valeurs={parMois}
                    moisEnCours={moisEnCours}
                    dernierMois={dernierMois}
                    unite={uniteGraphe(mesureM)}
                    formater={(v) => `${formatNum(v, 0)}${uniteGraphe(mesureM) ? ` ${uniteGraphe(mesureM)}` : ''}`}
                    etiquette={`${mesureM.nom} par mois en ${annee} (${mesureM.unite}) : ${parMois.map((v, i) => `${NOMS_MOIS[i]} ${formatNum(v, decimalesMois)}`).join(', ')}. Meilleur mois : ${formatNum(meilleurMois, decimalesMois)} ${mesureM.unite}.`}
                  />
                </Bloc>

                <Bloc>
                  <View style={styles.enteteBloc}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      {mesureS.nom} par semaine
                    </Text>
                    <MenuMesure etiquette="Mesure par semaine" valeur={mesureSemaine} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('semaine', c as MetriqueCumul)} />
                  </View>
                  {mesureSemaine === 'tss' && semaines.every((v) => v === 0) ? (
                    <Text style={[typo.corps, { color: p.texteDoux, marginBottom: 12 }]}>Pas de charge (TSS) enregistrée sur cette période : les séances sans puissance ni cardio n'en ont pas.</Text>
                  ) : null}
                  <BarresHebdo
                    valeurs={semaines}
                    couleur={p.texte}
                    repere={moyenneSemaine}
                    echelle
                    unite={uniteGraphe(mesureS)}
                    ecart={2}
                    rayonBarre={2}
                    hauteur={110}
                    etiquette={`${mesureS.nom} des 52 ${enCours ? 'dernières semaines' : `semaines de ${annee}`} (${mesureS.unite}) : ${semaines.map((v) => formatNum(v, decimalesSemaine)).join(', ')}. Moyenne ${formatNum(moyenneSemaine, decimalesSemaine)}${enCours ? ', semaine en cours exclue' : ''}.`}
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
                </Bloc>

              </>
            ) : null}

            {pret && onglet === 'records' ? (
              <>
                {records.length ? (
                  <Bloc titre={`Records de ${annee}`}>
                    {records.map((r, i) => {
                      const nom = r.nom || 'Sans titre';
                      const contenu = (
                        <>
                          <View style={styles.enteteRecord}>
                            <Text style={[typo.micro, { color: p.texteDoux }]}>{r.libelle}</Text>
                            {recordRecent(r.iso, maintenant) ? (
                              <View style={[styles.nouveau, { backgroundColor: p.texte }]}>
                                <Text style={[typo.micro, { color: p.fond }]}>Nouveau</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[styles.valeurRecord, { color: p.texte }]}>
                            {r.cle === 'duree' ? texteHM(Math.round(r.valeur)) : formatNum(r.valeur, r.cle === 'distance' ? 1 : 0)}
                            {r.cle !== 'duree' ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {r.unite}</Text> : null}
                          </Text>
                          <Text style={[typo.petit, { color: p.texteDoux }]}>{nom}</Text>
                          <Text style={[typo.petit, { color: p.texteDoux }]}>{formatDateLongue(r.iso)}</Text>
                        </>
                      );
                      const etiquette = `${r.libelle}, ${r.cle === 'duree' ? texteHM(Math.round(r.valeur)) : `${formatNum(r.valeur, r.cle === 'distance' ? 1 : 0)} ${r.unite}`}, ${nom}, ${formatDateLongue(r.iso)}`;
                      const style = [styles.record, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }];
                      // Le record « D+ en un jour » cumule plusieurs séances : il n'a pas de séance à ouvrir
                      return r.id ? (
                        <Pressable key={r.cle} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} onPress={() => router.push({ pathname: '/seance', params: { id: r.id } })} style={style}>
                          {contenu}
                        </Pressable>
                      ) : (
                        <View key={r.cle} accessible accessibilityLabel={etiquette} style={style}>
                          {contenu}
                        </View>
                      );
                    })}
                  </Bloc>
                ) : (
                  <Bloc titre={`Records de ${annee}`}>
                    <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de record en {annee}.</Text>
                  </Bloc>
                )}
              </>
            ) : null}

            {pret && onglet === 'progres' ? (
              <>
                <OngletsSegment<string>
                  etiquette="Période de comparaison"
                  onglets={PERIODES_PROGRESSION.map((x) => ({ cle: String(x.jours), nom: x.court }))}
                  actuel={String(joursProgres)}
                  onChoisir={(cle) => choisirPeriodeProgression(Number(cle) as PeriodeProgression)}
                />
                {historique.chargement || carnet.chargement ? (
                  <View accessible accessibilityLabel="Chargement des progrès" style={styles.attente}>
                    <ActivityIndicator color={p.texteDoux} />
                  </View>
                ) : progres.length ? (
                  progres.map(({ prog, courbe }) => <ProgresSport key={prog.famille} progression={prog} courbe={courbe} jours={joursProgres} />)
                ) : (
                  <Bloc titre="Progrès">
                    <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de progression mesurable pour ce sport : on sait la suivre en course, vélo, natation et musculation.</Text>
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
  anneeMasquee: { opacity: 0.3 },
  titreInvisible: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { gap: espace.e2, borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  separateurDossard: { marginTop: -espace.e2 },
  colonnesDossard: { flexDirection: 'row', paddingTop: espace.e2 },
  valeurColonne: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  pistes: { marginTop: espace.e3 },
  caseObjectif: { paddingVertical: espace.e3, minHeight: 44 },
  record: { paddingVertical: 12, gap: 2 },
  enteteRecord: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nouveau: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  valeurRecord: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36, fontVariant: ['tabular-nums'] },
  enteteBloc: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, marginBottom: espace.e3 },
  bandeauRythme: { flexDirection: 'row', gap: espace.e2, paddingBottom: 4 },
  statRythme: { flex: 1, alignItems: 'center', gap: 2, borderRadius: rayon.bloc, paddingHorizontal: 6, paddingVertical: 12 },
  valeurSerie: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
  ligneRepartition: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  statsRepartition: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginBottom: 14 },
  statRepartition: { flex: 1, alignItems: 'center' },
  pisteRepartition: { borderRadius: 3, overflow: 'hidden' },
});
