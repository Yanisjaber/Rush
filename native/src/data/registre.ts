// Registre des widgets : la liste de tout ce qu'on peut mettre sur l'accueil. Port de app/src/lib/widgets/registre.js.
// Un widget = une entrée ici (nom, description, sports concernés, tailles) + un composant (voir widgets/composants.tsx).
//
// `sports` : 'tous' (utile quel que soit le sport) ou une liste de sports (clés de theme/sports.ts) pour lesquels il est
// proposé en priorité et composé automatiquement.
// `tailles` : tailles possibles, de la plus petite à la plus grande ; `taille` est celle par défaut.
import { familleDesWidgets } from './familles.ts';
import type { Taille } from './types.ts';

export const TAILLES: Record<Taille, { nom: string; court: string; description: string }> = {
  xs: { nom: 'Très petit', court: 'XS', description: 'Une ligne fine' },
  s: { nom: 'Petit', court: 'S', description: 'Une demi-ligne' },
  m: { nom: 'Moyen', court: 'M', description: 'Une ligne entière' },
  l: { nom: 'Large', court: 'L', description: 'Deux lignes de haut' },
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
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  charge: {
    nom: "Charge d'entraînement",
    description: "Ta charge par semaine et par sport, avec la courbe de condition.",
    categorie: "Charge et forme",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'l',
  },
  forme: {
    nom: "Forme",
    description: "Forme, condition et fatigue du moment.",
    categorie: "Charge et forme",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  volume: {
    nom: "Volume, 7 derniers jours",
    description: "Le temps passé sur chaque sport cette semaine.",
    categorie: "Volume",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  predictions: {
    nom: "Prédictions de temps",
    description: "5 km, 10 km et semi, estimés d’après tes sorties récentes, avec l’écart à ton objectif.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  efficacite: {
    nom: "Allure à cardio égal",
    description: "Ton allure en endurance semaine après semaine : elle baisse quand ta condition monte.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  kmhebdo: {
    nom: "Kilomètres par semaine",
    description: "Les kilomètres que tu cours chaque semaine, avec ta moyenne.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  zonesallure: {
    nom: "Zones d'allure",
    description: "Où passe ton temps de course sur 4 semaines, zone par zone (d'après ta vitesse seuil).",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  meilleures: {
    nom: "Meilleures sorties",
    description: "Ta sortie la plus longue et tes sorties les plus rapides sur 5 et 10 km.",
    categorie: "Course à pied",
    sports: ['course'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  puissance: {
    nom: "Courbe de puissance",
    description: "Tes meilleures puissances de 5 secondes à 1 heure, sur 90 jours et sur toute la vie.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  kmvelo: {
    nom: "Kilomètres à vélo par semaine",
    description: "Les kilomètres que tu roules chaque semaine, avec ta moyenne.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  denivele: {
    nom: "Dénivelé par semaine",
    description: "Le dénivelé positif que tu grimpes à vélo chaque semaine.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  ftp: {
    nom: "FTP",
    description: "L’évolution de ta FTP au fil des semaines, d’après tes sorties.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  zonespuissance: {
    nom: "Zones de puissance",
    description: "Où passe ton temps à vélo sur 4 semaines, zone par zone (d’après ta FTP).",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  wattscardio: {
    nom: "Watts à cardio égal",
    description: "Tes watts en sortie facile, semaine après semaine, et l’équivalence entre ton cardio et tes watts.",
    categorie: "Vélo",
    sports: ['velo'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  deniveletrail: {
    nom: "Dénivelé par semaine (trail)",
    description: "Le dénivelé positif que tu grimpes chaque semaine en trail, avec ta moyenne.",
    categorie: "Trail",
    sports: ['trail'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  kmeffort: {
    nom: "Km-effort par semaine",
    description: "Le volume réel de ton trail : 1 km-effort = 1 km + 100 m de dénivelé.",
    categorie: "Trail",
    sports: ['trail'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  prepatrail: {
    nom: "Prépa dénivelé",
    description: "Ton plus gros D+ en une sortie face au dénivelé de ta prochaine course.",
    categorie: "Trail",
    sports: ['trail'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  meilleurestrail: {
    nom: "Meilleures sorties de trail",
    description: "Ton plus gros dénivelé, ta plus longue sortie et ta plus longue durée en trail.",
    categorie: "Trail",
    sports: ['trail'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  triequilibre: {
    nom: "Répartition par discipline",
    description: "Où passe ton temps entre natation, vélo et course, semaine après semaine.",
    categorie: "Triathlon et duathlon",
    sports: ['triathlon', 'duathlon'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  trifraicheur: {
    nom: "Dernière séance par discipline",
    description: "Depuis combien de jours tu n’as pas fait chaque discipline.",
    categorie: "Triathlon et duathlon",
    sports: ['triathlon', 'duathlon'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  tribricks: {
    nom: "Enchaînements",
    description: "Tes enchaînements vélo puis course dans la foulée, avec leur nombre sur 4 semaines.",
    categorie: "Triathlon et duathlon",
    sports: ['triathlon', 'duathlon'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  trireperes: {
    nom: "Repères par discipline",
    description: "Ton niveau du moment : allure en natation, watts à vélo, allure en course.",
    categorie: "Triathlon et duathlon",
    sports: ['triathlon', 'duathlon'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  natvolume: {
    nom: "Natation par semaine",
    description: "Les mètres nagés chaque semaine, sur 8 semaines.",
    categorie: "Natation",
    sports: ['natation'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  natallure: {
    nom: "Allure au 100 m",
    description: "Ton allure de nage sur les 4 dernières semaines, comparée aux 4 d'avant.",
    categorie: "Natation",
    sports: ['natation'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  natlongue: {
    nom: "Meilleures natations",
    description: "Ta séance de natation la plus longue et la plus rapide.",
    categorie: "Natation",
    sports: ['natation'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  aujourdhui: {
    nom: "Séance du jour",
    description: "Ce que tu as prévu aujourd'hui et pas encore fait, quel que soit le sport.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  seancedujour: {
    nom: "Séance de force du jour",
    description: "Le dossard de ta prochaine séance de force, avec un bouton pour la démarrer.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  programmes: {
    nom: "Programmes",
    description: "Tes programmes de musculation (PUSH, PULL, LEGS…) : les ouvrir, en créer un. Se place à côté de la séance du jour.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  tonnage: {
    nom: "Tonnage par semaine",
    description: "Le poids total soulevé chaque semaine (répétitions × charge), sur 12 semaines.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  chargemuscu: {
    nom: "Charge musculation",
    description: "Ta charge de muscu sur 7 jours (répétitions × intensité par rapport à ton 1RM), comparée à ton habitude.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  records: {
    nom: "Tes records",
    description: "Tes exercices les plus pratiqués : 1RM estimé, record battu et courbe de progression.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'l',
  },
  groupes: {
    nom: "Séries par groupe",
    description: "Combien de séries tu as faites cette semaine sur chaque groupe musculaire.",
    categorie: "Musculation",
    sports: ['muscu'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  hyroxdossard: {
    nom: "Dossard Hyrox",
    description: "Compte à rebours de ta compétition Hyrox, avec ton dernier test et ton objectif de temps.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  hyroxtest: {
    nom: "Dernier test, course par course",
    description: "Tes 16 segments (8 runs et 8 stations) avec le temps passé sur chacun.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'l',
  },
  hyroxallure: {
    nom: "Allure des 8 runs",
    description: "Le temps de chacun de tes 8 kilomètres, comparé à ton objectif.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  hyroxgains: {
    nom: "Où gagner du temps",
    description: "L'écart par station entre ton dernier test et ton objectif.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  hyroxhebdo: {
    nom: "Hyrox par semaine",
    description: "Le temps que tu passes chaque semaine à t’entraîner pour l’Hyrox, avec ta moyenne.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  hyroxevolution: {
    nom: "Évolution du temps total",
    description: "Le temps total de tes tests et courses, du premier au dernier, avec ton record.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  hyroxrunsstations: {
    nom: "Runs et stations",
    description: "Où passe ton temps : à courir ou sur les stations, test après test.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  hyroxderive: {
    nom: "Dérive des runs",
    description: "De combien tu ralentis entre le début et la fin de ton Hyrox.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  chargeforce: {
    nom: "Charge de force",
    description: "Combien de séances de force par semaine soutiennent ton Hyrox.",
    categorie: "Hyrox",
    sports: ['hyrox'],
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  semaine: {
    nom: "Cette semaine",
    description: "Les sept jours de la semaine, séance par séance.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 'm',
  },
  avenir: {
    nom: "À venir",
    description: "Tes prochaines séances prévues, de la plus proche à la plus lointaine.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  regularite: {
    nom: "Régularité",
    description: "Une case par jour sur 12 semaines, à la couleur du sport.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
    taille: 's',
  },
  dernieres: {
    nom: "Dernières séances",
    description: "Tes cinq dernières séances avec leur charge.",
    categorie: "Séances",
    sports: 'tous',
    tailles: ['xs', 's', 'm', 'l'],
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
  muscu: ['seancedujour', 'programmes', 'tonnage', 'regularite', 'dernieres', 'records', 'groupes', 'chargemuscu'],
  // De haut en bas : l'objectif, le contexte de la semaine, la progression et l'effort, le dernier test, l'analyse, puis ce qui a été fait
  hyrox: ['hyroxdossard', 'semaine', 'hyroxevolution', 'hyroxhebdo', 'hyroxtest', 'hyroxrunsstations', 'hyroxderive', 'hyroxallure', 'hyroxgains', 'chargeforce', 'dernieres'],
};

/** La liste par défaut d'un onglet de sport libre (Course, Trail, Vélo, Natation, Triathlon, Duathlon) : un sport qui n'en a pas prend sa composition automatique (compositionSport). Course et Vélo : les dispositions de Yanis ; Trail, Triathlon et Duathlon : pensées pour l'usage. */
export const LISTES_PAR_DEFAUT: Record<string, readonly WidgetPlace[]> = {
  course: [
    { id: 'kmhebdo', taille: 'm' },
    { id: 'semaine', taille: 'xs' },
    { id: 'objectif', taille: 'xs' },
    { id: 'efficacite', taille: 's' },
    { id: 'zonesallure', taille: 's' },
    { id: 'predictions', taille: 'm' },
    { id: 'avenir', taille: 's' },
    { id: 'forme', taille: 's' },
    { id: 'charge', taille: 'l' },
    { id: 'dernieres', taille: 'm' },
  ],
  // Trail : la préparation au dénivelé de la course visée en héros, puis le contexte, le volume en dénivelé et en km-effort, la charge, les records
  trail: [
    { id: 'prepatrail', taille: 'm' },
    { id: 'semaine', taille: 'xs' },
    { id: 'objectif', taille: 'xs' },
    { id: 'deniveletrail', taille: 's' },
    { id: 'kmeffort', taille: 's' },
    { id: 'charge', taille: 'l' },
    { id: 'meilleurestrail', taille: 'm' },
    { id: 'avenir', taille: 's' },
    { id: 'forme', taille: 's' },
    { id: 'dernieres', taille: 'm' },
  ],
  // Triathlon et duathlon : la semaine (toutes disciplines) en héros, puis la prochaine course, ce qui est délaissé et les enchaînements, la répartition du temps, la charge, les repères
  triathlon: [
    { id: 'semaine', taille: 'm' },
    { id: 'objectif', taille: 'xs' },
    { id: 'trifraicheur', taille: 's' },
    { id: 'tribricks', taille: 's' },
    { id: 'triequilibre', taille: 'l' },
    { id: 'charge', taille: 'm' },
    { id: 'trireperes', taille: 'm' },
    { id: 'avenir', taille: 's' },
    { id: 'forme', taille: 's' },
    { id: 'dernieres', taille: 'm' },
  ],
  duathlon: [
    { id: 'semaine', taille: 'm' },
    { id: 'objectif', taille: 'xs' },
    { id: 'trifraicheur', taille: 's' },
    { id: 'tribricks', taille: 's' },
    { id: 'triequilibre', taille: 'l' },
    { id: 'charge', taille: 'm' },
    { id: 'trireperes', taille: 'm' },
    { id: 'avenir', taille: 's' },
    { id: 'forme', taille: 's' },
    { id: 'dernieres', taille: 'm' },
  ],
  velo: [
    { id: 'semaine', taille: 'm' },
    { id: 'forme', taille: 's' },
    { id: 'kmvelo', taille: 's' },
    { id: 'zonespuissance', taille: 'xs' },
    { id: 'wattscardio', taille: 's' },
    { id: 'ftp', taille: 's' },
    { id: 'charge', taille: 'l' },
    { id: 'puissance', taille: 'm' },
    { id: 'dernieres', taille: 'm' },
  ],
};

/** Tailles par défaut d'un onglet (quand l'utilisateur n'a rien personnalisé) : elles passent avant celles de l'onglet « Tous ». Muscu : la disposition de Yanis ; Hyrox : une disposition pensée pour l'usage. */
export const TAILLES_ONGLET: Record<string, Readonly<Record<string, Taille>>> = {
  muscu: { seancedujour: 'm', programmes: 'xs', tonnage: 's', regularite: 's', dernieres: 'xs', records: 'm', groupes: 's', chargemuscu: 's' },
  // Hyrox : le dossard en héros, une bande fine, deux paires de tuiles (progression et effort, puis runs et dérive), le test en grand
  hyrox: { hyroxdossard: 'm', semaine: 'xs', hyroxevolution: 's', hyroxhebdo: 's', hyroxtest: 'l', hyroxrunsstations: 's', hyroxderive: 's', hyroxallure: 'm', hyroxgains: 'm', chargeforce: 'xs', dernieres: 'm' },
};

/**
 * Les widgets « signature » de chaque sport : ceux qui disent le plus sur ce sport, du plus important au moins important.
 * Un coureur veut sa prédiction de temps et son allure, pas sa courbe de watts ; un cycliste l'inverse.
 * `taille` : la taille donnée sur l'accueil (par défaut, celle du registre).
 */
interface Signature {
  id: string;
  taille?: Taille;
}
export const SIGNATURES: Record<string, readonly Signature[]> = {
  course: [{ id: 'predictions' }, { id: 'efficacite' }, { id: 'meilleures' }],
  velo: [{ id: 'puissance' }],
  natation: [{ id: 'natvolume' }, { id: 'natallure' }, { id: 'natlongue' }],
  muscu: [{ id: 'seancedujour' }, { id: 'tonnage' }, { id: 'records', taille: 'm' }, { id: 'groupes' }],
  hyrox: [{ id: 'hyroxallure' }, { id: 'chargeforce' }, { id: 'hyroxgains' }],
};

// Triathlon et duathlon : un sport à part sur la barre, mais ce sont des courses, du vélo et de la natation sur l'accueil
const SPORTS_DE = (famille: string): string[] => (famille === 'triathlon' || famille === 'duathlon' ? ['course', 'velo', 'natation'] : [familleDesWidgets(famille)]);

const definition = (id: string): DefinitionWidget => (WIDGETS as Record<string, DefinitionWidget>)[id];

/**
 * Un identifiant désigne-t-il un vrai widget ? Vérification stricte : `WIDGETS['constructor']`
 * ou `WIDGETS['__proto__']` renvoient des valeurs « vraies » en JavaScript, il faut donc
 * regarder les propriétés propres de l'objet et non pas seulement tester le résultat.
 */
export function existe(id: unknown): id is IdWidget {
  return typeof id === 'string' && Object.hasOwn(WIDGETS, id);
}

/** Les onglets qui regroupent plusieurs sports : les widgets de tous ces sports leur conviennent. */
const SPORTS_VOISINS: Record<string, readonly string[]> = {
  trail: ['course', 'trail'],
  triathlon: ['triathlon', 'natation', 'velo', 'course'],
  duathlon: ['duathlon', 'velo', 'course'],
};

/** Un widget est-il pertinent pour au moins un des sports de l'utilisateur ? */
export function estPertinent(id: string, familles: readonly string[]): boolean {
  if (!existe(id)) return false;
  const def = definition(id);
  if (def.sports === 'tous') return true;
  // Un onglet Trail montre les widgets de course ET de trail, Triathlon et Duathlon ceux de leurs disciplines ; un onglet VTT ceux du vélo
  const dessous = familles.flatMap((f) => SPORTS_VOISINS[f] ?? [familleDesWidgets(f)]);
  return def.sports.some((s) => dessous.includes(s));
}

/**
 * L'écran de base de l'onglet « Tous » : le même pour tout le monde, quels que soient les sports choisis.
 * La semaine en héros, puis des bandes fines (séance du jour, forme, dernière séance) qui alternent avec des tuiles (objectif, charge).
 * Chacun peut ensuite le modifier (mode édition) : les widgets des autres sports restent ajoutables.
 */
const BASE_TOUS: readonly WidgetPlace[] = [
  { id: 'semaine', taille: 'm' },
  { id: 'aujourdhui', taille: 'xs' },
  { id: 'objectif', taille: 's' },
  { id: 'charge', taille: 's' },
  { id: 'forme', taille: 'xs' },
  { id: 'dernieres', taille: 'xs' },
  { id: 'regularite', taille: 'm' },
];

/** Composition automatique de l'onglet « Tous » : toujours l'écran de base (les sports ne la changent pas). */
export function compositionAuto(_familles: readonly string[] = []): WidgetPlace[] {
  return BASE_TOUS.map((w) => ({ ...w }));
}

/**
 * Composition d'un onglet de sport (Course, Vélo, Natation…) à partir de ce sport : un socle commun, puis la part de chaque sport.
 *  1. Le socle : la semaine en héros, la prochaine séance, l'objectif, la forme.
 *  2. La part de chaque sport (ses widgets « signature », voir SIGNATURES) : un seul sport a toute la place (4), deux sports 2 chacun,
 *     trois ou plus 1 chacun. Les widgets des sports qu'on ne pratique pas n'apparaissent pas (ils restent ajoutables à la main).
 *  3. Les tuiles se rangent deux par deux (si le compte est impair, un complément : la répartition par sport quand il y en a plusieurs).
 *  4. La charge d'entraînement (celle de la muscu quand on ne fait que de la muscu), puis les dernières séances.
 */
export function compositionSport(familles: readonly string[] = []): WidgetPlace[] {
  const sports = [...new Set(familles.flatMap(SPORTS_DE))].filter((s) => Object.hasOwn(SIGNATURES, s));
  const parts = sports.length <= 1 ? 4 : sports.length === 2 ? 2 : 1;
  const vus = new Set<string>();
  const signatures: Signature[] = [];
  for (const sport of sports) {
    for (const sig of SIGNATURES[sport].slice(0, parts)) {
      if (vus.has(sig.id)) continue;
      vus.add(sig.id);
      signatures.push(sig);
    }
  }
  const place = (id: string, taille?: Taille): WidgetPlace => ({ id, taille: taille ?? definition(id).taille });
  const tailleDe = (sig: Signature): Taille => sig.taille ?? definition(sig.id).taille;
  const grands = signatures.filter((sig) => tailleDe(sig) !== 's');
  const tuiles = signatures.filter((sig) => tailleDe(sig) === 's').map((sig) => place(sig.id, 's'));

  const socle = [...(vus.has('seancedujour') ? [] : [place('avenir', 's')]), place('objectif', 's'), place('forme', 's')];
  const rangees = [...socle, ...tuiles];
  // Compte impair : un complément, pour qu'aucune tuile ne reste seule sur sa ligne
  if (rangees.length % 2 === 1) {
    const complement = [...(sports.length >= 2 ? ['volume'] : []), 'regularite'].find((id) => !rangees.some((w) => w.id === id));
    if (complement) rangees.push(place(complement, 's'));
  }

  const muscuSeule = sports.length > 0 && sports.every((s) => s === 'muscu');
  return [
    place('semaine', 'm'),
    ...grands.map((sig) => place(sig.id, tailleDe(sig))),
    ...rangees,
    place(muscuSeule ? 'chargemuscu' : 'charge'),
    place('dernieres'),
  ];
}

function tailleValide(id: string, souhaitee: Taille | undefined): Taille {
  const def = definition(id);
  return souhaitee && def.tailles.includes(souhaitee) ? souhaitee : def.taille;
}

/**
 * Widgets d'un onglet de sport. Course, Vélo, Natation : leur liste enregistrée, sinon leur composition automatique. Muscu et Hyrox : composition fixe (ORDRE_ONGLET) ; tailles : celles de TAILLES_ONGLET, sinon celles de l'onglet « Tous ».
 * Autres sports : les widgets de la disposition qui concernent ce sport, ceux du sport d'abord.
 */
export function composerOnglet(widgets: WidgetPlace[], sport: string, onglets: Onglets | null = null): WidgetPlace[] {
  // Course, Vélo, Natation : leur propre liste (mode édition), sinon la composition automatique du sport. Ce qu'on voit en édition est donc ce qu'on voit après.
  if (SPORTS_LIBRES.includes(sport)) {
    const perso = onglets && Array.isArray(onglets[sport]) ? onglets[sport] : null;
    if (perso) return perso.map((w) => ({ ...w }));
    return LISTES_PAR_DEFAUT[sport] ? LISTES_PAR_DEFAUT[sport].map((w) => ({ ...w })) : compositionSport([sport]);
  }
  if (Object.hasOwn(ORDRE_ONGLET, sport)) {
    // Composition personnalisée de cet onglet (mode édition), sinon la composition par défaut
    const perso = onglets && Array.isArray(onglets[sport]) ? onglets[sport] : null;
    if (perso) return perso.map((w) => ({ ...w }));
    const tailles = new Map(widgets.map((w) => [w.id, w.taille]));
    return ORDRE_ONGLET[sport].map((id) => ({ id, taille: tailleValide(id, TAILLES_ONGLET[sport]?.[id] ?? tailles.get(id)) }));
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

/** Compositions propres aux onglets personnalisables (Muscu, Hyrox, Course, Vélo, Natation) : une liste par sport, ou rien (= composition par défaut). */
export type Onglets = Record<string, WidgetPlace[] | null | undefined>;

/** La disposition de l'accueil telle qu'elle est enregistrée (user_preferences.layout). `auto` : elle suit les sports. */
export interface Disposition {
  v: 1;
  auto: boolean;
  widgets: WidgetPlace[];
  onglets?: Record<string, WidgetPlace[]>;
}

/** Nettoie une liste de widgets : identifiants inconnus et doublons retirés, tailles invalides remises par défaut. */
export function normaliserListe(brut: unknown): WidgetPlace[] {
  const vus = new Set<string>();
  const widgets: WidgetPlace[] = [];
  for (const w of (Array.isArray(brut) ? brut : []).slice(0, 40)) {
    if (!w || !existe(w.id) || vus.has(w.id)) continue;
    vus.add(w.id);
    const def = definition(w.id);
    // L'ancienne taille « pleine largeur » (xl) est devenue L
    const souhaitee = (w.taille as string) === 'xl' ? 'l' : w.taille;
    widgets.push({ id: w.id, taille: def.tailles.includes(souhaitee) ? souhaitee : def.taille });
  }
  return widgets;
}

/**
 * Nettoie une disposition venue du stockage : on ne fait jamais confiance à son contenu.
 * Renvoie null si elle est inutilisable.
 */
export function normaliser(brut: unknown): Disposition | null {
  const b = brut as { auto?: unknown; widgets?: unknown; onglets?: Record<string, unknown> } | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b.widgets)) return null;
  const resultat: Disposition = { v: 1, auto: b.auto === true, widgets: normaliserListe(b.widgets) };
  // Compositions propres aux onglets personnalisables (facultatif) : seuls les onglets connus sont gardés
  if (b.onglets && typeof b.onglets === 'object') {
    const onglets: Record<string, WidgetPlace[]> = {};
    for (const sport of ONGLETS_PERSONNALISABLES) {
      if (Array.isArray(b.onglets[sport])) onglets[sport] = normaliserListe(b.onglets[sport]);
    }
    if (Object.keys(onglets).length) resultat.onglets = onglets;
  }
  return resultat;
}

/** Les onglets de sport dont la bibliothèque reste ouverte : on peut y ajouter n'importe quel widget qui concerne le sport. */
export const SPORTS_LIBRES: string[] = ['course', 'trail', 'velo', 'natation', 'triathlon', 'duathlon'];
/** Les onglets de sport qui ont leur propre composition modifiable (Muscu, Hyrox, et les sports libres). */
export const ONGLETS_PERSONNALISABLES: string[] = [...Object.keys(ORDRE_ONGLET), ...SPORTS_LIBRES];
/** Onglets dont la bibliothèque est limitée à leurs propres widgets (ceux de ORDRE_ONGLET). */
const ONGLETS_FERMES = new Set(['muscu']);

/** Widgets qu'on peut encore ajouter à la liste d'un onglet : ceux qui concernent ce sport (ou tous) et ne sont pas déjà dedans. */
export function disponiblesOnglet(liste: WidgetPlace[], sport: string): string[] {
  const presents = new Set(liste.map((w) => w.id));
  // L'onglet Muscu n'a que ses propres widgets : on peut les réordonner, les redimensionner, les retirer et les remettre, rien d'autre
  if (ONGLETS_FERMES.has(sport)) return ORDRE_ONGLET[sport].filter((id) => !presents.has(id));
  return Object.keys(WIDGETS).filter((id) => !presents.has(id) && estPertinent(id, [sport]));
}

/** Widgets absents de la disposition (ceux qu'on peut encore ajouter), pertinents d'abord. */
export function disponibles(disposition: { widgets: WidgetPlace[] }, familles: readonly string[] = []): string[] {
  const presents = new Set(disposition.widgets.map((w) => w.id));
  return Object.keys(WIDGETS)
    .filter((id) => !presents.has(id))
    .sort((a, b) => Number(estPertinent(b, familles)) - Number(estPertinent(a, familles)));
}
