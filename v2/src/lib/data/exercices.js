// Bibliothèque d'exercices de musculation fournie avec l'app. Chaque exercice a une clé stable (stockée avec les séries),
// un nom et un groupe musculaire. Les exercices ajoutés par l'utilisateur vivent dans la table strength_exercises
// (clé « perso-<uuid> ») et se mélangent à cette liste.

export const GROUPES = {
  pectoraux: { nom: 'Pectoraux', cible: [10, 20] },
  dos: { nom: 'Dos', cible: [10, 20] },
  jambes: { nom: 'Jambes', cible: [10, 20] },
  epaules: { nom: 'Épaules', cible: [8, 16] },
  bras: { nom: 'Bras', cible: [8, 14] },
  tronc: { nom: 'Tronc', cible: [6, 12] },
};

export const ORDRE_GROUPES = ['pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'tronc'];

const L = (cle, nom, groupe) => ({ cle, nom, groupe });

export const BIBLIOTHEQUE = [
  // Pectoraux
  L('developpe-couche', 'Développé couché', 'pectoraux'),
  L('developpe-incline-halteres', 'Développé incliné haltères', 'pectoraux'),
  L('developpe-incline-barre', 'Développé incliné barre', 'pectoraux'),
  L('developpe-halteres', 'Développé haltères', 'pectoraux'),
  L('ecartes', 'Écartés', 'pectoraux'),
  L('pompes', 'Pompes', 'pectoraux'),
  L('dips', 'Dips', 'pectoraux'),
  L('pec-deck', 'Pec deck', 'pectoraux'),
  // Dos
  L('souleve-de-terre', 'Soulevé de terre', 'dos'),
  L('tractions', 'Tractions', 'dos'),
  L('rowing-barre', 'Rowing barre', 'dos'),
  L('rowing-haltere', 'Rowing haltère', 'dos'),
  L('tirage-vertical', 'Tirage vertical', 'dos'),
  L('tirage-horizontal', 'Tirage horizontal', 'dos'),
  L('tirage-menton', 'Tirage menton', 'dos'),
  L('hyperextensions', 'Hyperextensions', 'dos'),
  // Jambes
  L('squat', 'Squat', 'jambes'),
  L('front-squat', 'Front squat', 'jambes'),
  L('presse-a-cuisses', 'Presse à cuisses', 'jambes'),
  L('fentes', 'Fentes', 'jambes'),
  L('fentes-bulgares', 'Fentes bulgares', 'jambes'),
  L('souleve-de-terre-roumain', 'Soulevé de terre roumain', 'jambes'),
  L('hip-thrust', 'Hip thrust', 'jambes'),
  L('leg-extension', 'Leg extension', 'jambes'),
  L('leg-curl', 'Leg curl', 'jambes'),
  L('mollets-debout', 'Mollets debout', 'jambes'),
  L('step-up', 'Step-up', 'jambes'),
  // Épaules
  L('developpe-militaire', 'Développé militaire', 'epaules'),
  L('developpe-epaules-halteres', 'Développé épaules haltères', 'epaules'),
  L('elevations-laterales', 'Élévations latérales', 'epaules'),
  L('elevations-frontales', 'Élévations frontales', 'epaules'),
  L('oiseau', 'Oiseau', 'epaules'),
  L('face-pull', 'Face pull', 'epaules'),
  L('shrugs', 'Shrugs', 'epaules'),
  // Bras
  L('curl-barre', 'Curl barre', 'bras'),
  L('curl-halteres', 'Curl haltères', 'bras'),
  L('curl-marteau', 'Curl marteau', 'bras'),
  L('curl-pupitre', 'Curl pupitre', 'bras'),
  L('extension-triceps-poulie', 'Extension triceps poulie', 'bras'),
  L('barre-au-front', 'Barre au front', 'bras'),
  L('dips-banc', 'Dips sur banc', 'bras'),
  L('kickback', 'Kickback triceps', 'bras'),
  // Tronc
  L('crunch', 'Crunch', 'tronc'),
  L('releve-de-jambes', 'Relevé de jambes', 'tronc'),
  L('gainage', 'Gainage', 'tronc'),
  L('russian-twist', 'Russian twist', 'tronc'),
  L('roue-abdominale', 'Roue abdominale', 'tronc'),
  L('crunch-poulie', 'Crunch poulie', 'tronc'),
];

const PAR_CLE = new Map(BIBLIOTHEQUE.map((e) => [e.cle, e]));

/** Un identifiant de groupe est-il valide ? (propriétés propres seulement : « constructor » n'est pas un groupe) */
export function groupeValide(g) {
  return typeof g === 'string' && Object.hasOwn(GROUPES, g);
}

/** Cherche un exercice par clé dans la bibliothèque puis dans la liste personnelle ({cle, nom, groupe}). */
export function trouverExercice(cle, perso = []) {
  return PAR_CLE.get(cle) || perso.find((e) => e.cle === cle) || null;
}

/** Exercice perso (ligne de strength_exercises) → forme commune {cle, nom, groupe, perso}. */
export function exerciceDepuisLigne(l) {
  return { cle: `perso-${l.id}`, nom: String(l.name), groupe: groupeValide(l.muscle_group) ? l.muscle_group : 'tronc', perso: true };
}

/** Bibliothèque + exercices perso, triés par nom (accents ignorés), filtrés par texte et/ou groupe. */
export function chercherExercices(perso = [], { texte = '', groupe = '' } = {}) {
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(texte.trim());
  return [...BIBLIOTHEQUE, ...perso]
    .filter((e) => (!groupe || e.groupe === groupe) && (!t || norm(e.nom).includes(t)))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
