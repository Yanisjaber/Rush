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
  semaine: {
    nom: 'Cette semaine',
    description: 'Les sept jours de la semaine, séance par séance.',
    categorie: 'Séances',
    sports: 'tous',
    tailles: ['l', 'xl'],
    taille: 'l',
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

/** Ordre de composition automatique de l'accueil. */
const ORDRE_AUTO = ['objectif', 'charge', 'forme', 'volume', 'semaine', 'regularite', 'dernieres'];

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
    widgets: ORDRE_AUTO.filter((id) => estPertinent(id, familles)).map((id) => ({ id, taille: WIDGETS[id].taille })),
  };
}

/**
 * Nettoie une disposition venue du stockage (base de données ou navigateur) : on ne fait jamais confiance
 * à son contenu. Les identifiants inconnus sont retirés, les doublons aussi, les tailles invalides
 * redeviennent celles par défaut. Renvoie null si la disposition est inutilisable.
 */
export function normaliser(brut) {
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.widgets)) return null;
  const vus = new Set();
  const widgets = [];
  for (const w of brut.widgets.slice(0, 40)) {
    if (!w || !existe(w.id) || vus.has(w.id)) continue;
    vus.add(w.id);
    const def = WIDGETS[w.id];
    widgets.push({ id: w.id, taille: def.tailles.includes(w.taille) ? w.taille : def.taille });
  }
  return { v: 1, auto: brut.auto === true, widgets };
}

/** Widgets absents de la disposition (ceux qu'on peut encore ajouter), pertinents d'abord. */
export function disponibles(disposition, familles = []) {
  const presents = new Set(disposition.widgets.map((w) => w.id));
  return Object.keys(WIDGETS)
    .filter((id) => !presents.has(id))
    .sort((a, b) => Number(estPertinent(b, familles)) - Number(estPertinent(a, familles)));
}
