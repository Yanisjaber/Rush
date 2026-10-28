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

/** Meilleur jour, meilleure semaine et meilleur mois pour la mesure choisie (le temps, la distance, le dénivelé, la charge ou le nombre de séances). */
export function recordsPeriodes(acts: ActiviteBilan[], mesure: MetriqueCumul): GroupeRecords {
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
    return meilleures([...somme].map(([iso, x]) => ({ valeur: x.valeur, nom: '', iso, id: null, detail: `${x.seances} ${x.seances > 1 ? 'séances' : 'séance'}` })));
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

/** Une sortie à vélo avec les colonnes en plus (courbe de puissance, vitesse, énergie). Les valeurs absentes sont null. */
export interface SortieVelo {
  id: string;
  name: string;
  iso: string;
  /** Le type Strava (Ride, VirtualRide…) : la vitesse n'a pas de sens sur un vélo virtuel. */
  sport: string;
  distance_km: number;
  duree_min: number;
  d_plus: number;
  kj: number | null;
  vitesse_max: number | null;
  /** Meilleure puissance moyenne (en watts) sur 5 s, 1 min, 5 min, 20 min et 1 h. */
  p5: number | null;
  p60: number | null;
  p300: number | null;
  p1200: number | null;
  p3600: number | null;
}

/** Les durées de la courbe de puissance, de la plus courte à la plus longue. */
export const DUREES_PUISSANCE: { cle: 'p5' | 'p60' | 'p300' | 'p1200' | 'p3600'; secondes: number; libelle: string; court: string }[] = [
  { cle: 'p5', secondes: 5, libelle: 'Meilleur 5 s', court: '5 s' },
  { cle: 'p60', secondes: 60, libelle: 'Meilleure 1 min', court: '1 min' },
  { cle: 'p300', secondes: 300, libelle: 'Meilleurs 5 min', court: '5 min' },
  { cle: 'p1200', secondes: 1200, libelle: 'Meilleurs 20 min', court: '20 min' },
  { cle: 'p3600', secondes: 3600, libelle: 'Meilleure heure', court: '1 h' },
];

/** La vitesse max d'une sortie n'est crédible que dehors, sur une vraie sortie, et sous cette limite (la base contient des pointes GPS à plus de 100 km/h). */
export const VITESSE_MAX_CREDIBLE = 95;
const DISTANCE_MIN_VITESSE_MAX = 10;
const DISTANCE_MIN_VITESSE_MOYENNE = 30;

const dehors = (s: SortieVelo): boolean => s.sport !== 'VirtualRide';
const vitesseMoyenne = (s: SortieVelo): number => (s.duree_min > 0 ? s.distance_km / (s.duree_min / 60) : 0);

/** Les records du vélo : puissance (5 durées), vitesse (max et moyenne) et sorties (la plus longue, le plus de dénivelé, la plus grosse dépense). */
export function recordsVelo(sorties: SortieVelo[]): GroupeRecords[] {
  const entree = (s: SortieVelo, valeur: number | null): EntreeRecord => ({ valeur: valeur ?? 0, nom: s.name || 'Sans titre', iso: s.iso, id: s.id });
  const puissance: RecordTop[] = DUREES_PUISSANCE.map((d) => ({ cle: d.cle, libelle: d.libelle, unite: 'W', top: meilleures(sorties.map((s) => entree(s, s[d.cle]))) })).filter((r) => r.top.length);
  const vitesse: RecordTop[] = [
    { cle: 'vmax', libelle: 'Vitesse max', unite: 'km/h', top: meilleures(sorties.filter((s) => dehors(s) && s.distance_km >= DISTANCE_MIN_VITESSE_MAX && (s.vitesse_max ?? 0) <= VITESSE_MAX_CREDIBLE).map((s) => entree(s, s.vitesse_max))) },
    { cle: 'vmoy', libelle: 'Vitesse moyenne', unite: 'km/h', top: meilleures(sorties.filter((s) => dehors(s) && s.distance_km >= DISTANCE_MIN_VITESSE_MOYENNE).map((s) => entree(s, vitesseMoyenne(s)))) },
  ].filter((r) => r.top.length);
  const sortiesRec: RecordTop[] = [
    { cle: 'distance', libelle: 'Plus longue sortie', unite: 'km', top: meilleures(sorties.map((s) => entree(s, s.distance_km))) },
    { cle: 'dplus', libelle: 'Plus gros D+', unite: 'm', top: meilleures(sorties.map((s) => entree(s, s.d_plus))) },
    { cle: 'kj', libelle: 'Plus grosse dépense', unite: 'kJ', top: meilleures(sorties.map((s) => entree(s, s.kj))) },
  ].filter((r) => r.top.length);
  return [
    { cle: 'puissance', libelle: 'Puissance', records: puissance },
    { cle: 'vitesse', libelle: 'Vitesse', records: vitesse },
    { cle: 'sorties', libelle: 'Sorties', records: sortiesRec },
  ].filter((g) => g.records.length);
}

/** La courbe de puissance : la meilleure puissance de chaque durée (null si aucune sortie n'a cette durée). */
export function courbePuissance(sorties: SortieVelo[]): { secondes: number; court: string; watts: number | null }[] {
  return DUREES_PUISSANCE.map((d) => ({ secondes: d.secondes, court: d.court, watts: sorties.reduce<number | null>((m, s) => (s[d.cle] != null && (m == null || (s[d.cle] as number) > m) ? (s[d.cle] as number) : m), null) }));
}

/** Les puissances rapportées au poids (W/kg), avec une décimale ; null sans poids valable. */
export function wattsParKg(watts: number, poids: number | null | undefined): number | null {
  return poids && poids > 20 && poids < 250 ? Math.round((watts / poids) * 10) / 10 : null;
}
