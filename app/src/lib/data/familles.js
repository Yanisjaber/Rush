// Rapproche les types de sport bruts (ceux de Strava, stockés dans activities.sport)
// des sports de l'app (voir lib/sports.js) : un sport = une famille = une couleur.

const FAMILLES = {
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
  // Force et hybride. « Workout » est le type générique de Strava (séance en salle, renforcement) : on le range avec la muscu,
  // comme le yoga, le pilates, le CrossFit et le HIIT (gainage, mobilité, renforcement) : ce sont des séances de travail du corps.
  WeightTraining: 'muscu',
  Workout: 'muscu',
  Yoga: 'muscu',
  Pilates: 'muscu',
  // « Other » : type interne de l'app pour une séance prévue « Autre sport » (ce n'est pas un type Strava) : il reste dans « autre »
  Crossfit: 'muscu',
  Hyrox: 'hyrox', // type propre à l'app : Strava n'a pas de sport Hyrox
  Triathlon: 'triathlon', // types propres à l'app (Strava n'a pas de séance « triathlon ») : un sport à part, pas la somme de course, vélo et natation
  Duathlon: 'duathlon',
  HighIntensityIntervalTraining: 'muscu',
  // Machines d'endurance en salle : de la course à pied pour la charge et la forme
  Elliptical: 'course',
  StairStepper: 'course',
  // Tout le reste (ski, aviron, combat, randonnée, escalade, canoë, athlétisme, tennis…) n'est pas listé : c'est « autre » (l'onglet « Autres »)
};

/** Famille d'un type de sport brut. Tout ce qui est inconnu (foot, tennis, golf…) devient « autre ». */
export function familleSport(typeBrut) {
  // Object.hasOwn : on ignore les propriétés héritées d'un objet ('constructor', '__proto__'…)
  return typeof typeBrut === 'string' && Object.hasOwn(FAMILLES, typeBrut) ? FAMILLES[typeBrut] : 'autre';
}

/** La famille utilisée pour les graphiques et les filtres : la même que celle du sport (le trail est de la course, le VTT et le gravel du vélo). */
export const familleAffichage = familleSport;

/** Une séance passe-t-elle le filtre de l'accueil ? Sa famille (le trail est de la course) ; « tout » garde tout. */
export function garderSeance(seance, filtre = 'tout') {
  if (filtre === 'tout') return true;
  return familleAffichage(seance?.sport) === filtre;
}
