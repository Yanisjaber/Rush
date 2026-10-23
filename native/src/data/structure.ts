// Structure d'une séance (échauffement, intervalles, retour au calme…) : calculs purs, sans écran ni réseau. Port de app/src/lib/data/structure.js.
//
// FORMAT STOCKÉ (colonne `structure`, jsonb de activity_planned et activity_template) : le même que sur le site, pour que les séances déjà enregistrées restent lisibles.
// Un tableau de blocs :
//   { type, name, reps, metric: 'power' | 'hr' | 'pace', unit: 'zone' | 'pct', work: { min, int, intHi }, rec?: { min, int, intHi } }
// `min` = durée en minutes (décimale), `int` / `intHi` = intensité en % (de la FTP, de la FC max ou de l'allure de base), `intHi` null = valeur unique.
// `rec` n'existe que pour les blocs d'intervalles.

export type TypeBloc = 'warmup' | 'interval' | 'steady' | 'recovery' | 'cooldown';
export type Metrique = 'power' | 'hr' | 'pace';

export interface Segment {
  min: number;
  int: number;
  intHi: number | null;
}

export interface Bloc {
  type: TypeBloc;
  name: string;
  reps: number;
  metric: Metrique;
  unit: 'zone' | 'pct';
  work: Segment;
  rec?: Segment;
}

export const TYPES_BLOC: TypeBloc[] = ['warmup', 'interval', 'steady', 'recovery', 'cooldown'];
export const NOM_TYPE: Record<TypeBloc, string> = {
  warmup: 'Échauffement',
  interval: 'Intervalles',
  steady: 'Bloc continu',
  recovery: 'Récupération',
  cooldown: 'Retour au calme',
};
export const METRIQUES: Metrique[] = ['power', 'hr', 'pace'];
export const NOM_METRIQUE: Record<Metrique, string> = { power: 'Watts', hr: 'Cardio', pace: 'Allure' };

/** Zones par métrique : bornes basse (incluse) et haute en %. */
export const ZONES: Record<Metrique, { noms: string[]; bas: number[]; haut: number[] }> = {
  power: {
    noms: ['Z1 Récup', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Seuil', 'Z5 VO2max', 'Z6 Anaérobie', 'Z7 Sprint'],
    bas: [40, 56, 76, 91, 106, 121, 151],
    haut: [55, 75, 90, 105, 120, 150, 200],
  },
  hr: {
    noms: ['Z1 Récup', 'Z2 Aérobie', 'Z3 Tempo', 'Z4 Seuil', 'Z5 VO2max'],
    bas: [50, 60, 71, 83, 94],
    haut: [60, 70, 82, 93, 106],
  },
  pace: {
    noms: ['Z1 Footing', 'Z2 Endurance', 'Z3 Marathon', 'Z4 Seuil', 'Z5 VO2max'],
    bas: [60, 75, 85, 95, 106],
    haut: [75, 85, 95, 106, 125],
  },
};

/** Couleur de chaque zone, de Z1 (bleu) à Z7 (rose) : un code couleur d'information, partagé par toutes les métriques. */
export const COULEURS_ZONE = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899'];

export const MAX_BLOCS = 40;
const bornes = (v: number, min: number, max: number, repli: number): number => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : repli);

const SPORTS_ALLURE = ['Run', 'TrailRun', 'VirtualRun', 'Swim', 'OpenWaterSwim'];
const SPORTS_STRUCTURE = ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', ...SPORTS_ALLURE];

/** Métriques disponibles selon le sport (type brut) : vélo = watts ou cardio, course et natation = allure ou cardio. */
export const metriquesDuSport = (sport: string): Metrique[] => (SPORTS_ALLURE.includes(sport) ? ['pace', 'hr'] : ['power', 'hr']);

/** Le sport accepte-t-il une structure ? (vélo, course, natation) */
export const sportAvecStructure = (sport: string): boolean => SPORTS_STRUCTURE.includes(sport);

/** Un segment lu en base ou fabriqué par l'éditeur, avec des nombres bornés (une valeur incohérente revient à `repli`). */
function segmentPropre(s: unknown, repli: Segment): Segment {
  if (!s || typeof s !== 'object') return { ...repli };
  const o = s as Record<string, unknown>;
  const int = bornes(Number(o.int), 1, 400, repli.int);
  const hautBrut = o.intHi == null || o.intHi === '' ? null : Number(o.intHi);
  return {
    min: bornes(Number(o.min), 0.1, 600, repli.min),
    int,
    intHi: hautBrut != null && Number.isFinite(hautBrut) && hautBrut > 0 ? bornes(hautBrut, 1, 400, int) : null,
  };
}

/**
 * Nettoie une structure lue en base ou fabriquée par l'éditeur : types connus, nombres bornés, tailles limitées.
 * Une valeur incohérente est ramenée à un défaut raisonnable plutôt que de faire planter l'affichage. Ne renvoie jamais autre chose qu'une liste de blocs propres.
 */
export function normaliser(brut: unknown, metriqueParDefaut: Metrique = 'power'): Bloc[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .slice(0, MAX_BLOCS)
    .filter((b) => b && typeof b === 'object')
    .map((b: Record<string, unknown>) => {
      const type: TypeBloc = TYPES_BLOC.includes(b.type as TypeBloc) ? (b.type as TypeBloc) : 'steady';
      const metric: Metrique = METRIQUES.includes(b.metric as Metrique) ? (b.metric as Metrique) : metriqueParDefaut;
      const bloc: Bloc = {
        type,
        name: String(b.name ?? NOM_TYPE[type]).slice(0, 60) || NOM_TYPE[type],
        reps: type === 'interval' ? Math.round(bornes(Number(b.reps), 1, 99, 4)) : 1,
        metric,
        unit: b.unit === 'pct' ? 'pct' : 'zone',
        work: segmentPropre(b.work, { min: 10, int: 60, intHi: null }),
      };
      if (type === 'interval') bloc.rec = segmentPropre(b.rec, { min: 3, int: 40, intHi: 55 });
      return bloc;
    });
}

/** Intensité moyenne (%) d'un segment. */
export const milieu = (seg: Segment): number => (seg.intHi != null ? (seg.int + seg.intHi) / 2 : seg.int);

/** Indice de zone d'une intensité (%), selon les bornes basses de la métrique. */
export function indiceZone(pct: number, metric: Metrique): number {
  const z = ZONES[metric] || ZONES.power;
  for (let k = z.bas.length - 1; k >= 0; k--) if (pct >= z.bas[k]) return k;
  return 0;
}

/** Les segments d'un bloc, dans l'ordre où ils sont réalisés (travail, récup, travail, récup…). */
export function segmentsDuBloc(b: Bloc): { seg: Segment; role: 'travail' | 'recup' }[] {
  const liste: { seg: Segment; role: 'travail' | 'recup' }[] = [];
  for (let i = 0; i < b.reps; i++) {
    liste.push({ seg: b.work, role: 'travail' });
    if (b.type === 'interval' && b.rec) liste.push({ seg: b.rec, role: 'recup' });
  }
  return liste;
}

/** Tous les segments de toute la structure, avec la métrique de leur bloc. */
export const tousSegments = (blocs: Bloc[]): { seg: Segment; role: 'travail' | 'recup'; metric: Metrique }[] => blocs.flatMap((b) => segmentsDuBloc(b).map((s) => ({ ...s, metric: b.metric })));

/** Le profil d'une structure pour la dessiner : une barre par segment, avec sa durée (minutes) et sa zone (0 = Z1). */
export const profilStructure = (blocs: Bloc[]): { min: number; zone: number }[] => tousSegments(blocs).map(({ seg, metric }) => ({ min: seg.min, zone: indiceZone(milieu(seg), metric) }));

/** Les références pour traduire des pourcentages en watts, battements ou allures. `allureBase` : secondes par km (course) ou par 100 m (natation), à 100 %. */
export interface Reference {
  ftp?: number | null;
  hrMax?: number | null;
  allureBase?: number | null;
}

const estNage = (sport: string) => ['Swim', 'OpenWaterSwim'].includes(sport);
const valeursRef = (ref: Reference, sport: string) => ({
  ftp: (ref.ftp ?? 0) > 0 ? (ref.ftp as number) : 250,
  hrMax: (ref.hrMax ?? 0) > 0 ? (ref.hrMax as number) : 190,
  allureBase: (ref.allureBase ?? 0) > 0 ? (ref.allureBase as number) : estNage(sport) ? 100 : 240,
});

export interface ResumeStructure {
  dureeMin: number;
  tss: number;
  facteurIntensite: number;
  kj: number | null;
  watts: number | null;
  bpm: number | null;
  km: number | null;
}

/** Résumé chiffré d'une structure : durée, charge (TSS), facteur d'intensité, énergie, puissance et cardio moyens, distance. */
export function resume(blocs: Bloc[], ref: Reference = {}, sport = 'Ride'): ResumeStructure {
  const { ftp, hrMax, allureBase } = valeursRef(ref, sport);
  const nage = estNage(sport);
  let duree = 0;
  let tss = 0;
  let kj = 0;
  let wMin = 0;
  let wPct = 0;
  let hMin = 0;
  let hPct = 0;
  let distance = 0;
  for (const { seg, metric } of tousSegments(blocs)) {
    const f = milieu(seg) / 100;
    duree += seg.min;
    tss += (seg.min / 60) * f * f * 100;
    if (metric === 'power') {
      kj += (seg.min * 60 * f * ftp) / 1000;
      wMin += seg.min;
      wPct += seg.min * f;
    } else if (metric === 'hr') {
      hMin += seg.min;
      hPct += seg.min * f;
    } else if (metric === 'pace' && f > 0) {
      const secParUnite = allureBase / f; // plus l'intensité est haute, plus l'allure est rapide
      distance += (seg.min * 60) / secParUnite;
    }
  }
  return {
    dureeMin: Math.round(duree),
    tss: Math.round(tss),
    facteurIntensite: duree > 0 ? Math.round(Math.sqrt(tss / (duree / 60) / 100) * 100) / 100 : 0,
    kj: kj > 0 ? Math.round(kj) : null,
    watts: wMin > 0 ? Math.round((wPct / wMin) * ftp) : null,
    bpm: hMin > 0 ? Math.round((hPct / hMin) * hrMax) : null,
    km: distance > 0 ? Math.round((nage ? distance / 10 : distance) * 100) / 100 : null,
  };
}

const allureTexte = (s: number): string => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Texte de la cible d'un segment : « 210–245 W · Z4 », « 4:12/km · Z4 »… */
export function texteCible(seg: Segment, metric: Metrique, ref: Reference = {}, sport = 'Run'): string {
  const { ftp, hrMax, allureBase } = valeursRef(ref, sport);
  const zone = (ZONES[metric] || ZONES.power).noms[indiceZone(milieu(seg), metric)].split(' ')[0];
  const bas = seg.intHi != null ? Math.min(seg.int, seg.intHi) : seg.int;
  const haut = seg.intHi != null ? Math.max(seg.int, seg.intHi) : seg.int;
  const unique = seg.intHi == null;
  if (metric === 'power') return `${unique ? Math.round((ftp * bas) / 100) : `${Math.round((ftp * bas) / 100)}–${Math.round((ftp * haut) / 100)}`} W · ${zone}`;
  if (metric === 'hr') return `${unique ? Math.round((hrMax * bas) / 100) : `${Math.round((hrMax * bas) / 100)}–${Math.round((hrMax * haut) / 100)}`} bpm · ${zone}`;
  const allure = (pct: number) => allureTexte((allureBase * 100) / Math.max(1, pct));
  return `${unique ? allure(bas) : `${allure(haut)}–${allure(bas)}`}${estNage(sport) ? '/100 m' : '/km'} · ${zone}`;
}

/** Durée écrite librement → minutes : « 15 », « 15min », « 45s », « 1h30 », « 4:30 », « 1,5 ». Renvoie null si illisible. */
export function lireDuree(texte: unknown): number | null {
  const v = String(texte ?? '').trim().toLowerCase().replace(',', '.').replace(/\s+/g, '').replace(/’/g, "'");
  if (!v) return null;
  let m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
  m = /^(\d+):(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = /^(\d+)h(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)(?:min|mn|m|'))?(?:(\d+(?:\.\d+)?)(?:sec|s|"))?$/.exec(v);
  if (m && (m[1] || m[2] || m[3])) return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0) + (Number(m[3]) || 0) / 60;
  const f = Number(v);
  return Number.isFinite(f) && f > 0 ? f : null;
}

/** Durée en minutes → texte court : « 4 min », « 45 s », « 1h05 », « 4:30 ». */
export function texteDuree(min: number): string {
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h${String(m).padStart(2, '0')}`;
  if (m && r) return `${m}:${String(r).padStart(2, '0')}`;
  if (!m) return `${r} s`;
  return `${m} min`;
}

/** La durée totale d'une structure, en minutes. */
export const dureeTotale = (blocs: Bloc[]): number => tousSegments(blocs).reduce((t, { seg }) => t + seg.min, 0);
