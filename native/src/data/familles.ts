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
  // Course à pied (le trail garde sa propre entrée, même couleur)
  Run: 'course',
  VirtualRun: 'course',
  TrailRun: 'trail',
  // Natation et eau
  Swim: 'natation',
  Rowing: 'aviron',
  VirtualRow: 'aviron',
  // Force et hybride. « Workout » est le type générique de Strava : on le range avec la muscu, comme le yoga et le pilates
  WeightTraining: 'muscu',
  Workout: 'muscu',
  Yoga: 'muscu',
  Pilates: 'muscu',
  Crossfit: 'crossfit',
  Hyrox: 'hyrox', // type propre à l'app : Strava n'a pas de sport Hyrox
  Triathlon: 'triathlon', // types propres à l'app : un sport à part, pas la somme de course, vélo et natation
  Duathlon: 'duathlon',
  Athletics: 'athletisme',
  HighIntensityIntervalTraining: 'crossfit',
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
  Walk: 'rando', // la marche rejoint la randonnée
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

/** Regroupe les familles proches pour les graphiques (trail compte comme de la course). */
export function familleAffichage(typeBrut: unknown): string {
  const f = familleSport(typeBrut);
  return f === 'trail' ? 'course' : f;
}

/**
 * Une séance passe-t-elle le filtre de l'accueil ? Le sport (la famille), puis, pour l'athlétisme, la discipline choisie dans la
 * deuxième barre ('tout' = toutes). Une séance d'athlétisme sans discipline n'apparaît que sous « Tout ».
 */
export function garderSeance(seance: { sport?: string; discipline?: string | null } | null | undefined, filtre = 'tout', discipline = 'tout'): boolean {
  if (filtre === 'tout') return true;
  if (familleAffichage(seance?.sport) !== filtre) return false;
  return filtre !== 'athletisme' || discipline === 'tout' || seance?.discipline === discipline;
}
