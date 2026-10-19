// Registre des widgets : la liste de tout ce qu'on peut mettre sur l'accueil. Port de app/src/lib/widgets/registre.js.
// Un widget = une entrée ici (nom, description, sports concernés, tailles) + un composant (voir widgets/composants.tsx).
//
// `sports` : 'tous' (utile quel que soit le sport) ou une liste de sports (clés de theme/sports.ts) pour lesquels il est
// proposé en priorité et composé automatiquement.
// `tailles` : tailles possibles, de la plus petite à la plus grande ; `taille` est celle par défaut.
import type { Taille } from './types.ts';

export const TAILLES: Record<Taille, { nom: string; court: string }> = {
  s: { nom: 'Petit', court: 'S' },
  m: { nom: 'Moyen', court: 'M' },
  l: { nom: 'Large', court: 'L' },
  xl: { nom: 'Pleine largeur', court: 'XL' },
};

export interface DefinitionWidget {
  nom: string;
  description: string;
  categorie: string;
  sports: 'tous' | readonly string[];
  tailles: readonly Taille[];
  taille: Taille;
}

export const WIDGETS = {
  objectif: {
    nom: "Dossard d'objectif",
    description: "Le compte à rebours de ta prochaine compétition.",
    categorie: "Objectifs",
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  charge: {
    nom: "Charge d'entraînement",
    description: "Ta charge par semaine et par sport, avec la courbe de condition.",
    categorie: "Charge et forme",
    sports: 'tous',
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  forme: {
    nom: "Forme",
    description: "Forme, condition et fatigue du moment.",
    categorie: "Charge et forme",
    sports: 'tous',
    tailles: ['s', 'm'],
    taille: 'm',
  },
  volume: {
    nom: "Volume, 7 derniers jours",
    description: "Le temps passé sur chaque sport cette semaine.",
    categorie: "Volume",
    sports: 'tous',
    tailles: ['s', 'm'],
    taille: 'm',
  },
  predictions: {
    nom: "Prédictions de temps",
    description: "5 km, 10 km et semi, estimés d’après tes sorties récentes, avec l’écart à ton objectif.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['s', 'm'],
    taille: 'm',
  },
  efficacite: {
    nom: "Allure à cardio égal",
    description: "Ton allure en endurance semaine après semaine : elle baisse quand ta condition monte.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  meilleures: {
    nom: "Meilleures sorties",
    description: "Ta sortie la plus longue et tes sorties les plus rapides sur 5 et 10 km.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  puissance: {
    nom: "Courbe de puissance",
    description: "Tes meilleures puissances de 5 secondes à 1 heure, sur 90 jours et sur toute la vie.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  seancedujour: {
    nom: "Séance du jour",
    description: "Le dossard de ta prochaine séance de force, avec un bouton pour la démarrer.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  programmes: {
    nom: "Programmes",
    description: "Tes programmes de musculation (PUSH, PULL, LEGS…) : les ouvrir, en créer un. Se place à côté de la séance du jour.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['s'],
    taille: 's',
  },
  tonnage: {
    nom: "Tonnage par semaine",
    description: "Le poids total soulevé chaque semaine (répétitions × charge), sur 12 semaines.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  chargemuscu: {
    nom: "Charge musculation",
    description: "Ta charge de muscu sur 7 jours (répétitions × intensité par rapport à ton 1RM), comparée à ton habitude.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  records: {
    nom: "Tes records",
    description: "Tes exercices les plus pratiqués : 1RM estimé, record battu et courbe de progression.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['m', 'l', 'xl'],
    taille: 'xl',
  },
  groupes: {
    nom: "Séries par groupe",
    description: "Combien de séries tu as faites cette semaine sur chaque groupe musculaire.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxdossard: {
    nom: "Dossard Hyrox",
    description: "Compte à rebours de ta compétition Hyrox, avec ton dernier test et ton objectif de temps.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxtest: {
    nom: "Dernier test, course par course",
    description: "Tes 16 segments (8 runs et 8 stations) avec le temps passé sur chacun.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  hyroxallure: {
    nom: "Allure des 8 runs",
    description: "Le temps de chacun de tes 8 kilomètres, comparé à ton objectif.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxgains: {
    nom: "Où gagner du temps",
    description: "L'écart par station entre ton dernier test et ton objectif.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  chargeforce: {
    nom: "Charge de force",
    description: "Combien de séances de force par semaine soutiennent ton Hyrox.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['s', 'm'],
    taille: 's',
  },
  semaine: {
    nom: "Cette semaine",
    description: "Les sept jours de la semaine, séance par séance.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  avenir: {
    nom: "À venir",
    description: "Tes prochaines séances prévues, de la plus proche à la plus lointaine.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  regularite: {
    nom: "Régularité",
    description: "Une case par jour sur 12 semaines, à la couleur du sport.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  dernieres: {
    nom: "Dernières séances",
    description: "Tes cinq dernières séances avec leur charge.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
} as const satisfies Record<string, DefinitionWidget>;

export type IdWidget = keyof typeof WIDGETS;

/** Un widget placé sur l'accueil : son identifiant et sa taille. */
export interface WidgetPlace {
  id: string;
  taille: Taille;
}

/**
 * Onglets « riches » : muscu et Hyrox ont leur propre accueil, composé dans cet ordre.
 * Ces widgets n'apparaissent donc pas sur l'onglet « Tout », qui reste le tableau de bord général.
 */
export const ORDRE_ONGLET: Record<string, readonly string[]> = {
  muscu: ['seancedujour', 'programmes', 'tonnage', 'dernieres', 'records', 'groupes', 'regularite', 'chargemuscu'],
  hyrox: ['hyroxdossard', 'hyroxtest', 'hyroxallure', 'hyroxgains', 'semaine', 'chargeforce'],
};

// Widgets propres à un onglet riche (ceux qui ne sont pas des widgets « tous sports » réutilisés) : jamais composés d'office sur l'accueil général
const PROPRES_AUX_ONGLETS = new Set(
  Object.values(ORDRE_ONGLET)
    .flat()
    .filter((id) => Object.hasOwn(WIDGETS, id) && (WIDGETS as Record<string, DefinitionWidget>)[id].sports !== 'tous'),
);

/** Ordre de composition automatique de l'accueil. */
const ORDRE_AUTO = [
  'seancedujour',
  'programmes',
  'hyroxdossard',
  'objectif',
  'charge',
  'forme',
  'predictions',
  'puissance',
  'efficacite',
  'volume',
  'semaine',
  'avenir',
  'tonnage',
  'chargemuscu',
  'records',
  'groupes',
  'hyroxtest',
  'hyroxallure',
  'hyroxgains',
  'chargeforce',
  'meilleures',
  'regularite',
  'dernieres',
];

const definition = (id: string): DefinitionWidget => (WIDGETS as Record<string, DefinitionWidget>)[id];

/**
 * Un identifiant désigne-t-il un vrai widget ? Vérification stricte : `WIDGETS['constructor']`
 * ou `WIDGETS['__proto__']` renvoient des valeurs « vraies » en JavaScript, il faut donc
 * regarder les propriétés propres de l'objet et non pas seulement tester le résultat.
 */
export function existe(id: unknown): id is IdWidget {
  return typeof id === 'string' && Object.hasOwn(WIDGETS, id);
}

/** Un widget est-il pertinent pour au moins un des sports de l'utilisateur ? */
export function estPertinent(id: string, familles: readonly string[]): boolean {
  if (!existe(id)) return false;
  const def = definition(id);
  if (def.sports === 'tous') return true;
  return def.sports.some((s) => familles.includes(s));
}

/** Composition automatique de l'accueil à partir des sports pratiqués. */
export function compositionAuto(familles: readonly string[] = []): WidgetPlace[] {
  return ORDRE_AUTO.filter((id) => !PROPRES_AUX_ONGLETS.has(id) && estPertinent(id, familles)).map((id) => ({ id, taille: definition(id).taille }));
}

function tailleValide(id: string, souhaitee: Taille | undefined): Taille {
  const def = definition(id);
  return souhaitee && def.tailles.includes(souhaitee) ? souhaitee : def.taille;
}

/**
 * Widgets d'un onglet de sport. Muscu et Hyrox : composition fixe (ORDRE_ONGLET), en gardant la taille choisie par l'utilisateur.
 * Autres sports : les widgets de la disposition qui concernent ce sport, ceux du sport d'abord.
 */
export function composerOnglet(widgets: WidgetPlace[], sport: string): WidgetPlace[] {
  if (Object.hasOwn(ORDRE_ONGLET, sport)) {
    const tailles = new Map(widgets.map((w) => [w.id, w.taille]));
    return ORDRE_ONGLET[sport].map((id) => ({ id, taille: tailleValide(id, tailles.get(id)) }));
  }
  const pertinents = widgets.filter((w) => estPertinent(w.id, [sport]));
  const universels = pertinents.filter((w) => definition(w.id).sports === 'tous');
  // Le dossard d'objectif reste toujours en premier ; viennent ensuite les widgets du sport, puis les autres.
  return [
    ...universels.filter((w) => w.id === 'objectif'),
    ...pertinents.filter((w) => definition(w.id).sports !== 'tous'),
    ...universels.filter((w) => w.id !== 'objectif'),
  ];
}
