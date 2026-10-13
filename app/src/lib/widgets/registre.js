// Registre des widgets : la liste de tout ce qu'on peut mettre sur l'accueil.
// Un widget = une entrée ici (nom, description, sports concernés, tailles) + un composant Svelte
// (voir composants.js). Pour ajouter un widget : l'ajouter ici, écrire son composant, c'est tout.
//
// `sports` : 'tous' (utile quel que soit le sport) ou une liste de sports (clés de lib/sports.js)
// pour lesquels il est proposé en priorité et composé automatiquement.
// `tailles` : tailles possibles, de la plus petite à la plus grande ; `taille` est celle par défaut.

export const TAILLES = {
  s: { nom: 'Petit', court: 'S' },
  m: { nom: 'Moyen', court: 'M' },
  l: { nom: 'Large', court: 'L' },
  xl: { nom: 'Pleine largeur', court: 'XL' },
};

export const WIDGETS = {
  objectif: {
    nom: "Dossard d'objectif",
    description: 'Le compte à rebours de ta prochaine compétition.',
    categorie: 'Objectifs',
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  charge: {
    nom: "Charge d'entraînement",
    description: 'Ta charge par semaine et par sport, avec la courbe de condition.',
    categorie: 'Charge et forme',
    sports: 'tous',
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  forme: {
    nom: 'Forme',
    description: 'Forme, condition et fatigue du moment.',
    categorie: 'Charge et forme',
    sports: 'tous',
    tailles: ['s', 'm'],
    taille: 'm',
  },
  volume: {
    nom: 'Volume, 7 derniers jours',
    description: "Le temps passé sur chaque sport cette semaine.",
    categorie: 'Volume',
    sports: 'tous',
    tailles: ['s', 'm'],
    taille: 'm',
  },
  predictions: {
    nom: 'Prédictions de temps',
    description: '5 km, 10 km et semi, estimés d’après tes sorties récentes, avec l’écart à ton objectif.',
    categorie: 'Course à pied',
    sports: ['course'],
    tailles: ['s', 'm'],
    taille: 'm',
  },
  efficacite: {
    nom: 'Allure à cardio égal',
    description: 'Ton allure en endurance semaine après semaine : elle baisse quand ta condition monte.',
    categorie: 'Course à pied',
    sports: ['course'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  meilleures: {
    nom: 'Meilleures sorties',
    description: 'Ta sortie la plus longue et tes sorties les plus rapides sur 5 et 10 km.',
    categorie: 'Course à pied',
    sports: ['course'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  puissance: {
    nom: 'Courbe de puissance',
    description: 'Tes meilleures puissances de 5 secondes à 1 heure, sur 90 jours et sur toute la vie.',
    categorie: 'Vélo',
    sports: ['velo'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  force: {
    nom: 'Séances de force',
    description: 'Combien de séances par semaine, et depuis combien de semaines tu tiens le rythme.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  seancedujour: {
    nom: 'Séance du jour',
    description: 'Le dossard de ta prochaine séance de force, avec un bouton pour la démarrer.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  tonnage: {
    nom: 'Tonnage par semaine',
    description: 'Le poids total soulevé chaque semaine (répétitions × charge), sur 12 semaines.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  records: {
    nom: 'Tes records',
    description: 'Tes exercices les plus pratiqués : 1RM estimé, record battu et courbe de progression.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l', 'xl'],
    taille: 'xl',
  },
  programme: {
    nom: 'Au programme',
    description: 'Les exercices de ta prochaine séance : séries, répétitions et charges.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  groupes: {
    nom: 'Séries par groupe',
    description: 'Combien de séries tu as faites cette semaine sur chaque groupe musculaire.',
    categorie: 'Musculation',
    sports: ['muscu'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxdossard: {
    nom: 'Dossard Hyrox',
    description: 'Compte à rebours de ta compétition Hyrox, avec ton dernier test et ton objectif de temps.',
    categorie: 'Hyrox',
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxtest: {
    nom: 'Dernier test, course par course',
    description: 'Tes 16 segments (8 runs et 8 stations) avec le temps passé sur chacun.',
    categorie: 'Hyrox',
    sports: ['hyrox'],
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  hyroxallure: {
    nom: 'Allure des 8 runs',
    description: "Le temps de chacun de tes 8 kilomètres, comparé à ton objectif.",
    categorie: 'Hyrox',
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  hyroxgains: {
    nom: 'Où gagner du temps',
    description: "L'écart par station entre ton dernier test et ton objectif.",
    categorie: 'Hyrox',
    sports: ['hyrox'],
    tailles: ['m', 'l'],
    taille: 'm',
  },
  chargeforce: {
    nom: 'Charge de force',
    description: 'Combien de séances de force par semaine soutiennent ton Hyrox.',
    categorie: 'Hyrox',
    sports: ['hyrox'],
    tailles: ['s', 'm'],
    taille: 's',
  },
  semaine: {
    nom: 'Cette semaine',
    description: 'Les sept jours de la semaine, séance par séance.',
    categorie: 'Séances',
    sports: 'tous',
    tailles: ['l', 'xl'],
    taille: 'l',
  },
  avenir: {
    nom: 'À venir',
    description: 'Tes prochaines séances prévues, de la plus proche à la plus lointaine.',
    categorie: 'Séances',
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  regularite: {
    nom: 'Régularité',
    description: 'Une case par jour sur 12 semaines, à la couleur du sport.',
    categorie: 'Séances',
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
  dernieres: {
    nom: 'Dernières séances',
    description: 'Tes cinq dernières séances avec leur charge.',
    categorie: 'Séances',
    sports: 'tous',
    tailles: ['m', 'l'],
    taille: 'm',
  },
};

/**
 * Onglets « riches » : muscu et Hyrox ont leur propre accueil, composé dans cet ordre (comme sur les maquettes).
 * Ces widgets n'apparaissent donc pas sur l'onglet « Tout », qui reste le tableau de bord général.
 */
export const ORDRE_ONGLET = {
  muscu: ['seancedujour', 'tonnage', 'regularite', 'records', 'programme', 'groupes', 'dernieres'],
  hyrox: ['hyroxdossard', 'hyroxtest', 'hyroxallure', 'hyroxgains', 'semaine', 'chargeforce'],
};

// Widgets propres à un onglet riche (ceux qui ne sont pas des widgets « tous sports » réutilisés)
const PROPRES_AUX_ONGLETS = new Set(
  Object.values(ORDRE_ONGLET).flat().filter((id) => Object.hasOwn(WIDGETS, id) && WIDGETS[id].sports !== 'tous'),
);

/** Ordre de composition automatique de l'accueil. */
const ORDRE_AUTO = [
  'seancedujour',
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
  'records',
  'programme',
  'groupes',
  'hyroxtest',
  'hyroxallure',
  'hyroxgains',
  'chargeforce',
  'force',
  'meilleures',
  'regularite',
  'dernieres',
];

/**
 * Un identifiant désigne-t-il un vrai widget ? Vérification stricte : `WIDGETS['constructor']`
 * ou `WIDGETS['__proto__']` renvoient des valeurs « vraies » en JavaScript, il faut donc
 * regarder les propriétés propres de l'objet et non pas seulement tester le résultat.
 */
export function existe(id) {
  return typeof id === 'string' && Object.hasOwn(WIDGETS, id);
}

/** Un widget est-il pertinent pour au moins un des sports de l'utilisateur ? */
export function estPertinent(id, familles) {
  if (!existe(id)) return false;
  const def = WIDGETS[id];
  if (def.sports === 'tous') return true;
  return def.sports.some((s) => familles.includes(s));
}

/** Composition automatique de l'accueil à partir des sports pratiqués. */
export function compositionAuto(familles = []) {
  return {
    v: 1,
    auto: true,
    widgets: ORDRE_AUTO.filter((id) => !PROPRES_AUX_ONGLETS.has(id) && estPertinent(id, familles)).map((id) => ({ id, taille: WIDGETS[id].taille })),
  };
}

/**
 * Widgets d'un onglet de sport. Muscu et Hyrox : composition fixe (ORDRE_ONGLET), en gardant la taille choisie par l'utilisateur.
 * Autres sports : les widgets de la disposition qui concernent ce sport, ceux du sport d'abord.
 */
export function composerOnglet(widgets, sport, onglets = null) {
  if (Object.hasOwn(ORDRE_ONGLET, sport)) {
    // Composition personnalisée de cet onglet (mode édition), sinon la composition par défaut
    const perso = onglets && Array.isArray(onglets[sport]) ? onglets[sport] : null;
    if (perso) return perso.map((w) => ({ ...w }));
    const tailles = new Map(widgets.map((w) => [w.id, w.taille]));
    return ORDRE_ONGLET[sport].map((id) => ({ id, taille: tailleValide(id, tailles.get(id)) }));
  }
  const pertinents = widgets.filter((w) => estPertinent(w.id, [sport]));
  return [...pertinents.filter((w) => WIDGETS[w.id].sports !== 'tous'), ...pertinents.filter((w) => WIDGETS[w.id].sports === 'tous')];
}

function tailleValide(id, souhaitee) {
  return WIDGETS[id].tailles.includes(souhaitee) ? souhaitee : WIDGETS[id].taille;
}

/**
 * Nettoie une disposition venue du stockage (base de données ou navigateur) : on ne fait jamais confiance
 * à son contenu. Les identifiants inconnus sont retirés, les doublons aussi, les tailles invalides
 * redeviennent celles par défaut. Renvoie null si la disposition est inutilisable.
 */
export function normaliser(brut) {
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.widgets)) return null;
  const resultat = { v: 1, auto: brut.auto === true, widgets: normaliserListe(brut.widgets) };
  // Compositions propres aux onglets Muscu et Hyrox (facultatif) : seuls les onglets connus sont gardés
  if (brut.onglets && typeof brut.onglets === 'object') {
    const onglets = {};
    for (const sport of Object.keys(ORDRE_ONGLET)) {
      if (Array.isArray(brut.onglets[sport])) onglets[sport] = normaliserListe(brut.onglets[sport]);
    }
    if (Object.keys(onglets).length) resultat.onglets = onglets;
  }
  return resultat;
}

/** Nettoie une liste de widgets : identifiants inconnus et doublons retirés, tailles invalides remises par défaut. */
export function normaliserListe(brut) {
  const vus = new Set();
  const widgets = [];
  for (const w of (Array.isArray(brut) ? brut : []).slice(0, 40)) {
    if (!w || !existe(w.id) || vus.has(w.id)) continue;
    vus.add(w.id);
    const def = WIDGETS[w.id];
    widgets.push({ id: w.id, taille: def.tailles.includes(w.taille) ? w.taille : def.taille });
  }
  return widgets;
}

/** Les onglets de sport qui ont leur propre composition modifiable (Muscu, Hyrox). */
export const ONGLETS_PERSONNALISABLES = Object.keys(ORDRE_ONGLET);

/**
 * Widgets qu'on peut encore ajouter à la liste d'un onglet : ceux qui concernent ce sport (ou tous les sports)
 * et ne sont pas déjà dans la liste.
 */
export function disponiblesOnglet(liste, sport) {
  const presents = new Set(liste.map((w) => w.id));
  return Object.keys(WIDGETS).filter((id) => !presents.has(id) && estPertinent(id, [sport]));
}

/** Widgets absents de la disposition (ceux qu'on peut encore ajouter), pertinents d'abord. */
export function disponibles(disposition, familles = []) {
  const presents = new Set(disposition.widgets.map((w) => w.id));
  return Object.keys(WIDGETS)
    .filter((id) => !presents.has(id))
    .sort((a, b) => Number(estPertinent(b, familles)) - Number(estPertinent(a, familles)));
}
