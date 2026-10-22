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
  // Force. « Workout » est le type générique de Strava : on le range avec la muscu, comme le yoga, le pilates, le CrossFit et le HIIT
  WeightTraining: 'muscu',
  Workout: 'muscu',
  Yoga: 'muscu',
  Pilates: 'muscu',
  Crossfit: 'muscu',
  Hyrox: 'hyrox', // type propre à l'app : Strava n'a pas de sport Hyrox
  Triathlon: 'triathlon', // types propres à l'app : un sport à part, pas la somme de course, vélo et natation
  Duathlon: 'duathlon',
  HighIntensityIntervalTraining: 'muscu',
  // Machines d'endurance en salle : de la course à pied pour la charge et la forme
  Elliptical: 'course',
  StairStepper: 'course',
  // Tout le reste (ski, aviron, combat, randonnée, escalade, canoë, athlétisme, tennis…) n'est pas listé : c'est « autre » (l'onglet « Autres »)
  // La marche est écartée de l'accueil, voir sansMarche (api.ts)
};

/** Famille d'un type de sport brut. Tout ce qui n'est pas une variante d'un sport proposé (ski, aviron, randonnée, tennis…) devient « autre ». */
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

/** Les types Strava que comptent les widgets de ski de fond (rangés dans « Autres ») : le ski de fond, le ski à roulettes et le ski hors-piste, pas le ski alpin ni le snowboard. */
export const SKI_DE_FOND: readonly string[] = ['NordicSki', 'RollerSki', 'BackcountrySki'];

/** Une séance passe-t-elle le filtre de l'accueil ? Le sport de la pastille (Triathlon et Duathlon regroupent leurs disciplines) ; « tout » garde tout. */
export function garderSeance(seance: { sport?: string } | null | undefined, filtre = 'tout'): boolean {
  if (filtre === 'tout') return true;
  const famille = familleSport(seance?.sport);
  return Object.hasOwn(DISCIPLINES_DU_FILTRE, filtre) ? DISCIPLINES_DU_FILTRE[filtre].includes(famille) : famille === filtre;
}
