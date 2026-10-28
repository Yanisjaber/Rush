// Les records du Bilan : pour chaque record, les trois meilleures entrées (le podium). Fonctions pures, sans réseau.
// Deux familles : les records de volume, calculés sur les activités déjà chargées (tous sports, ou le sport filtré), et les records du vélo (puissance, vitesse, sorties),
// calculés sur des colonnes en plus (courbe de puissance, vitesse max, kJ). Tous donnent des GroupeRecords : l'écran les affiche de la même façon.
import { MESURES_CUMUL, valeurCumul, type ActiviteBilan, type MetriqueCumul } from './bilan.ts';

/** Une entrée d'un podium : la valeur, et la séance (ou la période) qui l'a faite. */
export interface EntreeRecord {
  valeur: number;
  nom: string;
  /** Date de la séance, ou début de la période (lundi d'une semaine, 1er du mois), ou début d'une série. */
  iso: string;
  /** La séance à ouvrir, quand il y en a une (un jour ou un mois cumulent plusieurs séances : pas de séance à ouvrir). */
  id: string | null;
  /** Fin d'une série de jours. */
  fin?: string;
  /** Précision écrite sous le nom (« 3 séances »). */
  detail?: string;
}

export interface RecordTop {
  cle: string;
  libelle: string;
  unite: string;
  /** La nature de la période pour les records de période : l'écran écrit « Semaine du… », le nom du mois… */
  periode?: 'jour' | 'semaine' | 'mois';
  /** Les meilleures entrées, la première est le record. */
  top: EntreeRecord[];
}

export interface GroupeRecords {
  cle: string;
  libelle: string;
  records: RecordTop[];
}

const PODIUM = 3;

// --- Dates ---------------------------------------------------------------------------------------------------------------

const dateDe = (iso: string): Date => new Date(`${iso}T12:00:00`);
const dateIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lundiIso = (iso: string): string => {
  const d = dateDe(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateIso(d);
};
const joursEntre = (a: string, b: string): number => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

/** Les n meilleures entrées (la plus grande valeur d'abord) ; à valeur égale, la plus ancienne reste devant. Les valeurs nulles ou absentes sont ignorées. */
function meilleures(entrees: EntreeRecord[], n = PODIUM): EntreeRecord[] {
  return entrees
    .filter((e) => Number.isFinite(e.valeur) && e.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, n);
}

const nomSeance = (a: ActiviteBilan): string => a.name || 'Sans titre';

// --- Records de volume ---------------------------------------------------------------------------------------------------

/** Meilleur jour, meilleure semaine et meilleur mois pour la mesure choisie (le temps, la distance, le dénivelé, la charge ou le nombre de séances) ; `n` entrées par record (3 par défaut). */
export function recordsPeriodes(acts: ActiviteBilan[], mesure: MetriqueCumul, n = PODIUM): GroupeRecords {
  const unite = MESURES_CUMUL.find((m) => m.cle === mesure)?.unite ?? '';
  const par = (cle: 'jour' | 'semaine' | 'mois'): EntreeRecord[] => {
    const somme = new Map<string, { valeur: number; seances: number }>();
    for (const a of acts) {
      const k = cle === 'jour' ? a.iso : cle === 'semaine' ? lundiIso(a.iso) : `${a.iso.slice(0, 7)}-01`;
      const x = somme.get(k) ?? { valeur: 0, seances: 0 };
      x.valeur += valeurCumul(a, mesure);
      x.seances++;
      somme.set(k, x);
    }
    return meilleures([...somme].map(([iso, x]) => ({ valeur: x.valeur, nom: '', iso, id: null, detail: `${x.seances} ${x.seances > 1 ? 'séances' : 'séance'}` })), n);
  };
  const records: RecordTop[] = [
    { cle: 'jour', libelle: 'Meilleur jour', unite, periode: 'jour', top: par('jour') },
    { cle: 'semaine', libelle: 'Meilleure semaine', unite, periode: 'semaine', top: par('semaine') },
    { cle: 'mois', libelle: 'Meilleur mois', unite, periode: 'mois', top: par('mois') },
  ];
  return { cle: 'periodes', libelle: 'Périodes', records: records.filter((r) => r.top.length) };
}

/** Les records d'une séance : la plus longue sortie, la plus longue durée, la plus grosse charge, et le plus de dénivelé en un jour (qui cumule les séances du jour). */
export function recordsSeance(acts: ActiviteBilan[]): GroupeRecords {
  const de = (cle: 'distance_km' | 'duree_min' | 'tss'): EntreeRecord[] => meilleures(acts.map((a) => ({ valeur: a[cle], nom: nomSeance(a), iso: a.iso, id: a.id })));
  const dplus = new Map<string, number>();
  for (const a of acts) dplus.set(a.iso, (dplus.get(a.iso) ?? 0) + a.d_plus);
  const jours = meilleures([...dplus].map(([iso, valeur]) => ({ valeur, nom: 'Cumul des activités du jour', iso, id: null })));
  const records: RecordTop[] = [
    { cle: 'distance', libelle: 'Plus longue sortie', unite: 'km', top: de('distance_km') },
    { cle: 'duree', libelle: 'Plus longue durée', unite: 'min', top: de('duree_min') },
    { cle: 'tss', libelle: 'Plus grosse charge', unite: 'TSS', top: de('tss') },
    { cle: 'dplus', libelle: 'Plus de D+ en 1 jour', unite: 'm', top: jours },
  ];
  return { cle: 'seance', libelle: 'Séance', records: records.filter((r) => r.top.length) };
}

/** La plus longue série de jours d'affilée avec au moins une séance, et le plus de séances en une semaine. */
export function recordsRegularite(acts: ActiviteBilan[]): GroupeRecords {
  const jours = [...new Set(acts.map((a) => a.iso))].sort();
  const series: EntreeRecord[] = [];
  let debut = '';
  let precedent = '';
  const fermer = () => {
    if (debut) series.push({ valeur: joursEntre(debut, precedent) + 1, nom: '', iso: debut, id: null, fin: precedent });
  };
  for (const j of jours) {
    if (!debut || joursEntre(precedent, j) !== 1) {
      fermer();
      debut = j;
    }
    precedent = j;
  }
  fermer();
  const parSemaine = new Map<string, number>();
  for (const a of acts) parSemaine.set(lundiIso(a.iso), (parSemaine.get(lundiIso(a.iso)) ?? 0) + 1);
  const records: RecordTop[] = [
    { cle: 'serie', libelle: 'Plus longue série', unite: 'jours', top: meilleures(series) },
    { cle: 'seances_semaine', libelle: 'Séances en une semaine', unite: 'séances', periode: 'semaine', top: meilleures([...parSemaine].map(([iso, valeur]) => ({ valeur, nom: '', iso, id: null }))) },
  ];
  return { cle: 'regularite', libelle: 'Régularité', records: records.filter((r) => r.top.length) };
}

// --- Records du vélo -----------------------------------------------------------------------------------------------------

/** Une sortie à vélo avec les colonnes des records basiques. Les valeurs absentes sont null. */
export interface SortieVelo {
  id: string;
  name: string;
  iso: string;
  /** Le type Strava (Ride, VirtualRide…) : la distance, le dénivelé et la vitesse n'ont pas de sens sur un vélo virtuel. */
  sport: string;
  distance_km: number;
  duree_min: number;
  d_plus: number;
  kj: number | null;
  tss: number | null;
  /** La puissance la plus haute de la sortie (W). */
  puissance_max: number | null;
  /** La fréquence cardiaque la plus haute et la moyenne de la sortie (bpm). */
  fc_max: number | null;
  fc_moyenne: number | null;
}

/** Une ligne de la fonction SQL rpc_sorties_velo, telle que l'API la renvoie (les numeric arrivent parfois en texte). */
export interface LigneVelo {
  id: string;
  name: string | null;
  sport: string;
  start_date_local: string;
  distance_km: number | string | null;
  moving_time: number | null;
  total_elevation_gain: number | null;
  kj: number | null;
  tss: number | null;
  max_watts: number | null;
  max_heartrate: number | null;
  avg_heartrate: number | null;
}

const nombre = (v: number | string | null | undefined): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
};

export function sortieVeloDeLigne(l: LigneVelo): SortieVelo {
  return {
    id: l.id,
    name: l.name || '',
    iso: String(l.start_date_local || '').slice(0, 10),
    sport: l.sport,
    distance_km: nombre(l.distance_km) ?? 0,
    duree_min: (l.moving_time ?? 0) / 60,
    d_plus: l.total_elevation_gain ?? 0,
    kj: l.kj,
    tss: l.tss,
    puissance_max: l.max_watts,
    fc_max: l.max_heartrate,
    fc_moyenne: l.avg_heartrate,
  };
}

const dehors = (s: SortieVelo): boolean => s.sport !== 'VirtualRide';
const vitesseMoyenne = (s: SortieVelo): number => (s.duree_min > 0 ? s.distance_km / (s.duree_min / 60) : 0);
/** Une vitesse moyenne n'a de sens que sur une vraie sortie (30 km ou plus), dehors. */
const DISTANCE_MIN_VITESSE_MOYENNE = 30;
/** Les capteurs de fréquence cardiaque donnent des pointes impossibles (233 bpm avec 226 de moyenne) : au-delà de ces limites, la valeur est écartée. */
export const FC_MAX_CREDIBLE = 210;
const FC_MOYENNE_MAX_CREDIBLE = 195;

/**
 * Les records basiques du vélo : la plus longue sortie (en temps), la plus grande distance, le plus gros dénivelé, la plus grosse charge, la plus haute vitesse moyenne,
 * la plus grosse puissance et la plus haute fréquence cardiaque. La distance, le dénivelé et la vitesse ne comptent que les sorties dehors (ceux d'un vélo virtuel sont simulés) ;
 * la puissance et la fréquence cardiaque comptent aussi le virtuel. La cadence et le couple max ne sont pas enregistrés : ils viendront avec les courbes de ces signaux.
 */
export function recordsBasiquesVelo(sorties: SortieVelo[]): RecordTop[] {
  const entree = (s: SortieVelo, valeur: number | null): EntreeRecord => ({ valeur: valeur ?? 0, nom: s.name || 'Sans titre', iso: s.iso, id: s.id });
  const dessous = sorties.filter(dehors);
  const records: RecordTop[] = [
    { cle: 'duree', libelle: 'Plus longue sortie', unite: 'min', top: meilleures(sorties.map((s) => entree(s, s.duree_min))) },
    { cle: 'distance', libelle: 'Plus longue distance', unite: 'km', top: meilleures(dessous.map((s) => entree(s, s.distance_km))) },
    { cle: 'dplus', libelle: 'Plus gros D+', unite: 'm', top: meilleures(dessous.map((s) => entree(s, s.d_plus))) },
    { cle: 'tss', libelle: 'Plus grosse charge', unite: 'TSS', top: meilleures(sorties.map((s) => entree(s, s.tss))) },
    { cle: 'vmoy', libelle: 'Vitesse moyenne', unite: 'km/h', top: meilleures(dessous.filter((s) => s.distance_km >= DISTANCE_MIN_VITESSE_MOYENNE).map((s) => entree(s, vitesseMoyenne(s)))) },
    { cle: 'pmax', libelle: 'Plus grosse puissance', unite: 'W', top: meilleures(sorties.map((s) => entree(s, s.puissance_max))) },
    { cle: 'fcmax', libelle: 'Plus grosse FC', unite: 'bpm', top: meilleures(sorties.filter((s) => (s.fc_max ?? 0) <= FC_MAX_CREDIBLE && (s.fc_moyenne ?? 0) <= FC_MOYENNE_MAX_CREDIBLE).map((s) => entree(s, s.fc_max))) },
  ];
  return records.filter((r) => r.top.length);
}

/** Les puissances rapportées au poids (W/kg), avec une décimale ; null sans poids valable. */
export function wattsParKg(watts: number, poids: number | null | undefined): number | null {
  return poids && poids > 20 && poids < 250 ? Math.round((watts / poids) * 10) / 10 : null;
}

// --- La courbe de puissance ----------------------------------------------------------------------------------------------

/** Une ligne de la fonction SQL rpc_courbe_puissance : la puissance de rang 1, 2 ou 3 pour une durée. */
export interface LigneCourbe {
  duree_s: number;
  rang: number;
  watts: number;
  activity_id: string;
  name: string | null;
  start_date_local: string;
}

export interface EntreeCourbe {
  watts: number;
  id: string;
  nom: string;
  iso: string;
}

/** Une durée de la courbe et son podium (les trois meilleures séances, la meilleure d'abord). */
export interface PointCourbe {
  duree: number;
  top: EntreeCourbe[];
}

/** La durée la plus courte et la plus longue de la courbe : l'axe va de 1 s à 5 h. */
export const DUREE_MIN = 1;
export const DUREE_MAX = 18000;

/** Les lignes de la base deviennent une courbe : un point par durée, de la plus courte à la plus longue. */
export function courbeDeLignes(lignes: LigneCourbe[]): PointCourbe[] {
  const par = new Map<number, LigneCourbe[]>();
  for (const l of lignes) par.set(l.duree_s, [...(par.get(l.duree_s) ?? []), l]);
  return [...par]
    .sort((a, b) => a[0] - b[0])
    .map(([duree, ls]) => ({
      duree,
      top: ls.sort((a, b) => a.rang - b.rang).map((l) => ({ watts: l.watts, id: l.activity_id, nom: l.name || 'Sans titre', iso: String(l.start_date_local || '').slice(0, 10) })),
    }));
}

/** Le point de la courbe dont la durée est la plus proche de `secondes` (à l'échelle logarithmique, comme l'axe) ; -1 si la courbe est vide. */
export function indexDureeProche(courbe: PointCourbe[], secondes: number): number {
  let meilleur = -1;
  let ecart = Infinity;
  courbe.forEach((p, i) => {
    const e = Math.abs(Math.log(p.duree) - Math.log(Math.max(DUREE_MIN, secondes)));
    if (e < ecart) {
      ecart = e;
      meilleur = i;
    }
  });
  return meilleur;
}

/** Une durée écrite : « 5 s », « 1 min », « 20 min », « 1 h », « 1 h 30 ». */
export function texteDuree(secondes: number): string {
  const s = Math.round(secondes);
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r && s < 600 ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
