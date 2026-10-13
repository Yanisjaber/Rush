/* src/core/sports-catalog.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


// Fallback de catégorie → libellé FR (utilisé quand raw_type Strava est absent)
export const SPORT_CATEGORY_FR = {
  cyclisme: 'Cyclisme',
  course: 'Course à pied',
  natation: 'Natation',
  musculation: 'Musculation',
  triathlon: 'Triathlon',
  autre: 'Autre',
};


// Catégorie de couleur fine (pour les pills colorées dans le calendrier)
// Bcp plus granulaire que la catégorie interne — chaque "famille" a sa teinte
export const SPORT_COLOR_KEY = {
  Triathlon: 'triathlon', Duathlon: 'triathlon', Aquathlon: 'triathlon', Aquabike: 'triathlon',
  Ride: 'cyclisme', VirtualRide: 'cyclisme', GravelRide: 'cyclisme',
  EBikeRide: 'cyclisme', Velomobile: 'cyclisme', Handcycle: 'cyclisme',
  MountainBikeRide: 'vtt', EMountainBikeRide: 'vtt',
  Run: 'course', VirtualRun: 'course',
  TrailRun: 'trail',
  Swim: 'natation', OpenWaterSwim: 'natation',
  WeightTraining: 'musculation', Workout: 'musculation', Crossfit: 'musculation',
  Elliptical: 'musculation', StairStepper: 'musculation', VirtualWorkout: 'musculation',
  Walk: 'marche', Hike: 'marche', Snowshoe: 'marche',
  AlpineSki: 'ski', BackcountrySki: 'ski', NordicSki: 'ski', Snowboard: 'ski',
  IceSkate: 'ski', InlineSkate: 'ski',
  Rowing: 'nautique', Kayaking: 'nautique', Canoeing: 'nautique',
  StandUpPaddling: 'nautique', Surfing: 'nautique', Windsurf: 'nautique',
  Kitesurf: 'nautique', Sailing: 'nautique',
  Soccer: 'football', Basketball: 'collectif', Volleyball: 'collectif',
  Hockey: 'collectif', AmericanFootball: 'collectif', Cricket: 'collectif',
  Tennis: 'raquette', Squash: 'raquette', Badminton: 'raquette', TableTennis: 'raquette',
  Yoga: 'yoga', Pilates: 'yoga', Stretching: 'yoga',
  RockClimbing: 'escalade',
  Boxing: 'combat',
  Dance: 'autre', Golf: 'autre', Skateboard: 'autre',
  Wheelchair: 'autre', Transition: 'autre',
};


// Mapping catégorie interne → couleur (fallback quand pas de raw_type)
export const SPORT_COLOR_FROM_CATEGORY = {
  cyclisme: 'cyclisme',
  course: 'course',
  natation: 'natation',
  musculation: 'musculation',
  autre: 'autre',
};

export function bootSportsCatalog() {


// Tracker des charts modal pour les détruire à la prochaine ouverture
// ============================================================
// CATALOGUE DE SPORTS — tous les types reconnus par intervals.icu
// Key = type Strava/intervals.icu, value = { fr, category, icon }
// Utilisé pour : catégorisation activités, sélecteur sport pour
// création d'entraînements futurs, filtres, affichage modal.
// ============================================================
// Catalogue aligné sur les libellés FR officiels Strava (ce que tu vois sur strava.com)
window.SPORTS_CATALOG = {
  // Triathlon & enchaînements (sport à part entière)
  Triathlon: { fr: 'Triathlon', category: 'triathlon', icon: '🏊🚴🏃' },
  Duathlon: { fr: 'Duathlon', category: 'triathlon', icon: '🏃🚴🏃' },
  Aquathlon: { fr: 'Aquathlon', category: 'triathlon', icon: '🏊🏃' },
  Aquabike: { fr: 'Aquabike', category: 'triathlon', icon: '🏊🚴' },
  // Cyclisme
  Ride: { fr: 'Cyclisme', category: 'cyclisme', icon: '🚴' },
  VirtualRide: { fr: 'Cyclisme virtuel', category: 'cyclisme', icon: '🚴' },
  MountainBikeRide: { fr: 'VTT', category: 'cyclisme', icon: '🚵' },
  GravelRide: { fr: 'Gravel', category: 'cyclisme', icon: '🚴' },
  EBikeRide: { fr: 'Vélo électrique', category: 'cyclisme', icon: '🚴' },
  EMountainBikeRide: { fr: 'VTT électrique', category: 'cyclisme', icon: '🚵' },
  Velomobile: { fr: 'Vélomobile', category: 'cyclisme', icon: '🚲' },
  Handcycle: { fr: 'Handbike', category: 'cyclisme', icon: '🚴' },

  // Course à pied
  Run: { fr: 'Course à pied', category: 'course', icon: '🏃' },
  TrailRun: { fr: 'Trail', category: 'course', icon: '🏃' },
  VirtualRun: { fr: 'Course virtuelle', category: 'course', icon: '🏃' },

  // Natation
  Swim: { fr: 'Natation', category: 'natation', icon: '🏊' },
  OpenWaterSwim: { fr: 'Natation en eau libre', category: 'natation', icon: '🏊' },

  // Force / Salle
  WeightTraining: { fr: 'Musculation', category: 'musculation', icon: '🏋️' },
  Workout: { fr: 'Entraînement', category: 'musculation', icon: '💪' },
  Crossfit: { fr: 'CrossFit', category: 'musculation', icon: '🏋️' },
  Elliptical: { fr: 'Vélo elliptique', category: 'musculation', icon: '🏃' },
  StairStepper: { fr: 'Stair-Stepper', category: 'musculation', icon: '🏃' },
  VirtualWorkout: { fr: 'Entraînement virtuel', category: 'musculation', icon: '💪' },

  // Marche / Rando
  Walk: { fr: 'Marche', category: 'autre', icon: '🚶' },
  Hike: { fr: 'Randonnée', category: 'autre', icon: '🥾' },
  Snowshoe: { fr: 'Raquettes', category: 'autre', icon: '🥾' },

  // Neige
  AlpineSki: { fr: 'Ski alpin', category: 'autre', icon: '⛷️' },
  BackcountrySki: { fr: 'Ski hors-piste', category: 'autre', icon: '⛷️' },
  NordicSki: { fr: 'Ski de fond', category: 'autre', icon: '⛷️' },
  Snowboard: { fr: 'Snowboard', category: 'autre', icon: '🏂' },
  IceSkate: { fr: 'Patinage', category: 'autre', icon: '⛸️' },
  InlineSkate: { fr: 'Roller', category: 'autre', icon: '🛼' },

  // Eau
  Rowing: { fr: 'Aviron', category: 'autre', icon: '🚣' },
  Kayaking: { fr: 'Kayak', category: 'autre', icon: '🛶' },
  Canoeing: { fr: 'Canoë', category: 'autre', icon: '🛶' },
  StandUpPaddling: { fr: 'Stand up paddle', category: 'autre', icon: '🏄' },
  Surfing: { fr: 'Surf', category: 'autre', icon: '🏄' },
  Windsurf: { fr: 'Planche à voile', category: 'autre', icon: '🏄' },
  Kitesurf: { fr: 'Kitesurf', category: 'autre', icon: '🪁' },
  Sailing: { fr: 'Voile', category: 'autre', icon: '⛵' },

  // Sports collectifs / raquettes
  Soccer: { fr: 'Football', category: 'autre', icon: '⚽' },
  Basketball: { fr: 'Basketball', category: 'autre', icon: '🏀' },
  Volleyball: { fr: 'Volleyball', category: 'autre', icon: '🏐' },
  Hockey: { fr: 'Hockey', category: 'autre', icon: '🏒' },
  Tennis: { fr: 'Tennis', category: 'autre', icon: '🎾' },
  Squash: { fr: 'Squash', category: 'autre', icon: '🎾' },
  Badminton: { fr: 'Badminton', category: 'autre', icon: '🏸' },
  TableTennis: { fr: 'Tennis de table', category: 'autre', icon: '🏓' },
  Cricket: { fr: 'Cricket', category: 'autre', icon: '🏏' },
  AmericanFootball: { fr: 'Football américain', category: 'autre', icon: '🏈' },

  // Mobilité / Bien-être
  Yoga: { fr: 'Yoga', category: 'autre', icon: '🧘' },
  Pilates: { fr: 'Pilates', category: 'autre', icon: '🧘' },
  Stretching: { fr: 'Étirements', category: 'autre', icon: '🧘' },

  // Divers
  RockClimbing: { fr: 'Escalade', category: 'autre', icon: '🧗' },
  Boxing: { fr: 'Boxe', category: 'autre', icon: '🥊' },
  Dance: { fr: 'Danse', category: 'autre', icon: '💃' },
  Golf: { fr: 'Golf', category: 'autre', icon: '⛳' },
  Skateboard: { fr: 'Skate', category: 'autre', icon: '🛹' },
  Wheelchair: { fr: 'Fauteuil roulant', category: 'autre', icon: '🦽' },
  Transition: { fr: 'Transition', category: 'autre', icon: '🏊' },
};
}
