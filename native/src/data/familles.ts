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
  Athletics: 'athletisme', // compte dans la charge, mais n'a pas de page (voir SPORTS_SANS_PAGE)
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

/**
 * La pastille de la barre des sports pour un type brut : Trail et VTT / Gravel sont des sports à part entière (leur propre pastille
 * et leur propre filtre), alors que les graphiques les regroupent avec la course et le vélo (voir familleAffichage).
 */
export function familleBarre(typeBrut: unknown): string {
  if (typeBrut === 'MountainBikeRide' || typeBrut === 'EMountainBikeRide' || typeBrut === 'GravelRide') return 'vtt';
  return familleSport(typeBrut);
}

/** Les widgets ne connaissent que course, vélo… : trail → course, vtt → vélo pour savoir lesquels afficher. */
export const familleDesWidgets = (famille: string): string => (famille === 'trail' ? 'course' : famille === 'vtt' ? 'velo' : famille);

/** Regroupe les familles proches pour les graphiques (trail compte comme de la course). */
export function familleAffichage(typeBrut: unknown): string {
  const f = familleSport(typeBrut);
  return f === 'trail' ? 'course' : f;
}

/**
 * Les pastilles qui regroupent plusieurs disciplines : un triathlète a ses séances en natation, vélo et course, pas en « triathlon »
 * (type propre à l'app, pour une course ou une saisie à la main). Leur onglet garde donc toutes ses disciplines.
 */
export const DISCIPLINES_DU_FILTRE: Record<string, readonly string[]> = {
  triathlon: ['triathlon', 'natation', 'velo', 'vtt', 'course', 'trail'],
  duathlon: ['duathlon', 'velo', 'vtt', 'course', 'trail'],
};

/** Une séance passe-t-elle le filtre de l'accueil ? Le sport de la pastille (Trail et VTT ont la leur, Triathlon et Duathlon regroupent leurs disciplines) ; « tout » garde tout. */
export function garderSeance(seance: { sport?: string } | null | undefined, filtre = 'tout'): boolean {
  if (filtre === 'tout') return true;
  const famille = familleBarre(seance?.sport);
  return Object.hasOwn(DISCIPLINES_DU_FILTRE, filtre) ? DISCIPLINES_DU_FILTRE[filtre].includes(famille) : famille === filtre;
}
