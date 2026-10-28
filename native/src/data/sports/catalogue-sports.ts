// Le catalogue de tous les sports de l'app : un type (celui de Strava, stocké dans activities.sport) = un nom, une famille, une couleur.
// La famille est celle de la barre du haut (course, velo, natation…) ; tout ce qui n'a pas de famille est « autre » et porte un groupe
// (Hiver, Eau…) qui range la liste de choix. Les types « Hyrox », « Triathlon », « Duathlon » et « Other » sont propres à l'app, Strava ne les envoie pas.
// Les couleurs : les 5 sports principaux gardent celles de l'app (theme/couleurs.ts), les autres ont une teinte à eux (sombre / clair).

export interface SportCatalogue {
  type: string;
  nom: string;
  /** Nom court, pour les pastilles et les listes serrées. */
  court: string;
  famille: string;
  /** Les sports sans famille (famille « autre ») sont rangés par groupe dans la liste de choix. */
  groupe: string | null;
  /** Couleur en thème sombre et en thème clair. */
  couleur: { sombre: string; clair: string };
}

export const CATALOGUE: readonly SportCatalogue[] = [
  { type: 'Run', nom: 'Course à pied', court: 'Course', famille: 'course', groupe: null, couleur: { sombre: '#ff7a33', clair: '#e85d0c' } },
  { type: 'TrailRun', nom: 'Trail', court: 'Trail', famille: 'course', groupe: null, couleur: { sombre: '#42bd6b', clair: '#256a3c' } },
  { type: 'VirtualRun', nom: 'Course virtuelle', court: 'Course virt.', famille: 'course', groupe: null, couleur: { sombre: '#ffa97a', clair: '#e04f00' } },
  { type: 'Elliptical', nom: 'Elliptique', court: 'Elliptique', famille: 'course', groupe: null, couleur: { sombre: '#ffa947', clair: '#d67200' } },
  { type: 'StairStepper', nom: 'Escalier (machine)', court: 'Escalier', famille: 'course', groupe: null, couleur: { sombre: '#e16047', clair: '#9e301a' } },
  { type: 'Ride', nom: 'Vélo de route', court: 'Cyclisme', famille: 'velo', groupe: null, couleur: { sombre: '#4f8cff', clair: '#2f6fe8' } },
  { type: 'GravelRide', nom: 'Gravel', court: 'Gravel', famille: 'velo', groupe: null, couleur: { sombre: '#8888f2', clair: '#1616ca' } },
  { type: 'MountainBikeRide', nom: 'VTT', court: 'VTT', famille: 'velo', groupe: null, couleur: { sombre: '#ba7a3b', clair: '#6d4722' } },
  { type: 'EBikeRide', nom: 'Vélo électrique', court: 'Vélo élec.', famille: 'velo', groupe: null, couleur: { sombre: '#3dbeff', clair: '#0088cc' } },
  { type: 'EMountainBikeRide', nom: 'VTT électrique', court: 'VTT élec.', famille: 'velo', groupe: null, couleur: { sombre: '#ceab64', clair: '#93722f' } },
  { type: 'VirtualRide', nom: 'Vélo virtuel', court: 'Vélo virt.', famille: 'velo', groupe: null, couleur: { sombre: '#a3c3ff', clair: '#004fe0' } },
  { type: 'Handcycle', nom: 'Handbike', court: 'Handbike', famille: 'velo', groupe: null, couleur: { sombre: '#a47de8', clair: '#5b22bf' } },
  { type: 'Velomobile', nom: 'Vélomobile', court: 'Vélomobile', famille: 'velo', groupe: null, couleur: { sombre: '#869ab6', clair: '#4d6280' } },
  { type: 'Swim', nom: 'Natation', court: 'Natation', famille: 'natation', groupe: null, couleur: { sombre: '#22d3ee', clair: '#0788a0' } },
  { type: 'WeightTraining', nom: 'Musculation', court: 'Muscu', famille: 'muscu', groupe: null, couleur: { sombre: '#ff5a4f', clair: '#e63b30' } },
  { type: 'Workout', nom: 'Entraînement', court: 'Entraînement', famille: 'muscu', groupe: null, couleur: { sombre: '#ffa099', clair: '#e00f00' } },
  { type: 'Crossfit', nom: 'CrossFit', court: 'CrossFit', famille: 'muscu', groupe: null, couleur: { sombre: '#e02947', clair: '#861326' } },
  { type: 'HighIntensityIntervalTraining', nom: 'HIIT', court: 'HIIT', famille: 'muscu', groupe: null, couleur: { sombre: '#f04c88', clair: '#bd0f4f' } },
  { type: 'Yoga', nom: 'Yoga', court: 'Yoga', famille: 'muscu', groupe: null, couleur: { sombre: '#bb91f3', clair: '#6416ca' } },
  { type: 'Pilates', nom: 'Pilates', court: 'Pilates', famille: 'muscu', groupe: null, couleur: { sombre: '#d9a5e9', clair: '#942db4' } },
  { type: 'Hyrox', nom: 'Hyrox', court: 'Hyrox', famille: 'hyrox', groupe: null, couleur: { sombre: '#ffd60a', clair: '#c99a00' } },
  { type: 'Triathlon', nom: 'Triathlon', court: 'Triathlon', famille: 'triathlon', groupe: null, couleur: { sombre: '#f53d68', clair: '#b80a32' } },
  { type: 'Duathlon', nom: 'Duathlon', court: 'Duathlon', famille: 'duathlon', groupe: null, couleur: { sombre: '#ff8595', clair: '#e0001e' } },
  { type: 'NordicSki', nom: 'Ski de fond', court: 'Ski de fond', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#8bcbf9', clair: '#0b81d5' } },
  { type: 'AlpineSki', nom: 'Ski alpin', court: 'Ski alpin', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#718bf4', clair: '#1137d0' } },
  { type: 'BackcountrySki', nom: 'Ski de randonnée', court: 'Ski rando', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#a097ed', clair: '#3122bf' } },
  { type: 'RollerSki', nom: 'Ski à roulettes', court: 'Ski roulettes', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#6cc8da', clair: '#2b96ab' } },
  { type: 'Snowboard', nom: 'Snowboard', court: 'Snowboard', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#c87de8', clair: '#9022bf' } },
  { type: 'Snowshoe', nom: 'Raquettes à neige', court: 'Raquettes', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#dea3e0', clair: '#a538a8' } },
  { type: 'IceSkate', nom: 'Patin à glace', court: 'Patin', famille: 'autre', groupe: 'Hiver', couleur: { sombre: '#c4e3f3', clair: '#2789b9' } },
  { type: 'Rowing', nom: 'Aviron', court: 'Aviron', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#008ff5', clair: '#00538f' } },
  { type: 'VirtualRow', nom: 'Aviron virtuel', court: 'Aviron virt.', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#7dbbe8', clair: '#227dbf' } },
  { type: 'Canoeing', nom: 'Canoë', court: 'Canoë', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#1fad91', clair: '#157965' } },
  { type: 'Kayaking', nom: 'Kayak', court: 'Kayak', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#29e0a3', clair: '#138660' } },
  { type: 'StandUpPaddling', nom: 'Paddle', court: 'Paddle', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#4bd284', clair: '#238b4e' } },
  { type: 'Surfing', nom: 'Surf', court: 'Surf', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#35b64a', clair: '#206f2d' } },
  { type: 'Kitesurf', nom: 'Kitesurf', court: 'Kitesurf', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#00ccc5', clair: '#008f8a' } },
  { type: 'Windsurf', nom: 'Windsurf', court: 'Windsurf', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#65d454', clair: '#339325' } },
  { type: 'Sail', nom: 'Voile', court: 'Voile', famille: 'autre', groupe: 'Eau', couleur: { sombre: '#527ce0', clair: '#1d46a5' } },
  { type: 'Hike', nom: 'Randonnée', court: 'Rando', famille: 'autre', groupe: 'Montagne et marche', couleur: { sombre: '#85ba3b', clair: '#4e6d22' } },
  { type: 'Walk', nom: 'Marche', court: 'Marche', famille: 'autre', groupe: 'Montagne et marche', couleur: { sombre: '#92d864', clair: '#519325' } },
  { type: 'RockClimbing', nom: 'Escalade', court: 'Escalade', famille: 'autre', groupe: 'Montagne et marche', couleur: { sombre: '#d05825', clair: '#793315' } },
  { type: 'Tennis', nom: 'Tennis', court: 'Tennis', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#d4ee2b', clair: '#899c0d' } },
  { type: 'Padel', nom: 'Padel', court: 'Padel', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#93c322', clair: '#5b7915' } },
  { type: 'Squash', nom: 'Squash', court: 'Squash', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#e3df63', clair: '#9c981c' } },
  { type: 'Badminton', nom: 'Badminton', court: 'Badminton', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#92d671', clair: '#4b8e29' } },
  { type: 'TableTennis', nom: 'Tennis de table', court: 'Ping-pong', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#ec799c', clair: '#c41c4f' } },
  { type: 'Pickleball', nom: 'Pickleball', court: 'Pickleball', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#f7dc6e', clair: '#ae8d09' } },
  { type: 'Racquetball', nom: 'Racquetball', court: 'Racquetball', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#f4a32a', clair: '#a56609' } },
  { type: 'Golf', nom: 'Golf', court: 'Golf', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#30913d', clair: '#246b2d' } },
  { type: 'Soccer', nom: 'Football', court: 'Foot', famille: 'autre', groupe: 'Raquettes et balles', couleur: { sombre: '#4fd1a5', clair: '#1a7f5e' } },
  { type: 'Skateboard', nom: 'Skateboard', court: 'Skate', famille: 'autre', groupe: 'Roulettes', couleur: { sombre: '#d879d0', clair: '#ae32a4' } },
  { type: 'InlineSkate', nom: 'Roller', court: 'Roller', famille: 'autre', groupe: 'Roulettes', couleur: { sombre: '#e755b6', clair: '#b31980' } },
  { type: 'Wheelchair', nom: 'Fauteuil roulant', court: 'Fauteuil', famille: 'autre', groupe: 'Divers', couleur: { sombre: '#8199bb', clair: '#476185' } },
  { type: 'Other', nom: 'Autre sport', court: 'Autre', famille: 'autre', groupe: 'Divers', couleur: { sombre: '#9aa2ac', clair: '#606976' } },
];

const PAR_TYPE: ReadonlyMap<string, SportCatalogue> = new Map(CATALOGUE.map((s) => [s.type, s]));

/** Le sport du catalogue pour un type brut (Run, Rowing…), ou null si l'app ne le connaît pas. */
export function sportDuType(type: unknown): SportCatalogue | null {
  return typeof type === 'string' ? (PAR_TYPE.get(type) ?? null) : null;
}

/** Le nom d'un type brut à afficher. Un type que l'app ne connaît pas garde son nom brut (jamais perdu), sans type : « Activité ». */
export function nomDuType(type: unknown): string {
  return sportDuType(type)?.nom ?? (typeof type === 'string' && type ? type : 'Activité');
}

/** La couleur d'un type brut dans le thème donné ; un type inconnu prend le gris neutre. */
export function couleurDuType(type: unknown, theme: 'sombre' | 'clair'): string {
  return (sportDuType(type) ?? PAR_TYPE.get('Other')!).couleur[theme];
}

/** Les groupes de la liste de choix des sports sans famille, dans l'ordre d'affichage. */
export const GROUPES_AUTRES: readonly string[] = ['Hiver', 'Eau', 'Montagne et marche', 'Raquettes et balles', 'Roulettes', 'Divers'];

/** Les sports de la barre du haut, dans l'ordre de la liste de choix. */
export const FAMILLES_PRINCIPALES: readonly string[] = ['course', 'velo', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon'];

/** Le sport de base d'une famille de la barre du haut (course → Run…), pour dessiner ou nommer une famille. « autre » donne `Other`. */
export const TYPE_DE_FAMILLE: Readonly<Record<string, string>> = { course: 'Run', velo: 'Ride', natation: 'Swim', muscu: 'WeightTraining', hyrox: 'Hyrox', triathlon: 'Triathlon', duathlon: 'Duathlon', autre: 'Other' };

/** Le type du catalogue à dessiner pour un sport donné : un type connu, une famille (course…) ou, à défaut, `Other`. */
export function typeADessiner(sport: unknown): string {
  if (typeof sport !== 'string') return 'Other';
  if (PAR_TYPE.has(sport)) return sport;
  return Object.hasOwn(TYPE_DE_FAMILLE, sport) ? TYPE_DE_FAMILLE[sport] : 'Other';
}

/** Le nom court d'un type brut (pastilles, listes serrées). Un type inconnu garde son nom brut, sans type : « Activité ». */
export function courtDuType(type: unknown): string {
  return sportDuType(type)?.court ?? nomDuType(type);
}
