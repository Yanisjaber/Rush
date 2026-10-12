// Rapproche les types de sport bruts (ceux de Strava, stockés dans activities.sport)
// des sports de la v2 (voir lib/sports.js) : un sport = une famille = une couleur.

const FAMILLES = {
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
  // Force et hybride
  WeightTraining: 'muscu',
  Crossfit: 'crossfit',
  HighIntensityIntervalTraining: 'crossfit',
  // Ski
  NordicSki: 'ski',
  BackcountrySki: 'ski',
  // Combat
  Boxing: 'combat',
  MartialArts: 'combat',
};

/** Famille d'un type de sport brut. Tout ce qui est inconnu (marche, foot, « Workout »…) devient « autre ». */
export function familleSport(typeBrut) {
  // Object.hasOwn : on ignore les propriétés héritées d'un objet ('constructor', '__proto__'…)
  return typeof typeBrut === 'string' && Object.hasOwn(FAMILLES, typeBrut) ? FAMILLES[typeBrut] : 'autre';
}

/** Regroupe les familles proches pour les graphiques (trail compte comme de la course). */
export function familleAffichage(typeBrut) {
  const f = familleSport(typeBrut);
  return f === 'trail' ? 'course' : f;
}
