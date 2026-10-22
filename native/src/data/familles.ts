// Rapproche les types de sport bruts (ceux de Strava, stockés dans activities.sport)
// des sports de l'app (voir theme/sports.ts) : un sport = une famille = une couleur.
// Port de app/src/lib/data/familles.js.

const FAMILLES: Record<string, string> = {
  // Vélo
  Ride: 'velo',
  VirtualRide: 'velo',
  GravelRide: 'velo',
  MountainBikeRide: 'velo',
  EBikeRide: 'velo',
  EMountainBikeRide: 'velo',
  Handcycle: 'velo',
  // Course à pied (le trail en fait partie)
  Run: 'course',
  VirtualRun: 'course',
  TrailRun: 'course',
  // Natation et eau
  Swim: 'natation',
  Rowing: 'aviron',
  VirtualRow: 'aviron',
  // Force. « Workout » est le type générique de Strava : on le range avec la muscu, comme le yoga, le pilates, le CrossFit et le HIIT
  WeightTraining: 'muscu',
  Workout: 'muscu',
  Yoga: 'muscu',
  Pilates: 'muscu',
  Crossfit: 'muscu',
  Hyrox: 'hyrox', // type propre à l'app : Strava n'a pas de sport Hyrox
  Triathlon: 'triathlon', // types propres à l'app : un sport à part, pas la somme de course, vélo et natation
  Duathlon: 'duathlon',
  Athletics: 'athletisme', // compte dans la charge, mais n'a pas de page (voir SPORTS_SANS_PAGE)
  HighIntensityIntervalTraining: 'muscu',
  // Ski et glisse
  NordicSki: 'ski',
  BackcountrySki: 'ski',
  AlpineSki: 'ski',
  Snowboard: 'ski',
  RollerSki: 'ski',
  // Machines d'endurance en salle : de la course à pied pour la charge et la forme
  Elliptical: 'course',
  StairStepper: 'course',
  // Combat
  Boxing: 'combat',
  MartialArts: 'combat',
  // Autres sports de performance
  Hike: 'rando',
  Walk: 'rando', // la marche reste classée avec la randonnée (calendrier, bilan) ; l'accueil l'écarte, voir sansMarche (api.ts)
  Snowshoe: 'rando',
  RockClimbing: 'escalade',
  Canoeing: 'pagaie',
  Kayaking: 'pagaie',
  StandUpPaddling: 'pagaie',
};

/** Famille d'un type de sport brut. Tout ce qui est inconnu (foot, tennis, golf…) devient « autre ». */
export function familleSport(typeBrut: unknown): string {
  // Object.hasOwn : on ignore les propriétés héritées d'un objet ('constructor', '__proto__'…)
  return typeof typeBrut === 'string' && Object.hasOwn(FAMILLES, typeBrut) ? FAMILLES[typeBrut] : 'autre';
}

/** La famille d'un type de sport brut, pour les graphiques et les filtres (le vélo de route, le VTT et le gravel sont du vélo ; le trail est de la course). */
export const familleAffichage = familleSport;

/**
 * Les pastilles qui regroupent plusieurs disciplines (le CrossFit garde aussi la musculation) : un triathlète a ses séances en natation, vélo et course, pas en « triathlon »
 * (type propre à l'app, pour une course ou une saisie à la main). Leur onglet garde donc toutes ses disciplines.
 */
export const DISCIPLINES_DU_FILTRE: Record<string, readonly string[]> = {
  triathlon: ['triathlon', 'natation', 'velo', 'course'],
  duathlon: ['duathlon', 'velo', 'course'],
};

/**
 * Les types Strava de l'onglet « Ski de fond » : le ski de fond, le ski à roulettes (l'entraînement de l'été) et le ski hors-piste.
 * Le ski alpin et le snowboard font partie de la famille « ski » mais pas de cet onglet : ils ne se voient que sous « Tout ».
 */
export const SKI_DE_FOND: readonly string[] = ['NordicSki', 'RollerSki', 'BackcountrySki'];

/** Une séance passe-t-elle le filtre de l'accueil ? Le sport de la pastille (Triathlon et Duathlon regroupent leurs disciplines) ; « tout » garde tout. */
export function garderSeance(seance: { sport?: string } | null | undefined, filtre = 'tout'): boolean {
  if (filtre === 'tout') return true;
  if (filtre === 'ski') return typeof seance?.sport === 'string' && SKI_DE_FOND.includes(seance.sport);
  const famille = familleSport(seance?.sport);
  return Object.hasOwn(DISCIPLINES_DU_FILTRE, filtre) ? DISCIPLINES_DU_FILTRE[filtre].includes(famille) : famille === filtre;
}
