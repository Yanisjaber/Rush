// Le graphique d'une séance prévue (axes, cible de chaque bloc) et le tableau de ses intervalles : fonctions pures, sans écran ni réseau.
// Un segment = une barre du graphique : son début et sa fin (minutes), sa cible (watts, bpm ou allure en secondes par km / 100 m) et sa zone.
import { distanceSegment, indiceZone, milieu, NOM_TYPE, segmentsDuBloc, texteCible, texteDuree, valeurSegment, type Bloc, type Metrique, type Reference } from './structure.ts';

export interface SegmentGraphe {
  debut: number;
  fin: number;
  valeur: number;
  zone: number;
  /** Vrai pour un effort (intervalle, bloc continu) : c'est lui qui porte sa valeur écrite sur le graphique. */
  effort: boolean;
}

export interface GrapheSeance {
  metrique: Metrique;
  segments: SegmentGraphe[];
  /** Durée totale (minutes). */
  total: number;
  /** Valeurs extrêmes des cibles. */
  min: number;
  max: number;
  /** Vrai pour une allure : la valeur est en secondes, et une valeur BASSE est plus rapide (elle s'affiche en haut). */
  allure: boolean;
}

/** Le graphique d'une structure, ou null sans bloc. La métrique est celle du premier bloc (une séance mélange rarement watts, cardio et allure). */
export function grapheDeBlocs(blocs: Bloc[], ref: Reference = {}, sport = 'Run'): GrapheSeance | null {
  if (!blocs.length) return null;
  const metrique = blocs[0].metric;
  const segments: SegmentGraphe[] = [];
  let t = 0;
  for (const b of blocs) {
    for (const { seg, role } of segmentsDuBloc(b)) {
      segments.push({ debut: t, fin: t + seg.min, valeur: valeurSegment(seg, b.metric, ref, sport), zone: indiceZone(milieu(seg), b.metric), effort: role === 'travail' && b.type !== 'warmup' && b.type !== 'cooldown' && b.type !== 'recovery' });
      t += seg.min;
    }
  }
  if (!segments.length || !(t > 0)) return null;
  const valeurs = segments.map((s) => s.valeur);
  return { metrique, segments, total: t, min: Math.min(...valeurs), max: Math.max(...valeurs), allure: metrique === 'pace' };
}

/** Une allure en secondes → « 4:35 ». */
export const texteAllure = (sec: number): string => `${Math.floor(Math.round(sec) / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

/** La valeur d'une cible, écrite : « 4:35 » pour une allure, « 265 » pour des watts ou des battements. */
export const texteValeur = (valeur: number, metrique: Metrique): string => (metrique === 'pace' ? texteAllure(valeur) : String(Math.round(valeur)));

export interface LigneIntervalle {
  cle: string;
  /** « Échauffement », « Intervalles », « Retour au calme »… */
  nom: string;
  /** Combien de fois le bloc se répète (1 pour un bloc simple). */
  repetitions: number;
  /** La durée de l'effort, et sa distance quand il y a une allure (« 4 min 36 · 1 km »). */
  effort: string;
  /** La cible de l'effort : « 4:35/km · Z4 », « 265 W · Z3 ». */
  cible: string;
  /** La récupération entre deux efforts (« 2 min · 6:45/km · Z1 »), vide sans récupération. */
  recup: string;
  zone: number;
}

const kilometres = (km: number): string => {
  const m = Math.round((km * 1000) / 10) * 10; // au dixième de kilomètre près, pas de fausse précision
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',')} km` : `${m} m`;
};
const metres = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 25) * 25} m`);

/** Une ligne par bloc : son nom, ses répétitions, la durée (et la distance) de l'effort, sa cible et sa récupération. */
export function lignesIntervalles(blocs: Bloc[], ref: Reference = {}, sport = 'Run'): LigneIntervalle[] {
  const nage = sport === 'Swim' || sport === 'OpenWaterSwim';
  return blocs.map((b, i) => {
    const dist = distanceSegment(b.work, b.metric, ref, sport);
    const texteDist = dist != null ? (nage ? metres(dist) : kilometres(dist)) : '';
    const effort = [texteDuree(b.work.min), texteDist].filter(Boolean).join(' · ');
    const recup = b.type === 'interval' && b.rec ? [texteDuree(b.rec.min), texteCible(b.rec, b.metric, ref, sport)].join(' · ') : '';
    return {
      cle: String(i),
      // Le nom du genre de bloc (« Intervalles »), ou un nom court donné à la main ; les noms longs du Coach (« 3 × 1000 m à 5:00/km ») répèteraient les colonnes
      nom: b.name && b.name.length <= 22 && b.name !== NOM_TYPE[b.type] && !/\d/.test(b.name) ? b.name : NOM_TYPE[b.type],
      repetitions: b.type === 'interval' ? b.reps : 1,
      effort,
      cible: texteCible(b.work, b.metric, ref, sport),
      recup,
      zone: indiceZone(milieu(b.work), b.metric),
    };
  });
}

/** Une ligne du détail : la durée, la zone, la cible et un libellé (« Échauffement », « Récupération », la distance d'un effort…). */
export interface LigneDetail {
  duree: string;
  /** Indice de zone, 0 = Z1 */
  zone: number;
  /** La cible sans la zone : « 4:35–4:50/km », « 265–275 W », « 152 bpm ». */
  cible: string;
  libelle: string;
}

/** Une étape du détail : une ligne seule, ou un groupe de répétitions (effort + récupération) à encadrer avec son « 3× ». */
export type EtapeDetail = { genre: 'ligne'; ligne: LigneDetail } | { genre: 'groupe'; repetitions: number; lignes: LigneDetail[] };

const LIBELLE_BLOC: Record<string, string> = { warmup: 'Échauffement', cooldown: 'Retour au calme', recovery: 'Récupération', steady: 'Bloc continu', interval: '' };
const sansZone = (t: string): string => t.replace(/ · Z\d.*$/, '');

/** Le détail de la séance, bloc par bloc, en lignes compactes : un échauffement, un groupe « 3× » (effort puis récupération), un retour au calme. */
export function detailIntervalles(blocs: Bloc[], ref: Reference = {}, sport = 'Run'): EtapeDetail[] {
  const nage = sport === 'Swim' || sport === 'OpenWaterSwim';
  return blocs.map((b): EtapeDetail => {
    const dist = distanceSegment(b.work, b.metric, ref, sport);
    const texteDist = dist != null ? (nage ? metres(dist) : kilometres(dist)) : '';
    const travail: LigneDetail = {
      duree: texteDuree(b.work.min),
      zone: indiceZone(milieu(b.work), b.metric),
      cible: sansZone(texteCible(b.work, b.metric, ref, sport)),
      // Un effort d'intervalles dit sa distance (quand il y a une allure) ; les autres blocs portent leur nom
      libelle: b.type === 'interval' ? texteDist : LIBELLE_BLOC[b.type] || '',
    };
    if (b.type === 'interval') {
      const lignes = [travail];
      if (b.rec) lignes.push({ duree: texteDuree(b.rec.min), zone: indiceZone(milieu(b.rec), b.metric), cible: sansZone(texteCible(b.rec, b.metric, ref, sport)), libelle: 'Récupération' });
      return { genre: 'groupe', repetitions: b.reps, lignes };
    }
    return { genre: 'ligne', ligne: travail };
  });
}
