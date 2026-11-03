import { FondDegrade } from '@/components/ui/FondDegrade';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarreSports } from '@/components/graphes/BarreSports';
import { BarresHebdo } from '@/components/graphes/BarresHebdo';
import { BarresMois } from '@/components/graphes/BarresMois';
import { CourbeSemaine } from '@/components/graphes/CourbeSemaine';
import { OngletRecordsSport } from '@/components/bilan/OngletRecordsSport';
import { OngletRecordsTous } from '@/components/bilan/OngletRecordsTous';
import { OngletRecordsCourse } from '@/components/bilan/OngletRecordsCourse';
import { OngletRecordsMuscu } from '@/components/bilan/OngletRecordsMuscu';
import { OngletRecordsVelo } from '@/components/bilan/OngletRecordsVelo';
import { RegulariteMois } from '@/components/graphes/RegulariteMois';
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
  activitesAnnee, anneesDisponibles, avancement, avecForce, cumulParAnnee, valeursParMois, moyennesParJourSemaine, semainesDeLAnnee, mesureParSemaine, MESURES_CUMUL, mesureDef, mesureValide, mesuresDuSport, NOM_SPORT_BILAN, normaliser,
  regulariteAnnee, repartitionSport, sommer, familleBilanDuFiltre, decimalesObjectif, phraseVerdict, type MetriqueCumul,
} from '@/data/bilan/bilan';
import { formatAllure, formatDateLongue, formatNum, texteHM } from '@/data/outils/format';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { formeForceParSemaine } from '@/data/bilan/forme-force';
import { formeCourseParSemaine, formeParSemaine } from '@/data/bilan/forme-saison';
import { niveauxCourse, niveauxVelo } from '@/data/bilan/niveau-annees';
import { mesuresCourse, niveauGlobalCourse } from '@/data/bilan/piliers-course';
import { niveauGlobalMuscu } from '@/data/bilan/piliers-muscu';
import { niveauGlobal, recordsDeMesures } from '@/data/bilan/piliers-niveau';
import { courbeProgression, progressionTousSports, type PeriodeProgression } from '@/data/bilan/progression';
import { sortiesCourse } from '@/data/bilan/progression-course';
import { sortiesVelo as sortiesVeloProgres } from '@/data/bilan/progression-velo';
import { useDonneesBilan } from '@/hooks/useDonneesBilan';
import { useRecordsVelo } from '@/hooks/useRecordsVelo';
import { useHistoriqueProgression, useSeriesForceProgression } from '@/hooks/useHistoriqueProgression';
import { useReferences } from '@/hooks/useReferences';
import { useMenu } from '@/stores/menu';
import { choisirMesure, useMesuresBilan } from '@/stores/mesures-bilan';
import { usePiliersAnnuels } from '@/hooks/usePiliersAnnuels';
import { usePiliersCourse } from '@/hooks/usePiliersCourse';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const BARRE_ONGLETS = 72;
type OngletBilan = 'resume' | 'rythme' | 'records' | 'progres';

// Progrès : plus de choix de période. Le niveau du vélo et de la course se lit année après année ; la natation et la musculation comparent les 12 derniers mois aux 12 mois d'avant ;
// et la preuve du calcul (derrière « Comment c'est calculé ») fait de même.
const JOURS_PROGRES: PeriodeProgression = 365;
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
  // « Tous temps » : une option du menu de l'année, seulement sur l'onglet Records (les records de tout l'historique au lieu de ceux d'une année)
  const [toutTemps, setToutTemps] = useState(false);
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
  // Ce que le doigt touche dans les graphiques du Rythme (un mois, une semaine, un jour de la semaine, un jour du calendrier) ; null : rien
  const [selMois, setSelMois] = useState<number | null>(null);
  const [selSemaine, setSelSemaine] = useState<number | null>(null);
  const [selJourSemaine, setSelJourSemaine] = useState<number | null>(null);
  const [selJour, setSelJour] = useState<{ mois: number; jour: number } | null>(null);
  const mesureRepartition = mesures.repartition;
  const { brutes, objectifs, chargement, erreur, pret, actualisation, recharger } = useDonneesBilan();
  const annee = anneeChoisie;
  // Progrès : l'historique long et le carnet de force ne se chargent qu'à la première ouverture de l'onglet
  const progresOuvert = onglet === 'progres';
  const historique = useHistoriqueProgression(brutes, progresOuvert);
  // Le carnet de force sert au Progrès, et aux séries / répétitions / tonnage de la musculation sur tous les onglets
  const carnet = useSeriesForceProgression(progresOuvert || filtre === 'muscu');
  const { hrMax } = useReferences(); // la même FC max que le widget de l'accueil : sinon les deux ne diraient pas la même chose

  const toutes = useMemo(() => avecForce(brutes.map(normaliser), carnet.series), [brutes, carnet.series]);
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
  // Les trois chiffres sous le grand : le temps, puis ce qui compte pour le sport (course : l'allure et la FC ; musculation : les séries et le tonnage ; sinon les séances et la charge)
  // Moins de 10 h : « 0h30 », « 4h12 » (« 0 h » dirait que rien n'a été fait) ; au-delà, des heures rondes
  const temps = courant.heures > 0 ? (courant.heures < 10 ? { cle: 'heures', libelle: 'Temps', val: texteHM(Math.round(courant.heures * 60)), unite: '' } : { cle: 'heures', libelle: 'Temps', val: formatNum(courant.heures, 0), unite: 'h' }) : null;
  const colonnes = (
    filtre === 'course'
      ? [temps, courant.allure > 0 ? { cle: 'allure', libelle: 'Allure', val: formatAllure(courant.allure * 60).replace('/km', ''), unite: '/km' } : null, courant.fc > 0 ? { cle: 'fc', libelle: 'FC moyenne', val: formatNum(courant.fc, 0), unite: 'bpm' } : null]
      : filtre === 'muscu'
        ? [temps, courant.series > 0 ? { cle: 'series', libelle: 'Séries', val: formatNum(courant.series, 0), unite: '' } : null, courant.tonnage > 0 ? { cle: 'tonnage', libelle: 'Tonnage', val: formatNum(courant.tonnage / 1000, 1), unite: 't' } : null]
        : [temps, courant.distance > 0 && courant.seances > 0 ? { cle: 'seances', libelle: 'Séances', val: formatNum(courant.seances, 0), unite: '' } : null, courant.tss > 0 ? { cle: 'effort', libelle: 'Charge', val: formatNum(courant.tss, 0), unite: '' } : null]
  ).filter((x): x is { cle: string; libelle: string; val: string; unite: string } => !!x);

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
  // Records : les sorties à vélo avec leurs colonnes en plus (puissance par durée, vitesse, énergie), chargées seulement sur l'onglet d'un sport vélo
  // « Tout » se compare à cette année, jamais à l'année qu'on avait choisie avant dans le menu
  const anneeRecords = toutTemps ? anneeCourante : annee;
  const { sorties: sortiesVelo, poids: poidsVelo, courbeTout, courbeAnnee, chargement: chargementVelo, erreur: erreurVelo } = useRecordsVelo(onglet === 'records' && filtre === 'velo', anneeRecords);
  // Les mesures des menus dépendent du sport (musculation : séries, tonnage ; course : allure, FC) ; le cumul sur 3 ans n'additionne que les mesures qui se somment
  const mesuresSport = useMemo(() => mesuresDuSport(filtre), [filtre]);
  const mesuresCumul = useMemo(() => mesuresSport.filter((m) => !m.moyenne), [mesuresSport]);
  const metrique = mesureValide(mesures.cumul, mesuresCumul, 'distance_km');
  const cumul = useMemo(() => (onglet === 'resume' ? cumulParAnnee(filtrees, [annee, annee - 1, annee - 2], metrique, maintenant) : { etiquettes: [], series: [] }), [onglet, filtrees, annee, metrique, maintenant]);
  const mesure = mesureDef(metrique);
  // Rythme : par mois (en km, ou en heures quand le sport n'a pas de distance, comme la musculation), charge par semaine, régularité
  const enKm = courant.distance > 0;
  // Musculation : le tonnage dès qu'il y en a (le carnet de force est lié aux séances), sinon les heures
  const defautMesure: MetriqueCumul = filtre === 'muscu' ? (courant.tonnage > 0 ? 'tonnage' : 'heures') : enKm ? 'distance_km' : 'heures';
  const mesureMois: MetriqueCumul = mesureValide(mesures.mois ?? defautMesure, mesuresSport, defautMesure);
  const mesureSemaine: MetriqueCumul = mesureValide(mesures.semaine ?? defautMesure, mesuresSport, defautMesure);
  const mesureJour: MetriqueCumul = mesureValide(mesures.jour ?? defautMesure, mesuresSport, defautMesure);
  const mesureRecords: MetriqueCumul = mesures.records ?? (enKm ? 'distance_km' : 'heures');
  const mesureM = mesureDef(mesureMois);
  const decimalesMois = mesureM.decimales;
  // L'unité écrite sur les graphiques : « km », « m », « TSS », « h » ; pour les séances, le titre le dit déjà
  const uniteGraphe = (m: { unite: string }) => (m.unite === 'séances' || m.unite === 'séries' || m.unite === 'rép.' ? '' : m.unite);
  const mesureS = mesureDef(mesureSemaine);
  const mesureJ = mesureDef(mesureJour);
  const totalMoyen = (m: MetriqueCumul): number => (m === 'allure' ? courant.allure : m === 'fc' ? courant.fc : 0);
  // Ce que le doigt touche s'efface quand on change d'année, de sport, d'onglet ou de mesure (les positions n'ont plus le même sens)
  useEffect(() => {
    setSelMois(null);
    setSelSemaine(null);
    setSelJourSemaine(null);
    setSelJour(null);
  }, [annee, filtre, onglet, mesureMois, mesureSemaine, mesureJour]);
  // Une valeur écrite avec son unité : « 4h12 » pour le temps, un simple nombre pour les séances (le titre le dit), « 1 040 km » sinon
  // L'allure se lit en minutes et secondes par km (la valeur calculée est en minutes par km : 5,5 → 5'30"/km) ; la FC en bpm
  const texteMesure = (v: number, cle: MetriqueCumul, unite: string, decimales = 0): string =>
    cle === 'heures' ? texteHM(Math.round(v * 60))
      : cle === 'seances' ? `${formatNum(v, decimales)} ${v === 1 ? 'séance' : 'séances'}`
        : cle === 'allure' ? (v > 0 ? formatAllure(v * 60) : '—')
          : cle === 'fc' ? (v > 0 ? `${formatNum(v, 0)} bpm` : '—')
            : `${formatNum(v, decimales)} ${unite}`;
  const majuscule = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
  const jourMois = (iso: string): string => `${Number(iso.slice(8, 10))} ${NOMS_MOIS[Number(iso.slice(5, 7)) - 1]}`;
  // Une valeur de la semaine type écrite avec son unité : « 4h12 » pour le temps, « 18 » pour les séances (le titre le dit), « 1 040 km » sinon
  const texteJour = (v: number, decimales = mesureJour === 'seances' ? 1 : mesureJ.decimales): string => (mesureJour === 'heures' || mesureJour === 'allure' || mesureJour === 'fc' ? texteMesure(v, mesureJour, mesureJ.unite, decimales) : mesureJour === 'seances' ? formatNum(v, decimales) : `${formatNum(v, decimales)} ${mesureJ.unite}`);
  const decimalesSemaine = mesureSemaine === 'seances' ? 1 : mesureS.decimales;
  const moisEnCours = annee === maintenant.getFullYear() ? maintenant.getMonth() : null;
  const dernierMois = moisEnCours ?? 11;
  const rythme = useMemo(() => {
    if (onglet !== 'rythme') return null;
    const parMois = valeursParMois(filtrees, annee, mesureMois);
    // Les semaines de l'année choisie (les à-venir restent vides), et leur moyenne : le total divisé par les semaines écoulées, comme la pastille « Par semaine » du haut
    const { lundis, derniere: derniereSemaine } = semainesDeLAnnee(annee, maintenant);
    const semaines = mesureParSemaine(filtrees, annee, mesureSemaine);
    const regularite = regulariteAnnee(filtrees, annee, maintenant);
    const moyenneSemaine = mesureS.moyenne ? totalMoyen(mesureSemaine) : semaines.reduce((t, v) => t + v, 0) / Math.max(1, regularite.jours / 7);
    const jourSemaine = moyennesParJourSemaine(activitesAnnee(filtrees, annee, maintenant), annee, maintenant, mesureJour);
    return { parMois, jourSemaine, lundis, derniereSemaine, meilleurMois: Math.max(0, ...parMois), semaines, moyenneSemaine, regularite };
  }, [onglet, filtrees, annee, maintenant, mesureMois, mesureSemaine, mesureJour, courant, mesureS]);
  const repartition = useMemo(() => (onglet === 'resume' ? repartitionSport(activitesAnnee(filtrees, annee, maintenant), mesureRepartition, filtre !== 'tout') : []), [onglet, filtre, filtrees, annee, maintenant, mesureRepartition]);
  // `court` : pour le gros chiffre du haut, le mot « séances » est de trop (le libellé dessous le dit déjà)
  const texteRep = (v: number, court = false): string =>
    mesureRep.unite === 'h' ? texteHM(Math.round(v * 60)) : court && mesureRep.unite === 'séances' ? formatNum(v, 0) : `${formatNum(v, 0)} ${mesureRep.unite}`;
  const dense = repartition.length > 6; // beaucoup de sports : lignes et barres plus serrées
  const mesureRep = MESURES_CUMUL.find((m) => m.cle === mesureRepartition) ?? MESURES_CUMUL[0];
  // Les valeurs de l'onglet Rythme : elles n'existent que sur cet onglet (l'affichage plus bas est gardé par `rythme`)
  const { parMois, jourSemaine, lundis, derniereSemaine, meilleurMois, semaines, moyenneSemaine, regularite } = rythme ?? ({} as NonNullable<typeof rythme>);
  // La moyenne par mois : les mois terminés (le mois en cours ne l'est pas, comme la semaine en cours pour la moyenne par semaine) ; en janvier, le seul mois qu'on a
  const moisTermines = rythme ? (moisEnCours != null && moisEnCours > 0 ? parMois.slice(0, moisEnCours) : moisEnCours != null ? parMois.slice(0, 1) : parMois) : [];
  const moyenneMois = mesureM.moyenne ? totalMoyen(mesureMois) : moisTermines.length ? moisTermines.reduce((t, v) => t + v, 0) / moisTermines.length : 0;
  const seancesParSemaine = (n: number) => (regularite?.jours ? n / (regularite.jours / 7) : 0);
  const heuresParSemaine = seancesParSemaine; // même calcul : une quantité divisée par le nombre de semaines écoulées
  // Les trois chiffres en haut de l'onglet Rythme
  const parSemaineH = { libelle: 'Par semaine', val: texteHM(Math.round(heuresParSemaine(courant.heures) * 60)), unite: '', note: '' };
  const seancesSemaine = { libelle: 'Par semaine', val: formatNum(seancesParSemaine(courant.seances), 1), unite: 'séances', note: '' };
  // Course : l'allure et la FC de l'année ; musculation : les séances et les séries par semaine ; les autres sports : le temps, les jours actifs et les séances
  const statsRythme: { libelle: string; val: string; unite: string; note: string }[] = regularite
    ? filtre === 'course'
      ? [parSemaineH, { libelle: 'Allure moy.', val: courant.allure > 0 ? formatAllure(courant.allure * 60).replace('/km', '') : '—', unite: courant.allure > 0 ? '/km' : '', note: '' }, { libelle: 'FC moy.', val: courant.fc > 0 ? formatNum(courant.fc, 0) : '—', unite: courant.fc > 0 ? 'bpm' : '', note: '' }]
      : filtre === 'muscu'
        ? [parSemaineH, seancesSemaine, { libelle: 'Par semaine', val: formatNum(seancesParSemaine(courant.series), 0), unite: 'séries', note: '' }]
        : [parSemaineH, { libelle: 'Jours actifs', val: String(regularite.joursActifs), unite: `/ ${regularite.jours}`, note: '' }, seancesSemaine]
    : [];
  // Un bloc par sport mesurable : celui du filtre, ou tous ceux que tu pratiques sur « Tout »
  const progres = useMemo(() => {
    if (!progresOuvert) return [];
    const familles = filtre === 'tout' ? [...new Set(toutes.map((a) => a.famille)), ...(carnet.series.length ? ['muscu'] : [])] : [filtre];
    const donnees = { seances: historique.seances, series: carnet.series, hrMax: hrMax ?? null };
    return progressionTousSports(familles, donnees, JOURS_PROGRES, maintenant).map((prog) => ({ prog, courbe: courbeProgression(prog.famille, donnees, JOURS_PROGRES, maintenant) }));
  }, [progresOuvert, filtre, toutes, historique.seances, carnet.series, hrMax, maintenant]);
  // Le niveau année après année du vélo et de la course, sur tout l'historique
  const niveaux = useMemo(() => {
    if (!progresOuvert) return { velo: null, course: null, anneesVelo: [] as number[], sortiesVelo: [] as ReturnType<typeof sortiesVeloProgres> };
    const sorties = sortiesVeloProgres(historique.seances, hrMax ?? null);
    const premiere = sorties.length ? Math.min(...sorties.map((s) => Number(s.date.slice(0, 4)))) : maintenant.getFullYear();
    return {
      velo: niveauxVelo(sorties),
      course: niveauxCourse(sortiesCourse(historique.seances, hrMax ?? null)),
      anneesVelo: Array.from({ length: maintenant.getFullYear() - premiere + 1 }, (_, i) => premiere + i),
      sortiesVelo: sorties,
    };
  }, [progresOuvert, historique.seances, hrMax, maintenant]);
  // Les mesures par année (puissances de pointe, répétabilité, charge) : une lecture, qui sert au niveau global et au sélecteur de records
  const piliers = usePiliersAnnuels(progresOuvert && niveaux.velo !== null);
  const recordsAnnuels = useMemo(() => recordsDeMesures(piliers.mesures), [piliers.mesures]);
  const niveauGlobalVelo = useMemo(() => (niveaux.velo ? niveauGlobal(piliers.mesures) : null), [niveaux.velo, piliers.mesures]);
  // La forme semaine par semaine de l'année choisie (graphique « Forme par saison »)
  const formeSaison = useMemo(
    () => (niveaux.velo ? formeParSemaine(niveaux.sortiesVelo, historique.seances, niveaux.velo, annee, maintenant) : null),
    [niveaux, historique.seances, annee, maintenant],
  );
  // Le niveau global de la course : les courbes du serveur (meilleurs temps et distances), le volume des séances et le niveau à cardio égal ; il ne remplace l'ancienne page que s'il a de quoi dire quelque chose
  const piliersCourse = usePiliersCourse(progresOuvert && (filtre === 'course' || filtre === 'tout'));
  const niveauCourse = useMemo(() => {
    if (!progresOuvert || !toutes.some((a) => a.sport === 'course')) return null;
    const g = niveauGlobalCourse(mesuresCourse(piliersCourse.lignes, toutes, niveaux.course, maintenant));
    return g && g.annees.some((a) => a.preuves.vitesse > 0 || a.global !== null) ? g : null;
  }, [progresOuvert, toutes, piliersCourse.lignes, niveaux.course, maintenant]);
  const formeCourse = useMemo(
    () => (progresOuvert && niveauCourse && niveaux.course ? formeCourseParSemaine(sortiesCourse(historique.seances, hrMax ?? null), historique.seances, niveaux.course, annee, maintenant) : null),
    [progresOuvert, niveauCourse, niveaux.course, historique.seances, hrMax, annee, maintenant],
  );
  // Le niveau global de la musculation : le carnet de force (force, équilibre) et les séances (volume, régularité) ; sans carnet, l'ancienne page (1RM sur 12 mois) reste
  const niveauMuscu = useMemo(() => (progresOuvert && carnet.series.length ? niveauGlobalMuscu(carnet.series, toutes, maintenant) : null), [progresOuvert, carnet.series, toutes, maintenant]);
  const formeMuscu = useMemo(() => (progresOuvert && niveauMuscu ? formeForceParSemaine(carnet.series, annee, maintenant) : null), [progresOuvert, niveauMuscu, carnet.series, annee, maintenant]);
  // L'année choisie en haut ne sert que s'il y a un niveau global à lire (vélo, course ou musculation) ; sinon elle reste affichée mais grisée
  const anneeInutile = onglet === 'progres' && !progres.some(({ prog }) => (prog.famille === 'velo' && niveauGlobalVelo) || (prog.famille === 'course' && niveauCourse) || (prog.famille === 'muscu' && niveauMuscu));

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
          {/* Sur Progrès, l'année ne sert qu'au niveau global du vélo (niveau, point cerclé, piliers et courbe jusqu'à cette année). Sans lui, elle reste affichée
              mais grisée et non touchable, pour que les onglets ne bougent pas */}
          <View style={[styles.zoneAnnee, anneeInutile ? styles.anneeMasquee : null]} pointerEvents={anneeInutile ? 'none' : 'auto'} accessibilityElementsHidden={anneeInutile} importantForAccessibility={anneeInutile ? 'no-hide-descendants' : 'auto'}>
            <MenuMesure
              gras
              petite
              etiquette="Année"
              valeur={onglet === 'records' && toutTemps ? 'tout' : String(annee)}
              options={[...(onglet === 'records' ? [{ cle: 'tout', nom: 'Tout' }] /* court : « Tous temps » pousserait le sélecteur d'onglets hors de l'écran */ : []), ...annees.map((a) => ({ cle: String(a), nom: String(a) }))]}
              onChoisir={(c) => {
                setToutTemps(c === 'tout');
                if (c !== 'tout') setAnneeChoisie(Number(c));
              }}
            />
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
                    <MenuMesure etiquette="Mesure" valeur={metrique} options={mesuresCumul.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('cumul', c as MetriqueCumul)} />
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
                  <View style={[styles.enteteBloc, { marginBottom: 0 }]}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      {mesureM.nom} par mois
                    </Text>
                    <MenuMesure etiquette="Mesure par mois" valeur={mesureMois} options={mesuresSport.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('mois', c as MetriqueCumul)} />
                  </View>
                  <Text style={[typo.petit, styles.lecture, { color: selMois != null ? p.texte : p.texteMuet }]}>
                    {selMois != null
                      ? `${majuscule(NOMS_MOIS[selMois])} : ${texteMesure(parMois[selMois] ?? 0, mesureMois, mesureM.unite, decimalesMois)}`
                      : `Moyenne : ${texteMesure(moyenneMois, mesureMois, mesureM.unite, decimalesMois)}${mesureM.moyenne ? '' : ' par mois'}`}
                  </Text>
                  <BarresMois
                    valeurs={parMois}
                    moisEnCours={moisEnCours}
                    dernierMois={dernierMois}
                    repere={moyenneMois}
                    selection={selMois}
                    onSelection={setSelMois}
                    unite={uniteGraphe(mesureM)}
                    etiquette={`${mesureM.nom} par mois en ${annee} (${mesureM.unite}) : ${parMois.map((v, i) => `${NOMS_MOIS[i]} ${formatNum(v, decimalesMois)}`).join(', ')}. ${mesureM.moyenne ? '' : ` Meilleur mois : ${formatNum(meilleurMois, decimalesMois)} ${mesureM.unite}.`}`}
                  />
                </Bloc>

                <Bloc>
                  <View style={[styles.enteteBloc, { marginBottom: 0 }]}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      {mesureS.nom} par semaine
                    </Text>
                    <MenuMesure etiquette="Mesure par semaine" valeur={mesureSemaine} options={mesuresSport.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('semaine', c as MetriqueCumul)} />
                  </View>
                  {mesureSemaine === 'tss' && semaines.every((v) => v === 0) ? (
                    <Text style={[typo.corps, { color: p.texteDoux, marginBottom: 12 }]}>Pas de charge (TSS) enregistrée sur cette période : les séances sans puissance ni cardio n'en ont pas.</Text>
                  ) : null}
                  <Text style={[typo.petit, styles.lecture, { color: selSemaine != null ? p.texte : p.texteMuet }]}>
                    {selSemaine != null
                      ? `Semaine du ${jourMois(lundis[selSemaine] < `${annee}-01-01` ? `${annee}-01-01` : lundis[selSemaine])}${enCours && selSemaine === derniereSemaine ? ' (en cours)' : ''} : ${texteMesure(semaines[selSemaine] ?? 0, mesureSemaine, mesureS.unite, decimalesSemaine)}`
                      : `Moyenne : ${texteMesure(moyenneSemaine, mesureSemaine, mesureS.unite, decimalesSemaine)}${mesureS.moyenne ? '' : ' par semaine'}`}
                  </Text>
                  <BarresHebdo
                    valeurs={semaines}
                    couleur={p.texte}
                    repere={moyenneSemaine}
                    echelle
                    dernier={derniereSemaine}
                    selection={selSemaine}
                    onSelection={setSelSemaine}
                    unite={uniteGraphe(mesureS)}
                    ecart={2}
                    rayonBarre={2}
                    hauteur={150} // la même que le graphique par mois : les deux cartes ont la même taille
                    etiquette={`${mesureS.nom} par semaine en ${annee} (${mesureS.unite}) : ${semaines.slice(0, derniereSemaine + 1).map((v) => formatNum(v, decimalesSemaine)).join(', ')}. Moyenne ${formatNum(moyenneSemaine, decimalesSemaine)}.`}
                  />
                </Bloc>

                <Bloc titre="Régularité">
                  <Text style={[typo.petit, styles.lecture, { color: selJour ? p.texte : p.texteMuet }]}>
                    {(() => {
                      const c = selJour ? regularite.parMois[selJour.mois]?.cases[selJour.jour] : null;
                      if (!c?.iso) return `${regularite.joursActifs} jours actifs sur ${regularite.jours}`;
                      if (!c.seances) return `${formatDateLongue(c.iso)} : repos`;
                      return `${formatDateLongue(c.iso)} : ${c.famille ? SPORTS[c.famille as keyof typeof SPORTS]?.nom ?? 'Autre' : 'Autre'}, ${c.seances} ${c.seances > 1 ? 'séances' : 'séance'}, charge ${formatNum(c.charge ?? 0, 0)}`;
                    })()}
                  </Text>
                  <RegulariteMois
                    parMois={regularite.parMois}
                    dernierMois={dernierMois}
                    selection={selJour}
                    onSelection={setSelJour}
                    etiquette={`Régularité de ${annee}, mois par mois : ${regularite.joursActifs} jours actifs sur ${regularite.jours}. ${regularite.parMois.slice(0, dernierMois + 1).map((m, i) => `${NOMS_MOIS[i]} ${m.actifs}`).join(', ')}.`}
                  />
                </Bloc>

                <Bloc>
                  <View style={[styles.enteteBloc, { marginBottom: 0 }]}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                      Semaine type
                    </Text>
                    <MenuMesure etiquette="Mesure de la semaine type" valeur={mesureJour} options={mesuresSport.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => choisirMesure('jour', c as MetriqueCumul)} />
                  </View>
                  {jourSemaine.every((v) => v === 0) ? (
                    <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore d'activité en {annee}.</Text>
                  ) : (
                    <>
                      <Text style={[typo.petit, styles.lecture, { color: selJourSemaine != null ? p.texte : p.texteMuet }]}>
                        {selJourSemaine != null
                          ? `${majuscule(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][selJourSemaine])} : ${texteMesure(jourSemaine[selJourSemaine] ?? 0, mesureJour, mesureJ.unite, mesureJour === 'seances' ? 1 : mesureJ.decimales)}${mesureJ.moyenne ? '' : ' en moyenne'}`
                          : (mesureJ.moyenne ? `Moyenne : ${texteMesure(totalMoyen(mesureJour), mesureJour, mesureJ.unite, mesureJ.decimales)}` : `Moyenne : ${texteMesure(jourSemaine.reduce((t, v) => t + v, 0) / 7, mesureJour, mesureJ.unite, mesureJour === 'seances' ? 1 : mesureJ.decimales)} par jour`)}
                      </Text>
                      <CourbeSemaine
                        valeurs={jourSemaine}
                        couleur={filtre === 'tout' ? p.texte : couleurSport(p, filtre)}
                        formater={(v) => texteJour(v)}
                        selection={selJourSemaine}
                        onSelection={setSelJourSemaine}
                        etiquette={`${mesureJ.nom} en moyenne par jour de la semaine en ${annee} : ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((j, i) => `${j} ${texteJour(jourSemaine[i])}`).join(', ')}.`}
                      />
                    </>
                  )}
                </Bloc>

              </>
            ) : null}

            {pret && onglet === 'records' ? (
              filtre === 'velo' ? (
                <OngletRecordsVelo
                  portee={toutTemps ? 'tout' : 'annee'}
                  annee={anneeRecords}
                  maintenant={maintenant}
                  sorties={sortiesVelo}
                  poids={poidsVelo}
                  courbeAnnee={courbeAnnee}
                  courbeTout={courbeTout}
                  chargement={chargementVelo}
                  erreur={erreurVelo}
                  onOuvrir={(id) => router.push({ pathname: '/seance', params: { id } })}
                />
              ) : filtre === 'course' ? (
                <OngletRecordsCourse
                  portee={toutTemps ? 'tout' : 'annee'}
                  toutes={filtrees}
                  annee={anneeRecords}
                  maintenant={maintenant}
                  onOuvrir={(id) => router.push({ pathname: '/seance', params: { id } })}
                />
              ) : filtre === 'muscu' ? (
                <OngletRecordsMuscu
                  portee={toutTemps ? 'tout' : 'annee'}
                  toutes={filtrees}
                  series={carnet.series}
                  chargement={carnet.chargement}
                  annee={anneeRecords}
                  maintenant={maintenant}
                  onOuvrir={(id) => router.push({ pathname: '/seance', params: { id } })}
                />
              ) : filtre === 'tout' ? (
                <OngletRecordsTous
                  portee={toutTemps ? 'tout' : 'annee'}
                  toutes={toutes}
                  annee={anneeRecords}
                  maintenant={maintenant}
                  mesure={mesureRecords}
                  onMesure={(m) => choisirMesure('records', m)}
                  onOuvrir={(id) => router.push({ pathname: '/seance', params: { id } })}
                />
              ) : (
                <OngletRecordsSport
                  portee={toutTemps ? 'tout' : 'annee'}
                  toutes={filtrees}
                  annee={anneeRecords}
                  maintenant={maintenant}
                  filtre={filtre}
                  onOuvrir={(id) => router.push({ pathname: '/seance', params: { id } })}
                />
              )
            ) : null}

            {pret && onglet === 'progres' ? (
              <>
                {historique.chargement || carnet.chargement ? (
                  <View accessible accessibilityLabel="Chargement des progrès" style={styles.attente}>
                    <ActivityIndicator color={p.texteDoux} />
                  </View>
                ) : progres.length ? (
                  progres.map(({ prog, courbe }) => (
                    <ProgresSport
                      key={prog.famille}
                      progression={prog}
                      courbe={courbe}
                      jours={JOURS_PROGRES}
                      niveau={prog.famille === 'velo' ? niveaux.velo : prog.famille === 'course' ? niveaux.course : null}
                      records={prog.famille === 'velo' ? recordsAnnuels : undefined}
                      niveauGlobal={prog.famille === 'velo' ? niveauGlobalVelo : null}
                      niveauSport={prog.famille === 'course' ? niveauCourse : prog.famille === 'muscu' ? niveauMuscu : null}
                      series={prog.famille === 'muscu' ? carnet.series : undefined}
                      annee={annee}
                      forme={prog.famille === 'velo' ? formeSaison : prog.famille === 'course' ? formeCourse : prog.famille === 'muscu' ? formeMuscu : null}
                      onChoisirAnnee={setAnneeChoisie}
                    />
                  ))
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
  // La pastille de l'année est centrée entre le bord de la page (la marge de 16 pt est reprise) et les onglets à sa droite
  zoneAnnee: { flex: 1, alignItems: 'center', marginLeft: -espace.e4 },
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
  enteteBloc: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, marginBottom: espace.e3 },
  // La ligne de lecture au-dessus d'un graphique : sa valeur, ou ce que le doigt touche
  lecture: { minHeight: 18, marginBottom: 6, textAlign: 'center' },
  bandeauRythme: { flexDirection: 'row', gap: espace.e2, paddingBottom: 4 },
  statRythme: { flex: 1, alignItems: 'center', gap: 2, borderRadius: rayon.bloc, paddingHorizontal: 6, paddingVertical: 12 },
  valeurSerie: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
  ligneRepartition: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  statsRepartition: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginBottom: 14 },
  statRepartition: { flex: 1, alignItems: 'center' },
  pisteRepartition: { borderRadius: 3, overflow: 'hidden' },
});
